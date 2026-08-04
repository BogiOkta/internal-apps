using Dapper;
using InternalApps.Api.Modules.Organization;
using Npgsql;
using Xunit;

namespace InternalApps.Api.Tests;

public sealed class OrganizationEmployeeDeletionTests
{
    [Fact]
    public void DeleteContract_IsAdministratorProtectedAndUsesOnlyControlledFunction()
    {
        var endpoints = Read("apps", "api", "src", "Api", "Modules", "Organization", "OrganizationEndpoints.cs");
        var repository = Read("apps", "api", "src", "Api", "Modules", "Organization", "OrganizationRepository.cs");
        Assert.Contains("MapDelete(\"/employees/{publicId:guid}\"", endpoints);
        Assert.Contains("RequireAuthorization(OrganizationPermissions.ManageEmployees)", endpoints);
        Assert.Contains("employee_delete_conflict", endpoints);
        Assert.Contains("Results.NoContent()", endpoints);
        Assert.Contains("organization.delete_unreferenced_employee(@PublicId)", repository);
        Assert.DoesNotContain("DELETE FROM organization.employees", repository);
        Assert.DoesNotContain("CASCADE", repository, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void HardeningMigration_UsesOneDeclarativeMarkerAndMarkerFirstDelete()
    {
        var migration = Read("database", "migrations",
            "024_harden_organization_employee_deletion.sql") +
            Read("database", "migrations",
                "025_remember_organization_employee_dependencies.sql") +
            Read("database", "migrations",
                "026_upgrade_organization_employee_dependency_markers.sql") +
            Read("database", "migrations",
                "027_return_employee_dependency_names.sql");
        Assert.Contains("REVOKE DELETE", migration);
        Assert.Contains("ON organization.employees", migration);
        Assert.Contains("FROM internal_apps_app", migration);
        Assert.Contains("SECURITY DEFINER", migration);
        Assert.Contains("SET search_path = pg_catalog", migration);
        Assert.Contains("REVOKE ALL", migration);
        Assert.Contains("FROM PUBLIC", migration);
        Assert.Contains("GRANT EXECUTE", migration);
        Assert.Contains("TO internal_apps_app", migration);
        Assert.Contains("core.user_employee_links", migration);
        Assert.Contains("vacation.leave_requests", migration);
        Assert.Contains("vacation.leave_balances", migration);
        Assert.Contains("vacation.leave_policies", migration);
        Assert.Contains("vacation.leave_balance_entries", migration);
        Assert.Contains("audit.audit_events", migration);
        Assert.Contains("employee_delete_conflict", migration);
        Assert.Contains("organization.employee_protected_dependencies", migration);
        Assert.Contains("remember_employee_protected_dependency", migration);
        Assert.Contains("TG_ARGV[0]", migration);
        Assert.Contains("TG_ARGV[1]", migration);
        Assert.Contains("TG_ARGV[2]", migration);
        Assert.Contains("dependency_name", migration);
        Assert.Contains("DETAIL = v_dependency_names", migration);
        Assert.Equal(6, migration.Split("ON DELETE NO ACTION").Length - 1);

        var finalDeleteFunction = migration[migration.LastIndexOf(
            "CREATE OR REPLACE FUNCTION organization.delete_unreferenced_employee",
            StringComparison.Ordinal)..];
        Assert.DoesNotContain("core.user_employee_links", finalDeleteFunction);
        Assert.DoesNotContain("vacation.leave_requests", finalDeleteFunction);
        Assert.DoesNotContain("vacation.leave_balances", finalDeleteFunction);
        Assert.DoesNotContain("vacation.leave_policies", finalDeleteFunction);
        Assert.DoesNotContain("vacation.leave_balance_entries", finalDeleteFunction);
        Assert.DoesNotContain("audit.audit_events", finalDeleteFunction);
    }

    [Fact]
    public void Migration029_OmitsOnlyTheExactLegacySentinelWithoutWeakeningApiValidation()
    {
        var migration028 = Read("database", "migrations", "028_employee_delete_conflict_dependency_token.sql");
        var migration = Read("database", "migrations", "029_omit_legacy_employee_dependency_sentinel.sql");
        var service = Read("apps", "api", "src", "Api", "Modules", "Organization", "EmployeesService.cs");
        Assert.Contains("employee_delete_conflict:v1:", migration028);
        Assert.Contains("employee_delete_conflict:v1:", migration);
        Assert.Contains("string_agg", migration);
        Assert.Contains("<> 'Protected employee dependency'", migration);
        Assert.Contains("exact legacy sentinel", migration);
        Assert.Contains("MESSAGE = 'employee_delete_conflict'", migration);
        Assert.DoesNotContain("DETAIL", migration, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("DeleteConflictPrefix", service);
        Assert.Contains("ControlledDependencyNames", service);
        Assert.Contains("ParseDeleteConflictDependencies", service);
        Assert.Contains("dependencies.All", service);
        Assert.Contains("dependency.Length > 0", service);
        Assert.Contains("ControlledDependencyNames.Contains(dependency)", service);
        Assert.DoesNotContain("Protected employee dependency", service);
        Assert.DoesNotContain("exception.Detail", service, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void DeleteConflictParser_RejectsMalformedAndUnknownTokensAsAWhole()
    {
        var serviceType = typeof(EmployeesService);
        var parser = serviceType.GetMethod("ParseDeleteConflictDependencies",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)!;
        string[] Parse(string message) => (string[])parser.Invoke(null, [message])!;

        Assert.Equal(["Employee audit history"],
            Parse("employee_delete_conflict:v1:Employee audit history"));
        Assert.Empty(Parse("employee_delete_conflict:v1:Employee audit history|Uncontrolled internal marker"));
        Assert.Empty(Parse("employee_delete_conflict:v1:Employee audit history|"));
        Assert.Empty(Parse("employee_delete_conflict:v2:Employee audit history"));
        Assert.Empty(Parse("employee_delete_conflict"));
    }

    [Fact]
    public async Task EmployeeDeleteFunction_HandlesLegacyAndUnknownMarkers_InConfiguredSchema()
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("RUN_DATABASE_INTEGRATION_TESTS"),
                "true", StringComparison.OrdinalIgnoreCase))
            return;

        LoadRepositoryEnvironment();
        await using var dataSource = NpgsqlDataSource.Create(BuildOwnerConnectionString());
        await using var connection = await dataSource.OpenConnectionAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        try
        {
            var departmentId = await ScalarAsync<long>(connection, transaction, """
                SELECT id FROM organization.departments ORDER BY id LIMIT 1
                """);
            var specificOne = await InsertEmployeeAsync(connection, transaction, departmentId);
            await AddMarkerAsync(connection, transaction, specificOne.Id, "Protected employee dependency");
            await AddMarkerAsync(connection, transaction, specificOne.Id, "Employee audit history");
            Assert.Equal("employee_delete_conflict:v1:Employee audit history",
                await DeleteConflictAsync(connection, transaction, specificOne.PublicId));

            var specificMany = await InsertEmployeeAsync(connection, transaction, departmentId);
            await AddMarkerAsync(connection, transaction, specificMany.Id, "User employee link");
            await AddMarkerAsync(connection, transaction, specificMany.Id, "Protected employee dependency");
            await AddMarkerAsync(connection, transaction, specificMany.Id, "Employee audit history");
            Assert.Equal("employee_delete_conflict:v1:Employee audit history|User employee link",
                await DeleteConflictAsync(connection, transaction, specificMany.PublicId));

            var legacyOnly = await InsertEmployeeAsync(connection, transaction, departmentId);
            await AddMarkerAsync(connection, transaction, legacyOnly.Id, "Protected employee dependency");
            Assert.Equal("employee_delete_conflict",
                await DeleteConflictAsync(connection, transaction, legacyOnly.PublicId));

            var unknown = await InsertEmployeeAsync(connection, transaction, departmentId);
            await AddMarkerAsync(connection, transaction, unknown.Id, "Employee audit history");
            await AddMarkerAsync(connection, transaction, unknown.Id, "Uncontrolled internal marker");
            Assert.Equal("employee_delete_conflict:v1:Employee audit history|Uncontrolled internal marker",
                await DeleteConflictAsync(connection, transaction, unknown.PublicId));

            var unreferenced = await InsertEmployeeAsync(connection, transaction, departmentId);
            await using var command = new NpgsqlCommand(
                "SELECT organization.delete_unreferenced_employee(@publicId)", connection, transaction);
            command.Parameters.AddWithValue("publicId", unreferenced.PublicId);
            Assert.True((bool)(await command.ExecuteScalarAsync())!);
        }
        finally { await transaction.RollbackAsync(); }
    }

    [Fact]
    public async Task EmployeeForeignKeys_NeverUseCascade_InConfiguredSchema()
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("RUN_DATABASE_INTEGRATION_TESTS"),
                "true", StringComparison.OrdinalIgnoreCase))
            return;

        LoadRepositoryEnvironment();
        await using var dataSource = NpgsqlDataSource.Create(BuildRuntimeConnectionString());
        await using var connection = await dataSource.OpenConnectionAsync();
        var cascadingConstraints = (await connection.QueryAsync<string>("""
            SELECT constraints.conname
            FROM pg_catalog.pg_constraint AS constraints
            WHERE constraints.contype = 'f'
              AND constraints.confrelid = 'organization.employees'::regclass
              AND constraints.confdeltype = 'c'
            ORDER BY constraints.conname
            """)).ToArray();

        Assert.True(cascadingConstraints.Length == 0,
            $"Foreign keys referencing organization.employees must not cascade: {string.Join(", ", cascadingConstraints)}");
    }

    [Fact]
    public void ControlledDelete_NeverDeletesDependenciesOrCascades()
    {
        var migration = Read("database", "migrations",
            "025_remember_organization_employee_dependencies.sql") +
            Read("database", "migrations",
                "026_upgrade_organization_employee_dependency_markers.sql") +
            Read("database", "migrations",
                "027_return_employee_dependency_names.sql");
        Assert.Contains("DELETE FROM organization.employees", migration);
        Assert.DoesNotContain("DELETE FROM core.user_employee_links", migration);
        Assert.DoesNotContain("DELETE FROM vacation.", migration);
        Assert.DoesNotContain("DELETE FROM audit.", migration);
        Assert.DoesNotContain("CASCADE", migration, StringComparison.OrdinalIgnoreCase);

        var migrations = Directory.GetFiles(
            Path.Combine(RepositoryRoot(), "database", "migrations"), "*.sql")
            .Select(File.ReadAllText);
        foreach (var sql in migrations)
        {
            foreach (var employeeReference in sql.Split('\n')
                         .Where(line => line.Contains(
                             "REFERENCES organization.employees", StringComparison.OrdinalIgnoreCase)))
                Assert.DoesNotContain("CASCADE", employeeReference, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public void Migration026_UpgradesTheJournaledMigration025ShapeForwardOnly()
    {
        var migration025 = Read("database", "migrations",
            "025_remember_organization_employee_dependencies.sql");
        var migration026 = Read("database", "migrations",
            "026_upgrade_organization_employee_dependency_markers.sql");

        Assert.Contains("employee_id bigint PRIMARY KEY", migration025);
        Assert.DoesNotContain("dependency_name text", migration025);
        Assert.Contains("ADD COLUMN dependency_name", migration026);
        Assert.Contains("DROP CONSTRAINT employee_protected_dependencies_pkey", migration026);
        Assert.Contains("ADD CONSTRAINT pk_employee_protected_dependencies", migration026);
        var migration027 = Read("database", "migrations",
            "027_return_employee_dependency_names.sql");
        Assert.DoesNotContain("DETAIL = v_dependency_names", migration026);
        Assert.Contains("DETAIL = v_dependency_names", migration027);
    }

    [Fact]
    public void ReferencedEmployeesCanStillBeDeactivated()
    {
        var endpoints = Read("apps", "api", "src", "Api", "Modules",
            "Organization", "OrganizationEndpoints.cs");
        var service = Read("apps", "api", "src", "Api", "Modules",
            "Organization", "EmployeesService.cs");
        Assert.Contains("/employees/{publicId:guid}/deactivate", endpoints);
        Assert.Contains("SetActiveAsync", service);
    }

    [Fact]
    public void PortalContract_HasCompactGridSafeDependenciesAndConfirmedDelete()
    {
        var page = Read("apps", "portal", "src", "app", "(company)", "organization", "employees", "page.tsx");
        var grid = Read("apps", "portal", "src", "components", "admin-data-grid.tsx");
        var service = Read("apps", "portal", "src", "services", "organization.ts");
        Assert.Contains("employmentStartDate", page);
        Assert.Contains("employmentEndDate", page);
        Assert.Contains("AdministrativeGridShell", page);
        Assert.Contains("min-h-0 flex-1 overflow-auto", grid);
        Assert.Contains("min-w-[1160px]", page);
        Assert.Contains("isConfirmingDelete", page);
        Assert.Contains("isDeleting", page);
        Assert.Contains("disabled={isDeleting}", page);
        Assert.Contains("employee_delete_conflict", page);
        Assert.Contains("\"Employee audit history\"", page);
        Assert.Contains("dependencies?.map((dependency) => names[dependency]).filter(Boolean)", page);
        Assert.Contains("method: \"DELETE\"", service);
    }

    [Fact]
    public void DevelopmentReconciler_ExcludesDuplicateAndGuardsDestination()
    {
        var script = Read("scripts", "development", "seed-okta-organization-employees.ps1");
        Assert.Contains("APPROVED_DEVELOPMENT_DB_NAME", script);
        Assert.Contains("Where-Object { $_.employee_number -ne '1' }", script);
        Assert.Contains("employee_number='123'", script);
        Assert.Contains("vladimir.bogicevic@okta.rs", script);
        Assert.Contains("$legacyNumbers = @('1'", script);
        Assert.Contains("organization.employee_protected_dependencies", script);
    }

    private static string Read(params string[] parts)
    {
        return File.ReadAllText(Path.Combine([RepositoryRoot(), .. parts]));
    }

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "internal.ps1"))) directory = directory.Parent;
        return directory!.FullName;
    }

    private static void LoadRepositoryEnvironment()
    {
        foreach (var line in File.ReadAllLines(Path.Combine(RepositoryRoot(), ".env")))
        {
            var separator = line.IndexOf('=');
            if (separator <= 0 || line.TrimStart().StartsWith('#')) continue;
            var name = line[..separator].Trim();
            if (Environment.GetEnvironmentVariable(name) is null)
                Environment.SetEnvironmentVariable(name, line[(separator + 1)..].Trim());
        }
    }

    private static string Required(string name) =>
        Environment.GetEnvironmentVariable(name)
        ?? throw new InvalidOperationException($"{name} is required.");

    private static string BuildRuntimeConnectionString() =>
        new NpgsqlConnectionStringBuilder
        {
            Host = Required("DB_HOST"),
            Port = int.Parse(Required("DB_PORT")),
            Database = Required("DB_NAME"),
            Username = Required("APP_DB_USER"),
            Password = Required("APP_DB_PASSWORD"),
            SslMode = Enum.Parse<SslMode>(Required("DB_SSL_MODE"), true)
        }.ConnectionString;

    private static string BuildOwnerConnectionString() =>
        new NpgsqlConnectionStringBuilder
        {
            Host = Required("DB_HOST"),
            Port = int.Parse(Required("DB_PORT")),
            Database = Required("DB_NAME"),
            Username = Required("DB_OWNER_USER"),
            Password = Required("DB_OWNER_PASSWORD"),
            SslMode = Enum.Parse<SslMode>(Required("DB_SSL_MODE"), true)
        }.ConnectionString;

    private static async Task<T> ScalarAsync<T>(NpgsqlConnection connection,
        NpgsqlTransaction transaction, string sql)
    {
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        return (T)(await command.ExecuteScalarAsync())!;
    }

    private static async Task<(long Id, Guid PublicId)> InsertEmployeeAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, long departmentId)
    {
        await using var command = new NpgsqlCommand("""
            INSERT INTO organization.employees
                (employee_number, first_name, last_name, department_id, employment_status)
            VALUES ('TEST-' || left(gen_random_uuid()::text, 24),
                'Deletion', 'Fixture', @departmentId, 'Active')
            RETURNING id, public_id
            """, connection, transaction);
        command.Parameters.AddWithValue("departmentId", departmentId);
        await using var reader = await command.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        return (reader.GetInt64(0), reader.GetGuid(1));
    }

    private static async Task AddMarkerAsync(NpgsqlConnection connection,
        NpgsqlTransaction transaction, long employeeId, string dependencyName)
    {
        await using var command = new NpgsqlCommand("""
            INSERT INTO organization.employee_protected_dependencies (employee_id, dependency_name)
            VALUES (@employeeId, @dependencyName)
            """, connection, transaction);
        command.Parameters.AddWithValue("employeeId", employeeId);
        command.Parameters.AddWithValue("dependencyName", dependencyName);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<string> DeleteConflictAsync(NpgsqlConnection connection,
        NpgsqlTransaction transaction, Guid publicId)
    {
        await using (var savepoint = new NpgsqlCommand("SAVEPOINT delete_conflict", connection, transaction))
            await savepoint.ExecuteNonQueryAsync();
        await using var command = new NpgsqlCommand(
            "SELECT organization.delete_unreferenced_employee(@publicId)", connection, transaction);
        command.Parameters.AddWithValue("publicId", publicId);
        var exception = await Assert.ThrowsAsync<PostgresException>(() => command.ExecuteScalarAsync());
        await using (var rollback = new NpgsqlCommand("ROLLBACK TO SAVEPOINT delete_conflict", connection, transaction))
            await rollback.ExecuteNonQueryAsync();
        Assert.Equal("P0001", exception.SqlState);
        return exception.MessageText;
    }
}
