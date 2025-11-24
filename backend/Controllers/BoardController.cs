using backend.Data;
using backend.DTOs;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BoardController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public BoardController(ApplicationDbContext context)
    {
        _context = context;
    }

    private int GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.Parse(userIdClaim ?? "0");
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<BoardDto>>> GetBoards()
    {
        var userId = GetUserId();
        var boards = await _context.Boards
            .Where(b => b.UserId == userId)
            .Include(b => b.Columns)
                .ThenInclude(c => c.Tasks)
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync();

        var boardDtos = boards.Select(b => new BoardDto
        {
            Id = b.Id,
            UserId = b.UserId,
            Title = b.Title,
            CreatedAt = b.CreatedAt,
            UpdatedAt = b.UpdatedAt,
            Columns = b.Columns.OrderBy(c => c.Position).Select(c => new ColumnDto
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
            }).ToList()
        }).ToList();

        return Ok(boardDtos);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<BoardDto>> GetBoard(int id)
    {
        var userId = GetUserId();
        var board = await _context.Boards
            .Where(b => b.Id == id && b.UserId == userId)
            .Include(b => b.Columns)
                .ThenInclude(c => c.Tasks)
            .FirstOrDefaultAsync();

        if (board == null)
        {
            return NotFound();
        }

        var boardDto = new BoardDto
        {
            Id = board.Id,
            UserId = board.UserId,
            Title = board.Title,
            CreatedAt = board.CreatedAt,
            UpdatedAt = board.UpdatedAt,
            Columns = board.Columns.OrderBy(c => c.Position).Select(c => new ColumnDto
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
            }).ToList()
        };

        return Ok(boardDto);
    }

    [HttpPost]
    public async Task<ActionResult<BoardDto>> CreateBoard([FromBody] CreateBoardRequest request)
    {
        var userId = GetUserId();
        var board = new Board
        {
            UserId = userId,
            Title = request.Title,
            CreatedAt = DateTime.UtcNow
        };

        _context.Boards.Add(board);
        await _context.SaveChangesAsync();

        var boardDto = new BoardDto
        {
            Id = board.Id,
            UserId = board.UserId,
            Title = board.Title,
            CreatedAt = board.CreatedAt,
            UpdatedAt = board.UpdatedAt,
            Columns = new List<ColumnDto>()
        };

        return CreatedAtAction(nameof(GetBoard), new { id = board.Id }, boardDto);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateBoard(int id, [FromBody] UpdateBoardRequest request)
    {
        var userId = GetUserId();
        var board = await _context.Boards
            .Where(b => b.Id == id && b.UserId == userId)
            .FirstOrDefaultAsync();

        if (board == null)
        {
            return NotFound();
        }

        board.Title = request.Title;
        board.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteBoard(int id)
    {
        var userId = GetUserId();
        var board = await _context.Boards
            .Where(b => b.Id == id && b.UserId == userId)
            .FirstOrDefaultAsync();

        if (board == null)
        {
            return NotFound();
        }

        _context.Boards.Remove(board);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
