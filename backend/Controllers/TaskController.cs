using backend.Data;
using backend.DTOs;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TaskController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IBoardAccessService _boardAccessService;

    public TaskController(ApplicationDbContext context, IBoardAccessService boardAccessService)
    {
        _context = context;
        _boardAccessService = boardAccessService;
    }

    private int GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.Parse(userIdClaim ?? "0");
    }

    private async Task<bool> UserHasAccessToColumn(int columnId)
    {
        var userId = GetUserId();
        var column = await _context.Columns
            .Include(c => c.Board)
            .FirstOrDefaultAsync(c => c.Id == columnId);

        if (column == null) return false;

        return await _boardAccessService.UserHasAccessToBoard(userId, column.BoardId);
    }

    private async Task<bool> UserHasAccessToTask(int taskId)
    {
        var userId = GetUserId();
        var task = await _context.Tasks
            .Include(t => t.Column)
                .ThenInclude(c => c.Board)
            .FirstOrDefaultAsync(t => t.Id == taskId);

        if (task == null) return false;

        return await _boardAccessService.UserHasAccessToBoard(userId, task.Column.BoardId);
    }

    [HttpGet("column/{columnId}")]
    public async Task<ActionResult<IEnumerable<TaskDto>>> GetTasksByColumn(int columnId)
    {
        if (!await UserHasAccessToColumn(columnId))
        {
            return NotFound();
        }

        var tasks = await _context.Tasks
            .Where(t => t.ColumnId == columnId)
            .OrderBy(t => t.Position)
            .ToListAsync();

        var taskDtos = tasks.Select(t => new TaskDto
        {
            Id = t.Id,
            ColumnId = t.ColumnId,
            Title = t.Title,
            Description = t.Description,
            Position = t.Position,
            CreatedAt = t.CreatedAt,
            UpdatedAt = t.UpdatedAt
        }).ToList();

        return Ok(taskDtos);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<TaskDto>> GetTask(int id)
    {
        if (!await UserHasAccessToTask(id))
        {
            return NotFound();
        }

        var task = await _context.Tasks.FindAsync(id);

        if (task == null)
        {
            return NotFound();
        }

        var taskDto = new TaskDto
        {
            Id = task.Id,
            ColumnId = task.ColumnId,
            Title = task.Title,
            Description = task.Description,
            Position = task.Position,
            CreatedAt = task.CreatedAt,
            UpdatedAt = task.UpdatedAt
        };

        return Ok(taskDto);
    }

    [HttpPost("column/{columnId}")]
    public async Task<ActionResult<TaskDto>> CreateTask(int columnId, [FromBody] CreateTaskRequest request)
    {
        if (!await UserHasAccessToColumn(columnId))
        {
            return NotFound();
        }

        var task = new Models.Task
        {
            ColumnId = columnId,
            Title = request.Title,
            Description = request.Description,
            Position = request.Position,
            CreatedAt = DateTime.UtcNow
        };

        _context.Tasks.Add(task);
        await _context.SaveChangesAsync();

        var taskDto = new TaskDto
        {
            Id = task.Id,
            ColumnId = task.ColumnId,
            Title = task.Title,
            Description = task.Description,
            Position = task.Position,
            CreatedAt = task.CreatedAt,
            UpdatedAt = task.UpdatedAt
        };

        return CreatedAtAction(nameof(GetTask), new { id = task.Id }, taskDto);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateTask(int id, [FromBody] UpdateTaskRequest request)
    {
        if (!await UserHasAccessToTask(id))
        {
            return NotFound();
        }

        var task = await _context.Tasks.FindAsync(id);

        if (task == null)
        {
            return NotFound();
        }

        task.Title = request.Title;
        task.Description = request.Description;
        task.Position = request.Position;
        task.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpPatch("{id}/move")]
    public async Task<IActionResult> MoveTask(int id, [FromBody] MoveTaskRequest request)
    {
        if (!await UserHasAccessToTask(id))
        {
            return NotFound();
        }

        if (!await UserHasAccessToColumn(request.ColumnId))
        {
            return BadRequest("Invalid column");
        }

        var task = await _context.Tasks.FindAsync(id);

        if (task == null)
        {
            return NotFound();
        }

        var oldColumnId = task.ColumnId;
        var oldPosition = task.Position;
        var newColumnId = request.ColumnId;
        var newPosition = request.Position;

        // Start transaction to ensure atomicity
        using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
            // Case 1: Moving within the same column
            if (oldColumnId == newColumnId)
            {
                if (oldPosition != newPosition)
                {
                    if (newPosition < oldPosition)
                    {
                        // Moving up: shift tasks down between newPosition and oldPosition
                        var tasksToShift = await _context.Tasks
                            .Where(t => t.ColumnId == oldColumnId &&
                                       t.Position >= newPosition &&
                                       t.Position < oldPosition)
                            .ToListAsync();

                        foreach (var t in tasksToShift)
                        {
                            t.Position++;
                            t.UpdatedAt = DateTime.UtcNow;
                        }
                    }
                    else
                    {
                        // Moving down: shift tasks up between oldPosition and newPosition
                        var tasksToShift = await _context.Tasks
                            .Where(t => t.ColumnId == oldColumnId &&
                                       t.Position > oldPosition &&
                                       t.Position <= newPosition)
                            .ToListAsync();

                        foreach (var t in tasksToShift)
                        {
                            t.Position--;
                            t.UpdatedAt = DateTime.UtcNow;
                        }
                    }
                }
            }
            // Case 2: Moving to a different column
            else
            {
                // Shift tasks in old column (close the gap)
                var tasksInOldColumn = await _context.Tasks
                    .Where(t => t.ColumnId == oldColumnId && t.Position > oldPosition)
                    .ToListAsync();

                foreach (var t in tasksInOldColumn)
                {
                    t.Position--;
                    t.UpdatedAt = DateTime.UtcNow;
                }

                // Shift tasks in new column (make space)
                var tasksInNewColumn = await _context.Tasks
                    .Where(t => t.ColumnId == newColumnId && t.Position >= newPosition)
                    .ToListAsync();

                foreach (var t in tasksInNewColumn)
                {
                    t.Position++;
                    t.UpdatedAt = DateTime.UtcNow;
                }
            }

            // Update the moved task
            task.ColumnId = newColumnId;
            task.Position = newPosition;
            task.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return NoContent();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteTask(int id)
    {
        if (!await UserHasAccessToTask(id))
        {
            return NotFound();
        }

        var task = await _context.Tasks.FindAsync(id);

        if (task == null)
        {
            return NotFound();
        }

        _context.Tasks.Remove(task);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
