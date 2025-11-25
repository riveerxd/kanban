using backend.Data;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class 
    BoardAccessService : IBoardAccessService
{
    private readonly ApplicationDbContext _context;

    public BoardAccessService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<bool> UserHasAccessToBoard(int userId, int boardId)
    {
        // Check if user is owner OR is a member of the board
        return await _context.Boards
            .Where(b => b.Id == boardId)
            .AnyAsync(b => b.UserId == userId || b.Members.Any(m => m.UserId == userId));
    }
}
