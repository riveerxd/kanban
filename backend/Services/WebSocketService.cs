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
    private readonly ILockManager _lockManager;

    public WebSocketService(IConfiguration configuration, ILogger<WebSocketService> logger, ILockManager lockManager)
    {
        _configuration = configuration;
        _logger = logger;
        _lockManager = lockManager;
    }

    public Task StartAsync(int port = 8181)
    {
        FleckLog.Level = Fleck.LogLevel.Debug;
        var wsHost = Environment.GetEnvironmentVariable("WS_HOST") ?? "0.0.0.0";
        _server = new WebSocketServer($"ws://{wsHost}:{port}");

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

            // Validate JWT token and get user info
            var (userId, username) = ValidateToken(token);
            if (userId == null)
            {
                _logger.LogWarning("WebSocket connection rejected: Invalid token");
                socket.Close();
                return;
            }

            // Register connection
            await RegisterConnectionAsync(userId.Value, username ?? "Unknown", boardId, socket);

            _logger.LogInformation($"WebSocket connection established: User {userId} ({username}), Board {boardId}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling WebSocket connection");
            socket.Close();
        }
    }

    private async Task OnCloseAsync(IWebSocketConnection socket)
    {
        // Release all locks held by this user
        if (_allConnections.TryGetValue(socket.ConnectionInfo.Id, out var socketInfo))
        {
            _lockManager.ReleaseUserLocks(socketInfo.UserId);
            _logger.LogInformation($"Released all locks for user {socketInfo.UserId}");
        }

        await UnregisterConnectionAsync(socket);
        _logger.LogInformation($"WebSocket connection closed: {socket.ConnectionInfo.Id}");
    }

    private void OnError(IWebSocketConnection socket, Exception exception)
    {
        _logger.LogError(exception, $"WebSocket error: {socket.ConnectionInfo.Id}");
    }

    private async void OnMessage(IWebSocketConnection socket, string message)
    {
        try
        {
            var msg = JsonSerializer.Deserialize<WsMessage>(message, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            if (msg == null || !_allConnections.TryGetValue(socket.ConnectionInfo.Id, out var socketInfo))
            {
                return;
            }

            _logger.LogDebug($"WebSocket message received: {msg.Type}");

            switch (msg.Type)
            {
                case "lock.request":
                    await HandleLockRequest(socketInfo, msg, socket);
                    break;

                case "lock.release":
                    await HandleLockRelease(socketInfo, msg);
                    break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling WebSocket message");
        }
    }

    private async Task HandleLockRequest(SocketInfo socketInfo, WsMessage msg, IWebSocketConnection socket)
    {
        try
        {
            var payload = JsonSerializer.Deserialize<JsonElement>(msg.Payload?.ToString() ?? "{}");
            var resourceType = payload.GetProperty("resourceType").GetString() ?? "";
            var resourceId = payload.GetProperty("resourceId").GetInt32();

            var key = $"{resourceType}_{resourceId}";
            var granted = _lockManager.TryAcquireLock(key, socketInfo.UserId, socketInfo.Username);

            var options = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };

            if (granted)
            {
                // Send lock granted to requester
                await socket.Send(JsonSerializer.Serialize(new
                {
                    type = "lock.granted",
                    payload = new { resourceType, resourceId },
                    userId = socketInfo.UserId,
                    timestamp = DateTime.UtcNow
                }, options));

                // Broadcast to others on the board
                await BroadcastToBoardAsync(socketInfo.BoardId, new WsMessage
                {
                    Type = "lock.acquired",
                    BoardId = socketInfo.BoardId,
                    Payload = new { resourceType, resourceId, userId = socketInfo.UserId, username = socketInfo.Username },
                    UserId = socketInfo.UserId,
                    Timestamp = DateTime.UtcNow
                });
            }
            else
            {
                // Lock denied - get current lock info
                var currentLock = _lockManager.GetLock(key);
                await socket.Send(JsonSerializer.Serialize(new
                {
                    type = "lock.denied",
                    payload = new {
                        resourceType,
                        resourceId,
                        lockedBy = currentLock?.Username ?? "Unknown"
                    },
                    timestamp = DateTime.UtcNow
                }, options));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling lock request");
        }
    }

    private async Task HandleLockRelease(SocketInfo socketInfo, WsMessage msg)
    {
        try
        {
            var payload = JsonSerializer.Deserialize<JsonElement>(msg.Payload?.ToString() ?? "{}");
            var resourceType = payload.GetProperty("resourceType").GetString() ?? "";
            var resourceId = payload.GetProperty("resourceId").GetInt32();

            var key = $"{resourceType}_{resourceId}";
            var released = _lockManager.ReleaseLock(key, socketInfo.UserId);

            if (released)
            {
                // Broadcast to all on the board
                await BroadcastToBoardAsync(socketInfo.BoardId, new WsMessage
                {
                    Type = "lock.released",
                    BoardId = socketInfo.BoardId,
                    Payload = new { resourceType, resourceId },
                    UserId = socketInfo.UserId,
                    Timestamp = DateTime.UtcNow
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling lock release");
        }
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

    public Task RegisterConnectionAsync(int userId, string username, int boardId, IWebSocketConnection socket)
    {
        var socketInfo = new SocketInfo
        {
            Socket = socket,
            UserId = userId,
            Username = username,
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

    private (int? userId, string? username) ValidateToken(string token)
    {
        try
        {
            var jwtSettings = _configuration.GetSection("JwtSettings");
            var secretKey = jwtSettings["Secret"];

            if (string.IsNullOrEmpty(secretKey))
            {
                return (null, null);
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
            var usernameClaim = principal.FindFirst(System.Security.Claims.ClaimTypes.Name);

            if (userIdClaim != null && int.TryParse(userIdClaim.Value, out var userId))
            {
                return (userId, usernameClaim?.Value);
            }

            return (null, null);
        }
        catch
        {
            return (null, null);
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
        public string Username { get; set; } = string.Empty;
        public int BoardId { get; set; }
    }
}
