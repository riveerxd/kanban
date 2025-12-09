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
[Route("api/[controller]")]
[Authorize]
public class BoardController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IBoardAccessService _boardAccessService;
    private readonly IWebSocketService _webSocketService;
    private readonly ILogger<BoardController> _logger;

    public BoardController(ApplicationDbContext context, IBoardAccessService boardAccessService, IWebSocketService webSocketService, ILogger<BoardController> logger)
    {
        _context = context;
        _boardAccessService = boardAccessService;
        _webSocketService = webSocketService;
        _logger = logger;
    }

    private int GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? throw new UnauthorizedAccessException("User ID not found in token");
        return int.Parse(userIdClaim);
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<BoardDto>>> GetBoards()
    {
        var userId = GetUserId();
        var boards = await _context.Boards
            .Where(b => b.UserId == userId || b.Members.Any(m => m.UserId == userId))
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

        if (!await _boardAccessService.UserHasAccessToBoard(userId, id))
        {
            return NotFound();
        }

        var board = await _context.Boards
            .Where(b => b.Id == id)
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

        _logger.LogInformation("Board created | BoardId: {BoardId}, Title: {Title}, UserId: {UserId}",
            board.Id, board.Title, userId);

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

        if (!await _boardAccessService.UserHasAccessToBoard(userId, id))
        {
            return NotFound();
        }

        var board = await _context.Boards
            .Where(b => b.Id == id)
            .FirstOrDefaultAsync();

        if (board == null)
        {
            return NotFound();
        }

        var oldTitle = board.Title;
        board.Title = request.Title;
        board.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Board updated | BoardId: {BoardId}, OldTitle: {OldTitle}, NewTitle: {NewTitle}, UserId: {UserId}",
            id, oldTitle, request.Title, userId);

        // Broadcast board update
        await _webSocketService.BroadcastToBoardAsync(id, new WsMessage
        {
            Type = "board.updated",
            BoardId = id,
            Payload = new { Title = request.Title },
            UserId = userId,
            Timestamp = DateTime.UtcNow
        });

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

        _logger.LogInformation("Board deleted | BoardId: {BoardId}, Title: {Title}, UserId: {UserId}",
            id, board.Title, userId);

        return NoContent();
    }

    [HttpGet("{id}/members")]
    public async Task<ActionResult<BoardMembersResponse>> GetBoardMembers(int id)
    {
        var userId = GetUserId();

        if (!await _boardAccessService.UserHasAccessToBoard(userId, id))
        {
            return NotFound();
        }

        var board = await _context.Boards
            .Where(b => b.Id == id)
            .Include(b => b.Members)
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync();

        if (board == null)
        {
            return NotFound();
        }

        var response = new BoardMembersResponse
        {
            BoardId = board.Id,
            BoardTitle = board.Title,
            OwnerId = board.UserId,
            Members = board.Members.Select(m => new BoardMemberDto
            {
                Id = m.Id,
                UserId = m.UserId,
                Username = m.User.Username,
                Email = m.User.Email,
                JoinedAt = m.JoinedAt
            }).ToList()
        };

        return Ok(response);
    }

    [HttpPost("{id}/invite")]
    public async Task<ActionResult> InviteBoardMember(int id, [FromBody] InviteUserRequest request)
    {
        var userId = GetUserId();

        if (!await _boardAccessService.UserHasAccessToBoard(userId, id))
        {
            return NotFound();
        }

        var board = await _context.Boards
            .Where(b => b.Id == id)
            .Include(b => b.Members)
            .FirstOrDefaultAsync();

        if (board == null)
        {
            return NotFound();
        }

        // Find user by email
        var invitedUser = await _context.Users
            .Where(u => u.Email == request.Email)
            .FirstOrDefaultAsync();

        if (invitedUser == null)
        {
            return BadRequest("User with this email does not exist");
        }

        // Check if user is owner
        if (board.UserId == invitedUser.Id)
        {
            return BadRequest("User is already the owner of this board");
        }

        // Check if user is already a member
        if (board.Members.Any(m => m.UserId == invitedUser.Id))
        {
            return BadRequest("User is already a member of this board");
        }

        // Add member
        var boardMember = new BoardMember
        {
            BoardId = id,
            UserId = invitedUser.Id,
            JoinedAt = DateTime.UtcNow
        };

        _context.BoardMembers.Add(boardMember);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Member invited | BoardId: {BoardId}, InvitedUserId: {InvitedUserId}, InvitedEmail: {Email}, InvitedBy: {UserId}",
            id, invitedUser.Id, invitedUser.Email, userId);

        // Broadcast member joined
        await _webSocketService.BroadcastToBoardAsync(id, new WsMessage
        {
            Type = "member.joined",
            BoardId = id,
            Payload = new {
                UserId = invitedUser.Id,
                Username = invitedUser.Username,
                Email = invitedUser.Email
            },
            UserId = userId,
            Timestamp = DateTime.UtcNow
        });

        return Ok();
    }

    [HttpDelete("{id}/members/{memberId}")]
    public async Task<IActionResult> RemoveBoardMember(int id, int memberId)
    {
        var userId = GetUserId();

        if (!await _boardAccessService.UserHasAccessToBoard(userId, id))
        {
            return NotFound();
        }

        var boardMember = await _context.BoardMembers
            .Where(m => m.Id == memberId && m.BoardId == id)
            .FirstOrDefaultAsync();

        if (boardMember == null)
        {
            return NotFound();
        }

        var removedUserId = boardMember.UserId;
        _context.BoardMembers.Remove(boardMember);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Member removed | BoardId: {BoardId}, RemovedUserId: {RemovedUserId}, RemovedBy: {UserId}",
            id, removedUserId, userId);

        // Broadcast member left
        await _webSocketService.BroadcastToBoardAsync(id, new WsMessage
        {
            Type = "member.left",
            BoardId = id,
            Payload = new { UserId = removedUserId },
            UserId = userId,
            Timestamp = DateTime.UtcNow
        });

        return NoContent();
    }
}
