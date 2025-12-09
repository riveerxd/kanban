using Serilog.Context;

namespace backend.Middleware;

public class CorrelationIdMiddleware
{
    private readonly RequestDelegate _next;
    private const string CorrelationIdHeader = "X-Correlation-Id";

    public CorrelationIdMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        string? correlationId = context.Request.Headers[CorrelationIdHeader].FirstOrDefault();

        if (string.IsNullOrEmpty(correlationId))
        {
            correlationId = GenerateShortId();
        }

        context.Items["CorrelationId"] = correlationId;
        context.Response.Headers[CorrelationIdHeader] = correlationId;

        using (LogContext.PushProperty("CorrelationId", correlationId))
        {
            await _next(context);
        }
    }

    private string GenerateShortId()
    {
        string fullGuid = Guid.NewGuid().ToString();
        string guidWithoutDashes = fullGuid.Replace("-", "");
        string shortId = guidWithoutDashes.Substring(0, 8);
        return shortId;
    }
}
