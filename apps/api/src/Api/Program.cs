using System.Text;
using System.Reflection;
using Dapper;
using DotNetEnv;
using InternalApps.Api.Applications;
using InternalApps.Api.Authentication;
using InternalApps.Api.Core.BusinessCalendar;
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
Env.NoClobber().Load(envPath);
SqlMapper.AddTypeHandler(new DateOnlyTypeHandler());

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
builder.Services.AddScoped<DepartmentsService>();
builder.Services.AddScoped<UserEmployeeLinksRepository>();
builder.Services.AddScoped<UserEmployeeLinksService>();
builder.Services.AddScoped<CurrentEmployeeResolver>();
builder.Services.AddScoped<LeaveTypesRepository>();
builder.Services.AddScoped<LeaveTypesService>();
builder.Services.AddScoped<LeaveRequestsRepository>();
builder.Services.AddScoped<LeaveRequestService>();
builder.Services.AddScoped<LeavePoliciesRepository>();
builder.Services.AddScoped<LeavePoliciesService>();
builder.Services.AddScoped<LeaveBalanceLedgerRepository>();
builder.Services.AddScoped<LeaveBalanceLedgerService>();
builder.Services.AddScoped<AuditWriter>();
builder.Services.AddScoped<UsersRepository>();
builder.Services.AddScoped<UsersService>();
builder.Services.AddScoped<BusinessCalendarRepository>();
builder.Services.AddScoped<INonWorkingDayStore>(
    services => services.GetRequiredService<BusinessCalendarRepository>());
builder.Services.AddScoped<BusinessCalendarService>();
builder.Services.AddScoped<NonWorkingDaysService>();
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
        VacationPermissions.ManageLeaveBalances,
        policy => policy.RequireClaim(
            "permission",
            VacationPermissions.ManageLeaveBalances));
    options.AddPolicy(
        VacationPermissions.ManageRequests,
        policy => policy.RequireClaim(
            "permission",
            VacationPermissions.ManageRequests));
    options.AddPolicy(
        OrganizationPermissions.ManageEmployees,
        policy => policy.RequireClaim(
            "permission",
            OrganizationPermissions.ManageEmployees));
    options.AddPolicy(
        OrganizationPermissions.ManageDepartments,
        policy => policy.RequireClaim(
            "permission",
            OrganizationPermissions.ManageDepartments));
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
        var portalUrl = builder.Configuration["PORTAL_URL"];
        if (string.IsNullOrWhiteSpace(portalUrl) && builder.Environment.IsDevelopment())
        {
            var portalPort = builder.Configuration["DEV_PORTAL_PORT"]
                ?? throw new InvalidOperationException(
                    "DEV_PORTAL_PORT is required for local development.");
            portalUrl = $"http://localhost:{portalPort}";
        }

        if (string.IsNullOrWhiteSpace(portalUrl))
        {
            throw new InvalidOperationException(
                "PORTAL_URL is required outside local development.");
        }

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
app.MapLeaveRequestEndpoints();
app.MapLeavePolicyEndpoints();
app.MapLeaveBalanceLedgerEndpoints();
app.MapBusinessCalendarEndpoints();

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
