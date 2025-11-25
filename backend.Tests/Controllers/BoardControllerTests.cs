using backend.Controllers;
using backend.Data;
using backend.DTOs;
using backend.Models;
using backend.Models.WebSocket;
using backend.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using System.Security.Claims;
using Xunit;

namespace backend.Tests.Controllers;

public class BoardControllerTests
{
    private ApplicationDbContext GetInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private BoardController CreateController(ApplicationDbContext context, int userId = 1)
    {
        var mockBoardAccessService = new Mock<IBoardAccessService>();
        var mockWebSocketService = new Mock<IWebSocketService>();

        // Setup access service to allow access for owner
        mockBoardAccessService.Setup(x => x.UserHasAccessToBoard(It.IsAny<int>(), It.IsAny<int>()))
            .ReturnsAsync((int uid, int bid) =>
            {
                var board = context.Boards.Find(bid);
                return board != null && (board.UserId == uid || context.BoardMembers.Any(m => m.BoardId == bid && m.UserId == uid));
            });

        var controller = new BoardController(context, mockBoardAccessService.Object, mockWebSocketService.Object);

        // Mock user identity
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString())
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var claimsPrincipal = new ClaimsPrincipal(identity);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = claimsPrincipal }
        };

        return controller;
    }

    [Fact]
    public async System.Threading.Tasks.Task GetBoards_ReturnsOwnedAndMemberBoards()
    {
        // Arrange
        var context = GetInMemoryDbContext();
        var user = new User { Id = 1, Email = "test@test.com", Username = "test", PasswordHash = "hash" };
        var ownedBoard = new Board { Id = 1, UserId = 1, Title = "Owned Board" };
        var otherBoard = new Board { Id = 2, UserId = 2, Title = "Other Board" };
        var memberBoard = new Board { Id = 3, UserId = 2, Title = "Member Board" };

        context.Users.Add(user);
        context.Boards.AddRange(ownedBoard, otherBoard, memberBoard);
        context.BoardMembers.Add(new BoardMember { BoardId = 3, UserId = 1, JoinedAt = DateTime.UtcNow });
        await context.SaveChangesAsync();

        var controller = CreateController(context, userId: 1);

        // Act
        var result = await controller.GetBoards();

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var boards = Assert.IsAssignableFrom<IEnumerable<BoardDto>>(okResult.Value);
        Assert.Equal(2, boards.Count()); // Owned + Member board
    }

    [Fact]
    public async System.Threading.Tasks.Task CreateBoard_Success()
    {
        // Arrange
        var context = GetInMemoryDbContext();
        var controller = CreateController(context, userId: 1);

        var request = new CreateBoardRequest { Title = "New Board" };

        // Act
        var result = await controller.CreateBoard(request);

        // Assert
        var createdResult = Assert.IsType<CreatedAtActionResult>(result.Result);
        var board = Assert.IsType<BoardDto>(createdResult.Value);
        Assert.Equal("New Board", board.Title);
        Assert.Equal(1, board.UserId);
    }

    [Fact]
    public async System.Threading.Tasks.Task UpdateBoard_WithAccess_Success()
    {
        // Arrange
        var context = GetInMemoryDbContext();
        var board = new Board { Id = 1, UserId = 1, Title = "Old Title" };
        context.Boards.Add(board);
        await context.SaveChangesAsync();

        var controller = CreateController(context, userId: 1);

        var request = new UpdateBoardRequest { Title = "New Title" };

        // Act
        var result = await controller.UpdateBoard(1, request);

        // Assert
        Assert.IsType<NoContentResult>(result);
        var updatedBoard = await context.Boards.FindAsync(1);
        Assert.Equal("New Title", updatedBoard!.Title);
    }

    [Fact]
    public async System.Threading.Tasks.Task InviteMember_ValidEmail_Success()
    {
        // Arrange
        var context = GetInMemoryDbContext();
        var owner = new User { Id = 1, Email = "owner@test.com", Username = "owner", PasswordHash = "hash" };
        var invitedUser = new User { Id = 2, Email = "invited@test.com", Username = "invited", PasswordHash = "hash" };
        var board = new Board { Id = 1, UserId = 1, Title = "Test Board" };

        context.Users.AddRange(owner, invitedUser);
        context.Boards.Add(board);
        await context.SaveChangesAsync();

        var controller = CreateController(context, userId: 1);

        var request = new InviteUserRequest { Email = "invited@test.com" };

        // Act
        var result = await controller.InviteBoardMember(1, request);

        // Assert
        Assert.IsType<OkResult>(result);
        var member = await context.BoardMembers.FirstOrDefaultAsync(m => m.BoardId == 1 && m.UserId == 2);
        Assert.NotNull(member);
    }
}
