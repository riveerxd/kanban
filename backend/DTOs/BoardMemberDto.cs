namespace backend.DTOs;

public class BoardMemberDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public DateTime JoinedAt { get; set; }
}

public class InviteUserRequest
{
    public string Email { get; set; } = string.Empty;
}

public class BoardMembersResponse
{
    public int BoardId { get; set; }
    public string BoardTitle { get; set; } = string.Empty;
    public int OwnerId { get; set; }
    public List<BoardMemberDto> Members { get; set; } = new();
}
