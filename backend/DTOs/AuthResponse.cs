namespace backend.DTOs;

/// <summary>
/// Data transfer object for authentication responses.
/// </summary>
public class AuthResponse
{
    public int UserId { get; set; }
    public string Token { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}
