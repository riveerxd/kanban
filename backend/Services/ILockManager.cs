using backend.Models;

namespace backend.Services;

public interface ILockManager
{
    bool TryAcquireLock(string key, int userId, string username);
    bool ReleaseLock(string key, int userId);
    ResourceLock? GetLock(string key);
    void ReleaseUserLocks(int userId);
}
