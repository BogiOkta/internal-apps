using InternalApps.Api.Modules.Vacation;
using Npgsql;
using Xunit;

namespace InternalApps.Api.Tests;

public sealed class VacationRequestAdministrationAuthorizationTests
{
    [Fact]
    public void AdministratorPermission_IsSeededAndAssignedByTheImmutableMigration()
    {
        var migration = ReadRepositoryFile("database", "migrations",
            "031_vacation_request_administration_permission.sql");

        Assert.Contains("VALUES ('vacation.requests.manage')", migration);
        Assert.Contains("permissions.code = 'vacation.requests.manage'", migration);
        Assert.Contains("WHERE roles.name = 'Administrator'", migration);
    }

    [Fact]
    public void RequestAdministration_UsesTheDedicatedPolicyInsteadOfUserManagement()
    {
        var endpoints = ReadRepositoryFile("apps", "api", "src", "Api", "Modules",
            "Vacation", "LeaveRequestEndpoints.cs");
        var program = ReadRepositoryFile("apps", "api", "src", "Api", "Program.cs");

        Assert.Equal("vacation.requests.manage", VacationPermissions.ManageRequests);
        Assert.Contains("RequireAuthorization(VacationPermissions.ManageRequests)", endpoints);
        Assert.DoesNotContain("IdentityPermissions.ManageUsers", endpoints);
        Assert.Contains("options.AddPolicy(\n        VacationPermissions.ManageRequests", program);
        Assert.Contains("VacationPermissions.ManageRequests));", program);
    }

    [Fact]
    public void RequestAdministrationList_TypesOptionalFiltersForPostgreSql()
    {
        var repository = ReadRepositoryFile("apps", "api", "src", "Api", "Modules",
            "Vacation", "LeaveRequestsRepository.cs");

        Assert.Contains("parameters.Add(\"EmployeeId\", query.EmployeeId, DbType.Guid);", repository);
        Assert.Contains("parameters.Add(\"DateFrom\", query.DateFrom, DbType.Date);", repository);
        Assert.Contains("parameters.Add(\"SearchPattern\", string.IsNullOrWhiteSpace(query.Search)", repository);
    }

    [Fact]
    public async Task Migration_SeedsTheAdministratorRequestManagementPermission()
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("RUN_DATABASE_INTEGRATION_TESTS"),
                "true", StringComparison.OrdinalIgnoreCase))
            return;

        LoadRepositoryEnvironment();
        await using var connection = new NpgsqlConnection(BuildOwnerConnectionString());
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand("""
            SELECT EXISTS (
                SELECT 1
                FROM identity.role_permissions AS role_permissions
                INNER JOIN identity.roles AS roles ON roles.id = role_permissions.role_id
                INNER JOIN identity.permissions AS permissions
                    ON permissions.id = role_permissions.permission_id
                WHERE roles.name = 'Administrator'
                  AND permissions.code = 'vacation.requests.manage')
            """, connection);

        Assert.True((bool)(await command.ExecuteScalarAsync())!);
    }

    [Fact]
    public void Portal_RequestAdministrationNavigationAndRoutesUseTheDedicatedPermission()
    {
        var navigation = ReadRepositoryFile("apps", "portal", "src", "navigation",
            "vacation.ts");
        var list = ReadRepositoryFile("apps", "portal", "src", "features", "vacation",
            "components", "admin-vacation-request-list.tsx");
        var details = ReadRepositoryFile("apps", "portal", "src", "features", "vacation",
            "components", "admin-vacation-request-details.tsx");
        var types = ReadRepositoryFile("apps", "portal", "src", "types", "vacation.ts");

        Assert.Contains("vacation.requests.manage", types);
        Assert.Contains("vacation.requests.delete", types);
        Assert.Contains("requiredPermission: vacationRequestsManagePermission", navigation);
        Assert.Contains("permissions.includes(vacationRequestsManagePermission)", list);
        Assert.Contains("permissions.includes(vacationRequestsManagePermission)", details);
        Assert.Contains("permissions.includes(vacationRequestsDeletePermission)", details);
    }

    private static string ReadRepositoryFile(params string[] parts)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "internal.ps1")))
            directory = directory.Parent;
        Assert.NotNull(directory);
        return File.ReadAllText(Path.Combine([directory!.FullName, .. parts]));
    }

    private static void LoadRepositoryEnvironment()
    {
        foreach (var line in File.ReadLines(Path.Combine(RepositoryRoot(), ".env")))
        {
            if (string.IsNullOrWhiteSpace(line) || line.TrimStart().StartsWith('#')) continue;
            var separator = line.IndexOf('=');
            if (separator <= 0) continue;
            var name = line[..separator].Trim();
            if (Environment.GetEnvironmentVariable(name) is null)
                Environment.SetEnvironmentVariable(name, line[(separator + 1)..].Trim());
        }
    }

    private static string BuildOwnerConnectionString() => new NpgsqlConnectionStringBuilder
    {
        Host = Required("DB_HOST"),
        Port = int.Parse(Required("DB_PORT")),
        Database = Required("DB_NAME"),
        Username = Required("DB_OWNER_USER"),
        Password = Required("DB_OWNER_PASSWORD"),
        SslMode = Enum.Parse<SslMode>(Required("DB_SSL_MODE"), true)
    }.ConnectionString;

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "internal.ps1")))
            directory = directory.Parent;
        return directory?.FullName ?? throw new DirectoryNotFoundException("Repository root was not found.");
    }

    private static string Required(string name) =>
        Environment.GetEnvironmentVariable(name)
        ?? throw new InvalidOperationException($"{name} is required for database integration tests.");
}
