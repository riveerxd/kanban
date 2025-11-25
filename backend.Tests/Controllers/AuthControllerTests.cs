using backend.Controllers;
using backend.Data;
using backend.DTOs;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace backend.Tests.Controllers;

public class AuthControllerTests
{
    private ApplicationDbContext GetInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    [Fact]
    public async System.Threading.Tasks.Task Register_ValidUser_Success()
    {
        // Arrange
        var context = GetInMemoryDbContext();
        var mockJwtService = new Mock<IJwtService>();
        var mockLogger = new Mock<ILogger<AuthController>>();

        mockJwtService.Setup(x => x.GenerateToken(It.IsAny<User>()))
            .Returns(("test-token", DateTime.UtcNow.AddHours(1)));

        var controller = new AuthController(context, mockJwtService.Object, mockLogger.Object);

        var request = new RegisterRequest
        {
            Email = "test@example.com",
            Username = "testuser",
            Password = "password123"
        };

        // Act
        var result = await controller.Register(request);

        // Assert
        var createdResult = Assert.IsType<CreatedAtActionResult>(result.Result);
        var response = Assert.IsType<AuthResponse>(createdResult.Value);
        Assert.Equal("test-token", response.Token);
        Assert.Equal("testuser", response.Username);
    }

    [Fact]
    public async System.Threading.Tasks.Task Register_DuplicateEmail_Fails()
    {
        // Arrange
        var context = GetInMemoryDbContext();
        var mockJwtService = new Mock<IJwtService>();
        var mockLogger = new Mock<ILogger<AuthController>>();

        // Add existing user
        context.Users.Add(new User
        {
            Email = "test@example.com",
            Username = "existing",
            PasswordHash = "hash"
        });
        await context.SaveChangesAsync();

        var controller = new AuthController(context, mockJwtService.Object, mockLogger.Object);

        var request = new RegisterRequest
        {
            Email = "test@example.com",
            Username = "newuser",
            Password = "password123"
        };

        // Act
        var result = await controller.Register(request);

        // Assert
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async System.Threading.Tasks.Task Register_DuplicateUsername_Fails()
    {
        // Arrange
        var context = GetInMemoryDbContext();
        var mockJwtService = new Mock<IJwtService>();
        var mockLogger = new Mock<ILogger<AuthController>>();

        // Add existing user
        context.Users.Add(new User
        {
            Email = "existing@example.com",
            Username = "testuser",
            PasswordHash = "hash"
        });
        await context.SaveChangesAsync();

        var controller = new AuthController(context, mockJwtService.Object, mockLogger.Object);

        var request = new RegisterRequest
        {
            Email = "new@example.com",
            Username = "testuser",
            Password = "password123"
        };

        // Act
        var result = await controller.Register(request);

        // Assert
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async System.Threading.Tasks.Task Login_ValidCredentials_Success()
    {
        // Arrange
        var context = GetInMemoryDbContext();
        var mockJwtService = new Mock<IJwtService>();
        var mockLogger = new Mock<ILogger<AuthController>>();

        var passwordHash = BCrypt.Net.BCrypt.HashPassword("password123");
        context.Users.Add(new User
        {
            Email = "test@example.com",
            Username = "testuser",
            PasswordHash = passwordHash
        });
        await context.SaveChangesAsync();

        mockJwtService.Setup(x => x.GenerateToken(It.IsAny<User>()))
            .Returns(("test-token", DateTime.UtcNow.AddHours(1)));

        var controller = new AuthController(context, mockJwtService.Object, mockLogger.Object);

        var request = new LoginRequest
        {
            Email = "test@example.com",
            Password = "password123"
        };

        // Act
        var result = await controller.Login(request);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<AuthResponse>(okResult.Value);
        Assert.Equal("test-token", response.Token);
    }

    [Fact]
    public async System.Threading.Tasks.Task Login_InvalidEmail_Unauthorized()
    {
        // Arrange
        var context = GetInMemoryDbContext();
        var mockJwtService = new Mock<IJwtService>();
        var mockLogger = new Mock<ILogger<AuthController>>();

        var controller = new AuthController(context, mockJwtService.Object, mockLogger.Object);

        var request = new LoginRequest
        {
            Email = "nonexistent@example.com",
            Password = "password123"
        };

        // Act
        var result = await controller.Login(request);

        // Assert
        Assert.IsType<UnauthorizedObjectResult>(result.Result);
    }

    [Fact]
    public async System.Threading.Tasks.Task Login_InvalidPassword_Unauthorized()
    {
        // Arrange
        var context = GetInMemoryDbContext();
        var mockJwtService = new Mock<IJwtService>();
        var mockLogger = new Mock<ILogger<AuthController>>();

        var passwordHash = BCrypt.Net.BCrypt.HashPassword("password123");
        context.Users.Add(new User
        {
            Email = "test@example.com",
            Username = "testuser",
            PasswordHash = passwordHash
        });
        await context.SaveChangesAsync();

        var controller = new AuthController(context, mockJwtService.Object, mockLogger.Object);

        var request = new LoginRequest
        {
            Email = "test@example.com",
            Password = "wrongpassword"
        };

        // Act
        var result = await controller.Login(request);

        // Assert
        Assert.IsType<UnauthorizedObjectResult>(result.Result);
    }
}
