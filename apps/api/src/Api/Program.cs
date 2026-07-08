using System.Reflection;

const string LocalPortalCorsPolicy = "LocalPortal";

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddCors(options =>
{
    options.AddPolicy(LocalPortalCorsPolicy, policy =>
    {
        var portalUrl = builder.Configuration["PORTAL_URL"] ?? "http://localhost:3000";
        policy
            .WithOrigins(portalUrl)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseExceptionHandler();
app.UseCors(LocalPortalCorsPolicy);

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.MapGet("/api/v1/system/info", (IHostEnvironment environment) =>
{
    var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "unknown";

    return Results.Ok(new
    {
        applicationName = "Internal Apps Platform",
        environment = environment.EnvironmentName,
        version
    });
});

app.Run();

public partial class Program;
