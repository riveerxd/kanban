using System.Collections.Concurrent;
using backend.Models;

namespace backend.Services;

public class LockManager : ILockManager
{
    private readonly ConcurrentDictionary<string, ResourceLock> _locks = new();
    private readonly TimeSpan _timeout = TimeSpan.FromSeconds(30);
    private readonly ILogger<LockManager> _logger;

    public LockManager(ILogger<LockManager> logger)
    {
        _logger = logger;
    }

    public bool TryAcquireLock(string key, int userId, string username)
    {
        // Clean expired lock if exists
        if (_locks.TryGetValue(key, out var existing))
        {
            if (existing.ExpiresAt < DateTime.UtcNow)
            {
                _logger.LogInformation($"Lock expired for {key}, removing");
                _locks.TryRemove(key, out _);
            }
            else
            {
                _logger.LogInformation($"Lock denied for {key}, held by user {existing.UserId}");
                return false; // Still locked by someone else
            }
        }

        // Try to acquire lock
        var acquired = _locks.TryAdd(key, new ResourceLock
        {
            UserId = userId,
            Username = username,
            ExpiresAt = DateTime.UtcNow.Add(_timeout)
        });

        if (acquired)
        {
            _logger.LogInformation($"Lock acquired for {key} by user {userId} ({username})");
        }

        return acquired;
    }

    public bool ReleaseLock(string key, int userId)
    {
        if (_locks.TryGetValue(key, out var lockInfo))
        {
            // Only the lock owner can release it
            if (lockInfo.UserId == userId)
            {
                var released = _locks.TryRemove(key, out _);
                if (released)
                {
                    _logger.LogInformation($"Lock released for {key} by user {userId}");
                }
                return released;
            }
            else
            {
                _logger.LogWarning($"User {userId} tried to release lock {key} owned by {lockInfo.UserId}");
                return false;
            }
        }

        return false;
    }

    public ResourceLock? GetLock(string key)
    {
        if (_locks.TryGetValue(key, out var lockInfo))
        {
            // Check if expired
            if (lockInfo.ExpiresAt < DateTime.UtcNow)
            {
                _locks.TryRemove(key, out _);
                return null;
            }
            return lockInfo;
        }

        return null;
    }

    public void ReleaseUserLocks(int userId)
    {
        var userLocks = _locks.Where(kvp => kvp.Value.UserId == userId).ToList();

        foreach (var kvp in userLocks)
        {
            _locks.TryRemove(kvp.Key, out _);
            _logger.LogInformation($"Auto-released lock {kvp.Key} for disconnected user {userId}");
        }
    }
}
