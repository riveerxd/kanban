namespace backend.Models;

public class ResourceLock
{
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}
