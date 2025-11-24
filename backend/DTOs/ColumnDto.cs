namespace backend.DTOs;

public class ColumnDto
{
    public int Id { get; set; }
    public int BoardId { get; set; }
    public string Title { get; set; } = string.Empty;
    public int Position { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<TaskDto> Tasks { get; set; } = new();
}

public class CreateColumnRequest
{
    public string Title { get; set; } = string.Empty;
    public int Position { get; set; }
}

public class UpdateColumnRequest
{
    public string Title { get; set; } = string.Empty;
    public int Position { get; set; }
}
