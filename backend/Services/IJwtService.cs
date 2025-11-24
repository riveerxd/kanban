using backend.Models;

namespace backend.Services;

/// <summary>
/// Interface for JWT token generation and validation.
/// </summary>
public interface IJwtService
{
    /// <summary>
    /// Generates a JWT token for the specified user.
    /// </summary>
    /// <param name="user">The user to generate a token for.</param>
    /// <returns>A tuple containing the JWT token and its expiration date.</returns>
    (string Token, DateTime ExpiresAt) GenerateToken(User user);
}
