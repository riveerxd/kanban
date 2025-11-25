using backend.Controllers;
using backend.Data;
using backend.DTOs;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using System.Security.Claims;
using Xunit;

namespace backend.Tests.Controllers;

public class TaskMovementTests
{
    private ApplicationDbContext GetInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new ApplicationDbContext(options);
    }

    private TaskController CreateController(ApplicationDbContext context, int userId = 1)
    {
        var mockBoardAccessService = new Mock<IBoardAccessService>();
        var mockWebSocketService = new Mock<IWebSocketService>();

        // Allow access to all boards for testing
        mockBoardAccessService.Setup(x => x.UserHasAccessToBoard(It.IsAny<int>(), It.IsAny<int>()))
            .ReturnsAsync(true);

        var controller = new TaskController(context, mockBoardAccessService.Object, mockWebSocketService.Object);

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
    public async System.Threading.Tasks.Task MoveTask_SameColumn_Reorders()
    {
        // Arrange
        var context = GetInMemoryDbContext();
        var board = new Board { Id = 1, UserId = 1, Title = "Test Board" };
        var column = new Column { Id = 1, BoardId = 1, Title = "To Do", Position = 0 };
        var task1 = new Models.Task { Id = 1, ColumnId = 1, Title = "Task 1", Position = 0 };
        var task2 = new Models.Task { Id = 2, ColumnId = 1, Title = "Task 2", Position = 1 };
        var task3 = new Models.Task { Id = 3, ColumnId = 1, Title = "Task 3", Position = 2 };

        context.Boards.Add(board);
        context.Columns.Add(column);
        context.Tasks.AddRange(task1, task2, task3);
        await context.SaveChangesAsync();

        var controller = CreateController(context);

        // Act - Move task 1 from position 0 to position 2
        var request = new MoveTaskRequest { ColumnId = 1, Position = 2 };
        var result = await controller.MoveTask(1, request);

        // Assert
        Assert.IsType<NoContentResult>(result);

        var updatedTask1 = await context.Tasks.FindAsync(1);
        var updatedTask2 = await context.Tasks.FindAsync(2);
        var updatedTask3 = await context.Tasks.FindAsync(3);

        Assert.Equal(2, updatedTask1!.Position);
        Assert.Equal(0, updatedTask2!.Position);
        Assert.Equal(1, updatedTask3!.Position);
    }

    [Fact]
    public async System.Threading.Tasks.Task MoveTask_DifferentColumn_Moves()
    {
        // Arrange
        var context = GetInMemoryDbContext();
        var board = new Board { Id = 1, UserId = 1, Title = "Test Board" };
        var column1 = new Column { Id = 1, BoardId = 1, Title = "To Do", Position = 0 };
        var column2 = new Column { Id = 2, BoardId = 1, Title = "In Progress", Position = 1 };
        var task1 = new Models.Task { Id = 1, ColumnId = 1, Title = "Task 1", Position = 0 };
        var task2 = new Models.Task { Id = 2, ColumnId = 1, Title = "Task 2", Position = 1 };
        var task3 = new Models.Task { Id = 3, ColumnId = 2, Title = "Task 3", Position = 0 };

        context.Boards.Add(board);
        context.Columns.AddRange(column1, column2);
        context.Tasks.AddRange(task1, task2, task3);
        await context.SaveChangesAsync();

        var controller = CreateController(context);

        // Act - Move task 1 from column 1 to column 2 at position 0
        var request = new MoveTaskRequest { ColumnId = 2, Position = 0 };
        var result = await controller.MoveTask(1, request);

        // Assert
        Assert.IsType<NoContentResult>(result);

        var updatedTask1 = await context.Tasks.FindAsync(1);
        var updatedTask2 = await context.Tasks.FindAsync(2);
        var updatedTask3 = await context.Tasks.FindAsync(3);

        // Task 1 should be in column 2 at position 0
        Assert.Equal(2, updatedTask1!.ColumnId);
        Assert.Equal(0, updatedTask1.Position);

        // Task 2 should move up in column 1
        Assert.Equal(0, updatedTask2!.Position);

        // Task 3 should move down in column 2
        Assert.Equal(1, updatedTask3!.Position);
    }
}
