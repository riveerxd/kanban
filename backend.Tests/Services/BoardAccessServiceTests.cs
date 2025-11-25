using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace backend.Tests.Services;

public class BoardAccessServiceTests
{
    private ApplicationDbContext GetInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    [Fact]
    public async System.Threading.Tasks.Task UserHasAccessToBoard_Owner_ReturnsTrue()
    {
        // Arrange
        var context = GetInMemoryDbContext();
        var service = new BoardAccessService(context);

        var board = new Board { Id = 1, UserId = 1, Title = "Test Board" };
        context.Boards.Add(board);
        await context.SaveChangesAsync();

        // Act
        var result = await service.UserHasAccessToBoard(1, 1);

        // Assert
        Assert.True(result);
    }

    [Fact]
    public async System.Threading.Tasks.Task UserHasAccessToBoard_Member_ReturnsTrue()
    {
        // Arrange
        var context = GetInMemoryDbContext();
        var service = new BoardAccessService(context);

        var user = new User { Id = 2, Email = "member@test.com", Username = "member", PasswordHash = "hash" };
        var board = new Board { Id = 1, UserId = 1, Title = "Test Board" };
        var member = new BoardMember { BoardId = 1, UserId = 2, JoinedAt = DateTime.UtcNow };

        context.Users.Add(user);
        context.Boards.Add(board);
        context.BoardMembers.Add(member);
        await context.SaveChangesAsync();

        // Act
        var result = await service.UserHasAccessToBoard(2, 1);

        // Assert
        Assert.True(result);
    }

    [Fact]
    public async System.Threading.Tasks.Task UserHasAccessToBoard_NoAccess_ReturnsFalse()
    {
        // Arrange
        var context = GetInMemoryDbContext();
        var service = new BoardAccessService(context);

        var board = new Board { Id = 1, UserId = 1, Title = "Test Board" };
        context.Boards.Add(board);
        await context.SaveChangesAsync();

        // Act
        var result = await service.UserHasAccessToBoard(999, 1);

        // Assert
        Assert.False(result);
    }
}
