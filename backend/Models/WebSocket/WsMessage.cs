namespace backend.Models.WebSocket;

public class WsMessage
{
    public string Type { get; set; } = string.Empty;
    public int BoardId { get; set; }
    public object? Payload { get; set; }
    public int UserId { get; set; }
    public DateTime Timestamp { get; set; }
}
