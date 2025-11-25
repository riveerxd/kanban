namespace backend.Services;

public interface IBoardAccessService
{
    Task<bool> UserHasAccessToBoard(int userId, int boardId);
}
