using System.Text;
using backend.Data;
using backend.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

// Load .env file from backend directory with Windows CRLF fix
var envPath = Path.Combine(Directory.GetCurrentDirectory(), ".env");
if (File.Exists(envPath))
{
    DotNetEnv.Env.Load(envPath);

    // Fix for Windows CRLF issue: Trim all environment variables to remove \r\n
    var envVars = new[] {
        "MYSQL_HOST", "MYSQL_PORT", "MYSQL_DATABASE", "MYSQL_USER", "MYSQL_PASSWORD",
        "BACKEND_HTTP_PORT", "BACKEND_HTTPS_PORT", "WS_PORT", "WS_HOST",
        "JWT_SECRET", "JWT_ISSUER", "JWT_AUDIENCE", "JWT_EXPIRATION_MINUTES",
        "FRONTEND_PORT"
    };

    foreach (var varName in envVars)
    {
        var value = Environment.GetEnvironmentVariable(varName);
        if (!string.IsNullOrEmpty(value))
        {
            // Trim CRLF and whitespace that DotNetEnv may include on Windows
            Environment.SetEnvironmentVariable(varName, value.Trim());
        }
    }

    Console.WriteLine($"Loaded .env file from: {envPath}");
}
else
{
    Console.WriteLine($"Warning: .env file not found at {envPath}");
}

var builder = WebApplication.CreateBuilder(args);

// Add environment variables to configuration so services can access them
builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
{
    ["JwtSettings:Secret"] = Environment.GetEnvironmentVariable("JWT_SECRET"),
    ["JwtSettings:Issuer"] = Environment.GetEnvironmentVariable("JWT_ISSUER") ?? "KanbanAPI",
    ["JwtSettings:Audience"] = Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? "KanbanClient",
    ["JwtSettings:ExpirationMinutes"] = Environment.GetEnvironmentVariable("JWT_EXPIRATION_MINUTES") ?? "1440",
});

// server port config from env or use default
var httpPort = Environment.GetEnvironmentVariable("BACKEND_HTTP_PORT") ?? "5283";

builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenAnyIP(int.Parse(httpPort));
});

// Build connection string from environment variables
var mysqlHost = Environment.GetEnvironmentVariable("MYSQL_HOST") ?? "localhost";
var mysqlPort = Environment.GetEnvironmentVariable("MYSQL_PORT") ?? "3306";
var mysqlDatabase = Environment.GetEnvironmentVariable("MYSQL_DATABASE") ?? "kanban_db";
var mysqlUser = Environment.GetEnvironmentVariable("MYSQL_USER") ?? "kanbanuser";
var mysqlPassword = Environment.GetEnvironmentVariable("MYSQL_PASSWORD") ?? "kanbanpass123";
var connectionString = $"Server={mysqlHost};Port={mysqlPort};Database={mysqlDatabase};User={mysqlUser};Password={mysqlPassword};";

// MySQL db setup
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseMySql(
        connectionString,
        new MySqlServerVersion(new Version(8, 0, 21))
    ));

// Register services
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IBoardAccessService, BoardAccessService>();
builder.Services.AddSingleton<IWebSocketService, WebSocketService>();
builder.Services.AddSingleton<ILockManager, LockManager>();

// JWT auth setup from environment variables
var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET");
if (string.IsNullOrWhiteSpace(jwtSecret))
{
    throw new InvalidOperationException("JWT_SECRET environment variable is not set or empty. Please check your backend/.env file.");
}

// Debug: Check for hidden characters
var secretBytes = Encoding.UTF8.GetBytes(jwtSecret);
Console.WriteLine($"JWT_SECRET debug - Length: {jwtSecret.Length}, Bytes: {secretBytes.Length}, First 10 chars: '{jwtSecret.Substring(0, Math.Min(10, jwtSecret.Length))}'");
if (jwtSecret.Length != 32)
{
    Console.WriteLine($"WARNING: JWT_SECRET should be 32 characters, but it's {jwtSecret.Length}. Checking for hidden characters...");
    Console.WriteLine($"Last char code: {(int)jwtSecret[jwtSecret.Length - 1]}");
}

var jwtIssuer = Environment.GetEnvironmentVariable("JWT_ISSUER") ?? "KanbanAPI";
var jwtAudience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? "KanbanClient";
Console.WriteLine($"JWT configured - Issuer: {jwtIssuer}, Audience: {jwtAudience}, Secret length: {jwtSecret.Length}");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

// CORS for frontend
var frontendPort = Environment.GetEnvironmentVariable("FRONTEND_PORT") ?? "3000";
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins($"http://localhost:{frontendPort}")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Start ws server
var wsService = app.Services.GetRequiredService<IWebSocketService>();
var wsPort = int.Parse(Environment.GetEnvironmentVariable("WS_PORT") ?? "8181");
await wsService.StartAsync(wsPort);

// Swagger for dev only
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Middleware pipeline
app.UseHttpsRedirection();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
