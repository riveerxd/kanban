using backend.Data;
using backend.DTOs;
using backend.Models;
using backend.Models.WebSocket;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace backend.Controllers;

[ApiController]
[Route("api/boards/{boardId}/[controller]")]
[Authorize]
public class ColumnController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IBoardAccessService _boardAccessService;
    private readonly IWebSocketService _webSocketService;

    public ColumnController(ApplicationDbContext context, IBoardAccessService boardAccessService, IWebSocketService webSocketService)
    {
        _context = context;
        _boardAccessService = boardAccessService;
        _webSocketService = webSocketService;
    }

    private int GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.Parse(userIdClaim ?? "0");
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ColumnDto>>> GetColumns(int boardId)
    {
        var userId = GetUserId();
        if (!await _boardAccessService.UserHasAccessToBoard(userId, boardId))
        {
            return NotFound();
        }

        var columns = await _context.Columns
            .Where(c => c.BoardId == boardId)
            .Include(c => c.Tasks)
            .OrderBy(c => c.Position)
            .ToListAsync();

        var columnDtos = columns.Select(c => new ColumnDto
        {
            Id = c.Id,
            BoardId = c.BoardId,
            Title = c.Title,
            Position = c.Position,
            CreatedAt = c.CreatedAt,
            UpdatedAt = c.UpdatedAt,
            Tasks = c.Tasks.OrderBy(t => t.Position).Select(t => new TaskDto
            {
                Id = t.Id,
                ColumnId = t.ColumnId,
                Title = t.Title,
                Description = t.Description,
                Position = t.Position,
                CreatedAt = t.CreatedAt,
                UpdatedAt = t.UpdatedAt
            }).ToList()
        }).ToList();

        return Ok(columnDtos);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ColumnDto>> GetColumn(int boardId, int id)
    {
        var userId = GetUserId();
        if (!await _boardAccessService.UserHasAccessToBoard(userId, boardId))
        {
            return NotFound();
        }

        var column = await _context.Columns
            .Where(c => c.Id == id && c.BoardId == boardId)
            .Include(c => c.Tasks)
            .FirstOrDefaultAsync();

        if (column == null)
        {
            return NotFound();
        }

        var columnDto = new ColumnDto
        {
            Id = column.Id,
            BoardId = column.BoardId,
            Title = column.Title,
            Position = column.Position,
            CreatedAt = column.CreatedAt,
            UpdatedAt = column.UpdatedAt,
            Tasks = column.Tasks.OrderBy(t => t.Position).Select(t => new TaskDto
            {
                Id = t.Id,
                ColumnId = t.ColumnId,
                Title = t.Title,
                Description = t.Description,
                Position = t.Position,
                CreatedAt = t.CreatedAt,
                UpdatedAt = t.UpdatedAt
            }).ToList()
        };

        return Ok(columnDto);
    }

    [HttpPost]
    public async Task<ActionResult<ColumnDto>> CreateColumn(int boardId, [FromBody] CreateColumnRequest request)
    {
        var userId = GetUserId();
        if (!await _boardAccessService.UserHasAccessToBoard(userId, boardId))
        {
            return NotFound();
        }

        var column = new Column
        {
            BoardId = boardId,
            Title = request.Title,
            Position = request.Position,
            CreatedAt = DateTime.UtcNow
        };

        _context.Columns.Add(column);
        await _context.SaveChangesAsync();

        var columnDto = new ColumnDto
        {
            Id = column.Id,
            BoardId = column.BoardId,
            Title = column.Title,
            Position = column.Position,
            CreatedAt = column.CreatedAt,
            UpdatedAt = column.UpdatedAt,
            Tasks = new List<TaskDto>()
        };

        // Broadcast column created
        await _webSocketService.BroadcastToBoardAsync(boardId, new WsMessage
        {
            Type = "column.created",
            BoardId = boardId,
            Payload = columnDto,
            UserId = userId,
            Timestamp = DateTime.UtcNow
        });

        return CreatedAtAction(nameof(GetColumn), new { boardId = boardId, id = column.Id }, columnDto);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateColumn(int boardId, int id, [FromBody] UpdateColumnRequest request)
    {
        var userId = GetUserId();
        if (!await _boardAccessService.UserHasAccessToBoard(userId, boardId))
        {
            return NotFound();
        }

        var column = await _context.Columns
            .Where(c => c.Id == id && c.BoardId == boardId)
            .FirstOrDefaultAsync();

        if (column == null)
        {
            return NotFound();
        }

        column.Title = request.Title;
        column.Position = request.Position;
        column.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        // Broadcast column updated
        await _webSocketService.BroadcastToBoardAsync(boardId, new WsMessage
        {
            Type = "column.updated",
            BoardId = boardId,
            Payload = new {
                Id = id,
                Title = request.Title,
                Position = request.Position
            },
            UserId = userId,
            Timestamp = DateTime.UtcNow
        });

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteColumn(int boardId, int id)
    {
        var userId = GetUserId();
        if (!await _boardAccessService.UserHasAccessToBoard(userId, boardId))
        {
            return NotFound();
        }

        var column = await _context.Columns
            .Where(c => c.Id == id && c.BoardId == boardId)
            .FirstOrDefaultAsync();

        if (column == null)
        {
            return NotFound();
        }

        _context.Columns.Remove(column);
        await _context.SaveChangesAsync();

        // Broadcast column deleted
        await _webSocketService.BroadcastToBoardAsync(boardId, new WsMessage
        {
            Type = "column.deleted",
            BoardId = boardId,
            Payload = new { Id = id },
            UserId = userId,
            Timestamp = DateTime.UtcNow
        });

        return NoContent();
    }
}
