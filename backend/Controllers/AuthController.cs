using backend.Data;
using backend.DTOs;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Serilog.Context;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IJwtService _jwtService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        ApplicationDbContext context,
        IJwtService jwtService,
        ILogger<AuthController> logger)
    {
        _context = context;
        _jwtService = jwtService;
        _logger = logger;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        if (await _context.Users.AnyAsync(u => u.Email == request.Email))
        {
            return BadRequest(new { message = "Email is already registered" });
        }

        if (await _context.Users.AnyAsync(u => u.Username == request.Username))
        {
            return BadRequest(new { message = "Username is already taken" });
        }

        var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

        var user = new User
        {
            Email = request.Email,
            Username = request.Username,
            PasswordHash = passwordHash,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        _logger.LogInformation("New user registered: {Username} ({Email})", user.Username, user.Email);

        var (token, expiresAt) = _jwtService.GenerateToken(user);

        var response = new AuthResponse
        {
            UserId = user.Id,
            Token = token,
            Email = user.Email,
            Username = user.Username,
            ExpiresAt = expiresAt
        };

        return CreatedAtAction(nameof(Register), response);
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        User? user;
        try
        {
            user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Database error during login");
            return StatusCode(503, new { message = "Database is currently unavailable" });
        }

        if (user == null)
        {
            return Unauthorized(new { message = "Invalid email or password" });
        }

        var isValidPassword = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);

        if (!isValidPassword)
        {
            _logger.LogWarning("Failed login attempt for email: {Email}", request.Email);
            return Unauthorized(new { message = "Invalid email or password" });
        }

        // Push user to log context so middleware sees it
        LogContext.PushProperty("UserId", user.Id);

        _logger.LogInformation("User logged in: {Username} ({Email})", user.Username, user.Email);

        var (token, expiresAt) = _jwtService.GenerateToken(user);

        var response = new AuthResponse
        {
            UserId = user.Id,
            Token = token,
            Email = user.Email,
            Username = user.Username,
            ExpiresAt = expiresAt
        };

        return Ok(response);
    }
}
