using InternalApps.Api.Modules.Vacation;
using Npgsql;
using Xunit;

namespace InternalApps.Api.Tests;

public sealed class VacationLeaveBalanceAuthorizationTests
{
    [Fact]
    public void Permission_IsSeededAndAssignedIdempotently()
    {
        var migration = Read("database", "migrations",
            "035_vacation_leave_balance_management_permission.sql");

        Assert.Contains("VALUES ('vacation.leave-balances.manage')", migration);
        Assert.Contains("permissions.code = 'vacation.leave-balances.manage'", migration);
        Assert.Contains("WHERE roles.name = 'Administrator'", migration);
        Assert.Equal(2, Count(migration, "ON CONFLICT"));
    }

    [Fact]
    public void AffectedEndpointGroups_RequireTheVacationOwnedPolicy()
    {
        var ledger = Read("apps", "api", "src", "Api", "Modules", "Vacation",
            "LeaveBalanceLedgerEndpoints.cs");
        var policies = Read("apps", "api", "src", "Api", "Modules", "Vacation",
            "LeavePolicyEndpoints.cs");
        var program = Read("apps", "api", "src", "Api", "Program.cs");

        Assert.Equal("vacation.leave-balances.manage", VacationPermissions.ManageLeaveBalances);
        Assert.Contains("RequireAuthorization(VacationPermissions.ManageLeaveBalances)", ledger);
        Assert.Contains("RequireAuthorization(VacationPermissions.ManageLeaveBalances)", policies);
        Assert.DoesNotContain("IdentityPermissions.ManageUsers", ledger);
        Assert.DoesNotContain("IdentityPermissions.ManageUsers", policies);
        Assert.Contains("options.AddPolicy(\n        VacationPermissions.ManageLeaveBalances", program);
        Assert.Contains("VacationPermissions.ManageLeaveBalances));", program);
    }

    [Fact]
    public void Portal_UsesTheVacationOwnedPermissionForBothTabsAndRoutes()
    {
        var workspace = Read("apps", "portal", "src", "features", "vacation",
            "components", "vacation-workspace.tsx");
        var balanceType = Read("apps", "portal", "src", "types", "leave-balance.ts");
        var policyType = Read("apps", "portal", "src", "types", "leave-policy.ts");

        Assert.Contains("vacation.leave-balances.manage", balanceType);
        Assert.Contains("vacation.leave-balances.manage", policyType);
        Assert.Contains("permissions.includes(leaveBalanceManagePermission)", workspace);
        Assert.DoesNotContain("usersManagePermission", workspace);
        Assert.DoesNotContain("identity.users.manage", workspace);
        Assert.DoesNotContain("identity.users.manage", balanceType);
        Assert.DoesNotContain("identity.users.manage", policyType);
    }

    [Fact]
    public void RequestAdministration_RemainsOnItsExistingPermission()
    {
        var endpoints = Read("apps", "api", "src", "Api", "Modules", "Vacation",
            "LeaveRequestEndpoints.cs");
        var workspace = Read("apps", "portal", "src", "features", "vacation",
            "components", "vacation-workspace.tsx");

        Assert.Contains("RequireAuthorization(VacationPermissions.ManageRequests)", endpoints);
        Assert.Contains("permissions.includes(vacationRequestsManagePermission)", workspace);
    }

    [Fact]
    public async Task Migration_AssignsPermissionToAdministrator_WhenDatabaseTestsAreEnabled()
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
                  AND permissions.code = 'vacation.leave-balances.manage')
            """, connection);

        Assert.True((bool)(await command.ExecuteScalarAsync())!);
    }

    private static int Count(string source, string value) =>
        source.Split(value, StringSplitOptions.None).Length - 1;

    private static string Read(params string[] parts) =>
        File.ReadAllText(Path.Combine([RepositoryRoot(), .. parts]));

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
        Host = Required("DB_HOST"), Port = int.Parse(Required("DB_PORT")),
        Database = Required("DB_NAME"), Username = Required("DB_OWNER_USER"),
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

    private static string Required(string name) => Environment.GetEnvironmentVariable(name)
        ?? throw new InvalidOperationException($"{name} is required for database integration tests.");
}
