namespace backend.DTOs;

public class BoardDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<ColumnDto> Columns { get; set; } = new();
}

public class CreateBoardRequest
{
    public string Title { get; set; } = string.Empty;
}

public class UpdateBoardRequest
{
    public string Title { get; set; } = string.Empty;
}
