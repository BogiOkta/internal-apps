using System.Text;
using System.Reflection;
using DotNetEnv;
using InternalApps.Api.Applications;
using InternalApps.Api.Authentication;
using InternalApps.Api.Infrastructure;
using InternalApps.Api.Infrastructure.Auditing;
using InternalApps.Api.Modules.Organization;
using InternalApps.Api.Modules.Identity;
using InternalApps.Api.Modules.Vacation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

const string LocalPortalCorsPolicy = "LocalPortal";

var envPath = FindEnvironmentFile()
    ?? throw new InvalidOperationException(
        "Repository .env file was not found from the current or application directory.");
Env.Load(envPath);

var builder = WebApplication.CreateBuilder(args);
var jwtSettings = RuntimeConfiguration.GetJwtSettings();
var dataSource = RuntimeConfiguration.CreateDataSource();

builder.Services.AddProblemDetails();
builder.Services.AddSingleton(jwtSettings);
builder.Services.AddSingleton(dataSource);
builder.Services.AddScoped<ApplicationRepository>();
builder.Services.AddScoped<AuthRepository>();
builder.Services.AddScoped<OrganizationRepository>();
builder.Services.AddScoped<EmployeesService>();
builder.Services.AddScoped<UserEmployeeLinksRepository>();
builder.Services.AddScoped<UserEmployeeLinksService>();
builder.Services.AddScoped<CurrentEmployeeResolver>();
builder.Services.AddScoped<LeaveTypesRepository>();
builder.Services.AddScoped<LeaveTypesService>();
builder.Services.AddScoped<AuditWriter>();
builder.Services.AddScoped<UsersRepository>();
builder.Services.AddScoped<UsersService>();
builder.Services.AddSingleton<TokenService>();
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtSettings.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSettings.SigningKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(
        VacationPermissions.ManageLeaveTypes,
        policy => policy.RequireClaim(
            "permission",
            VacationPermissions.ManageLeaveTypes));
    options.AddPolicy(
        OrganizationPermissions.ManageEmployees,
        policy => policy.RequireClaim(
            "permission",
            OrganizationPermissions.ManageEmployees));
    options.AddPolicy(
        OrganizationPermissions.ManageUserEmployeeLinks,
        policy => policy.RequireClaim(
            "permission",
            OrganizationPermissions.ManageUserEmployeeLinks));
    options.AddPolicy(
        IdentityPermissions.ManageUsers,
        policy => policy.RequireClaim("permission", IdentityPermissions.ManageUsers));
});
builder.Services.AddCors(options =>
{
    options.AddPolicy(LocalPortalCorsPolicy, policy =>
    {
        var portalUrl = builder.Configuration["PORTAL_URL"] ?? "http://localhost:3000";
        policy
            .WithOrigins(portalUrl)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

app.UseExceptionHandler();
app.UseCors(LocalPortalCorsPolicy);
app.UseAuthentication();
app.UseAuthorization();

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

app.MapAuthenticationEndpoints();
app.MapCurrentEmployeeEndpoints();
app.MapApplicationEndpoints();
app.MapOrganizationEndpoints();
app.MapIdentityEndpoints();
app.MapVacationEndpoints();

app.Run();

static string? FindEnvironmentFile()
{
    var startPaths = new[]
    {
        Directory.GetCurrentDirectory(),
        AppContext.BaseDirectory
    };

    foreach (var startPath in startPaths.Distinct(StringComparer.OrdinalIgnoreCase))
    {
        var directory = new DirectoryInfo(Path.GetFullPath(startPath));

        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName, ".env");
            if (File.Exists(candidate))
            {
                return candidate;
            }

            directory = directory.Parent;
        }
    }

    return null;
}

public partial class Program;
