using backend.Services;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace backend.Tests.Services;

public class LockManagerTests
{
    private LockManager CreateLockManager()
    {
        var mockLogger = new Mock<ILogger<LockManager>>();
        return new LockManager(mockLogger.Object);
    }

    [Fact]
    public void AcquireLock_NewResource_Success()
    {
        // Arrange
        var lockManager = CreateLockManager();

        // Act
        var result = lockManager.TryAcquireLock("task-1", 1, "user1");

        // Assert
        Assert.True(result);
    }

    [Fact]
    public void AcquireLock_AlreadyLocked_Fails()
    {
        // Arrange
        var lockManager = CreateLockManager();
        lockManager.TryAcquireLock("task-1", 1, "user1");

        // Act
        var result = lockManager.TryAcquireLock("task-1", 2, "user2");

        // Assert
        Assert.False(result);
    }

    [Fact]
    public void AcquireLock_ExpiredLock_Success()
    {
        // Arrange
        var lockManager = CreateLockManager();
        lockManager.TryAcquireLock("task-1", 1, "user1");

        // Wait for lock to expire (30 seconds timeout)
        Thread.Sleep(31000);

        // Act
        var result = lockManager.TryAcquireLock("task-1", 2, "user2");

        // Assert
        Assert.True(result);
    }

    [Fact]
    public void ReleaseLock_Owner_Success()
    {
        // Arrange
        var lockManager = CreateLockManager();
        lockManager.TryAcquireLock("task-1", 1, "user1");

        // Act
        var result = lockManager.ReleaseLock("task-1", 1);

        // Assert
        Assert.True(result);
    }

    [Fact]
    public void ReleaseLock_NotOwner_Fails()
    {
        // Arrange
        var lockManager = CreateLockManager();
        lockManager.TryAcquireLock("task-1", 1, "user1");

        // Act
        var result = lockManager.ReleaseLock("task-1", 2);

        // Assert
        Assert.False(result);
    }

    [Fact]
    public void ReleaseUserLocks_RemovesAllUserLocks()
    {
        // Arrange
        var lockManager = CreateLockManager();
        lockManager.TryAcquireLock("task-1", 1, "user1");
        lockManager.TryAcquireLock("task-2", 1, "user1");
        lockManager.TryAcquireLock("task-3", 2, "user2");

        // Act
        lockManager.ReleaseUserLocks(1);

        // Assert - user 1's locks should be gone
        var canAcquireTask1 = lockManager.TryAcquireLock("task-1", 3, "user3");
        var canAcquireTask2 = lockManager.TryAcquireLock("task-2", 3, "user3");
        var canAcquireTask3 = lockManager.TryAcquireLock("task-3", 3, "user3");

        Assert.True(canAcquireTask1);
        Assert.True(canAcquireTask2);
        Assert.False(canAcquireTask3); // Still locked by user 2
    }
}
