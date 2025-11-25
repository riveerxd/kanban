using backend.Models;
using backend.Services;
using Microsoft.Extensions.Configuration;
using Moq;
using Xunit;

namespace backend.Tests.Services;

public class JwtServiceTests
{
    [Fact]
    public void GenerateToken_ReturnsValidTokenWithClaims()
    {
        // Arrange
        var configData = new Dictionary<string, string>
        {
            {"JwtSettings:Secret", "this-is-a-very-long-secret-key-for-testing-purposes-123456"},
            {"JwtSettings:Issuer", "TestIssuer"},
            {"JwtSettings:Audience", "TestAudience"},
            {"JwtSettings:ExpirationMinutes", "60"}
        };
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(configData!)
            .Build();

        var jwtService = new JwtService(configuration);
        var user = new User
        {
            Id = 1,
            Email = "test@example.com",
            Username = "testuser"
        };

        // Act
        var (token, expiresAt) = jwtService.GenerateToken(user);

        // Assert
        Assert.NotNull(token);
        Assert.NotEmpty(token);
        Assert.True(expiresAt > DateTime.UtcNow);
    }

    [Fact]
    public void GenerateToken_MissingConfig_ThrowsException()
    {
        // Arrange
        var configData = new Dictionary<string, string>
        {
            {"JwtSettings:Issuer", "TestIssuer"}
            // Missing Secret
        };
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(configData!)
            .Build();

        var jwtService = new JwtService(configuration);
        var user = new User
        {
            Id = 1,
            Email = "test@example.com",
            Username = "testuser"
        };

        // Act & Assert
        Assert.Throws<InvalidOperationException>(() => jwtService.GenerateToken(user));
    }
}
