using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using System.Text.Json;
using backend.Models.WebSocket;
using Fleck;
using Microsoft.IdentityModel.Tokens;

namespace backend.Services;

public class WebSocketService : IWebSocketService
{
    private WebSocketServer? _server;
    private readonly ConcurrentDictionary<int, List<SocketInfo>> _boardConnections = new();
    private readonly ConcurrentDictionary<Guid, SocketInfo> _allConnections = new();
    private readonly IConfiguration _configuration;
    private readonly ILogger<WebSocketService> _logger;

    public WebSocketService(IConfiguration configuration, ILogger<WebSocketService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public Task StartAsync(int port = 8181)
    {
        FleckLog.Level = Fleck.LogLevel.Debug;
        _server = new WebSocketServer($"ws://0.0.0.0:{port}");

        _server.Start(socket =>
        {
            socket.OnOpen = async () => await OnOpenAsync(socket);
            socket.OnClose = async () => await OnCloseAsync(socket);
            socket.OnError = (exception) => OnError(socket, exception);
            socket.OnMessage = (message) => OnMessage(socket, message);
        });

        _logger.LogInformation($"WebSocket server started on port {port}");
        return Task.CompletedTask;
    }

    private async Task OnOpenAsync(IWebSocketConnection socket)
    {
        try
        {
            // Parse query string for boardId and token
            var query = ParseQueryString(socket.ConnectionInfo.Path);

            if (!query.TryGetValue("boardId", out var boardIdStr) || !int.TryParse(boardIdStr, out var boardId))
            {
                _logger.LogWarning("WebSocket connection rejected: Missing or invalid boardId");
                socket.Close();
                return;
            }

            if (!query.TryGetValue("token", out var token))
            {
                _logger.LogWarning("WebSocket connection rejected: Missing token");
                socket.Close();
                return;
            }

            // Validate JWT token
            var userId = ValidateToken(token);
            if (userId == null)
            {
                _logger.LogWarning("WebSocket connection rejected: Invalid token");
                socket.Close();
                return;
            }

            // Register connection
            await RegisterConnectionAsync(userId.Value, boardId, socket);

            _logger.LogInformation($"WebSocket connection established: User {userId}, Board {boardId}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling WebSocket connection");
            socket.Close();
        }
    }

    private async Task OnCloseAsync(IWebSocketConnection socket)
    {
        await UnregisterConnectionAsync(socket);
        _logger.LogInformation($"WebSocket connection closed: {socket.ConnectionInfo.Id}");
    }

    private void OnError(IWebSocketConnection socket, Exception exception)
    {
        _logger.LogError(exception, $"WebSocket error: {socket.ConnectionInfo.Id}");
    }

    private void OnMessage(IWebSocketConnection socket, string message)
    {
        // Handle incoming messages from clients if needed
        _logger.LogDebug($"WebSocket message received: {message}");
    }

    public async Task BroadcastToBoardAsync(int boardId, WsMessage message)
    {
        if (!_boardConnections.TryGetValue(boardId, out var connections))
        {
            return;
        }

        var options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };
        var json = JsonSerializer.Serialize(message, options);
        var tasks = connections.Select(conn =>
            Task.Run(async () =>
            {
                try
                {
                    await conn.Socket.Send(json);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error sending message to connection {conn.Socket.ConnectionInfo.Id}");
                }
            })
        );

        await Task.WhenAll(tasks);
    }

    public Task RegisterConnectionAsync(int userId, int boardId, IWebSocketConnection socket)
    {
        var socketInfo = new SocketInfo
        {
            Socket = socket,
            UserId = userId,
            BoardId = boardId
        };

        // Add to all connections
        _allConnections.TryAdd(socket.ConnectionInfo.Id, socketInfo);

        // Add to board connections
        _boardConnections.AddOrUpdate(
            boardId,
            new List<SocketInfo> { socketInfo },
            (key, list) =>
            {
                lock (list)
                {
                    list.Add(socketInfo);
                }
                return list;
            }
        );

        return Task.CompletedTask;
    }

    public Task UnregisterConnectionAsync(IWebSocketConnection socket)
    {
        if (_allConnections.TryRemove(socket.ConnectionInfo.Id, out var socketInfo))
        {
            // Remove from board connections
            if (_boardConnections.TryGetValue(socketInfo.BoardId, out var connections))
            {
                lock (connections)
                {
                    connections.RemoveAll(c => c.Socket.ConnectionInfo.Id == socket.ConnectionInfo.Id);

                    // Clean up empty board connection lists
                    if (connections.Count == 0)
                    {
                        _boardConnections.TryRemove(socketInfo.BoardId, out _);
                    }
                }
            }
        }

        return Task.CompletedTask;
    }

    private int? ValidateToken(string token)
    {
        try
        {
            var jwtSettings = _configuration.GetSection("JwtSettings");
            var secretKey = jwtSettings["Secret"];

            if (string.IsNullOrEmpty(secretKey))
            {
                return null;
            }

            var tokenHandler = new JwtSecurityTokenHandler();
            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = jwtSettings["Issuer"],
                ValidAudience = jwtSettings["Audience"],
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
                ClockSkew = TimeSpan.Zero
            };

            var principal = tokenHandler.ValidateToken(token, validationParameters, out _);
            var userIdClaim = principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);

            if (userIdClaim != null && int.TryParse(userIdClaim.Value, out var userId))
            {
                return userId;
            }

            return null;
        }
        catch
        {
            return null;
        }
    }

    private Dictionary<string, string> ParseQueryString(string path)
    {
        var result = new Dictionary<string, string>();

        var queryIndex = path.IndexOf('?');
        if (queryIndex == -1)
        {
            return result;
        }

        var queryString = path.Substring(queryIndex + 1);
        var pairs = queryString.Split('&');

        foreach (var pair in pairs)
        {
            var keyValue = pair.Split('=');
            if (keyValue.Length == 2)
            {
                result[Uri.UnescapeDataString(keyValue[0])] = Uri.UnescapeDataString(keyValue[1]);
            }
        }

        return result;
    }

    private class SocketInfo
    {
        public IWebSocketConnection Socket { get; set; } = null!;
        public int UserId { get; set; }
        public int BoardId { get; set; }
    }
}
