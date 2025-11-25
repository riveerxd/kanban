using backend.Models.WebSocket;
using Fleck;

namespace backend.Services;

public interface IWebSocketService
{
    Task StartAsync(int port = 8181);
    Task BroadcastToBoardAsync(int boardId, WsMessage message);
    Task RegisterConnectionAsync(int userId, string username, int boardId, IWebSocketConnection socket);
    Task UnregisterConnectionAsync(IWebSocketConnection socket);
}
