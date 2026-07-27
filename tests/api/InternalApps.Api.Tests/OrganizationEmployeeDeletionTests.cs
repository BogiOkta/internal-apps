using Dapper;
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
        var page = Read("apps", "portal", "src", "app", "organization", "employees", "page.tsx");
        var service = Read("apps", "portal", "src", "services", "organization.ts");
        Assert.Contains("employmentStartDate", page);
        Assert.Contains("employmentEndDate", page);
        Assert.Contains("overflow-x-auto", page);
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
}
