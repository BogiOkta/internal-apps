using Dapper;
using InternalApps.Api.Modules.Organization;
using Npgsql;
using Xunit;

namespace InternalApps.Api.Tests;

public sealed class OrganizationDepartmentAdministrationTests
{
    [Fact]
    public void EndpointContract_DeclaresDepartmentManagementRoutesWithPermission()
    {
        var endpoints = Read("apps", "api", "src", "Api", "Modules", "Organization", "OrganizationEndpoints.cs");
        Assert.Contains("MapPost(\"/departments\", CreateDepartmentAsync)", endpoints);
        Assert.Contains("MapPut(\"/departments/{publicId:guid}\", UpdateDepartmentAsync)", endpoints);
        Assert.Contains("MapDelete(\"/departments/{publicId:guid}\", DeleteDepartmentAsync)", endpoints);
        Assert.Contains("/departments/{publicId:guid}/activate", endpoints);
        Assert.Contains("/departments/{publicId:guid}/deactivate", endpoints);
        Assert.Contains("RequireAuthorization(OrganizationPermissions.ManageDepartments)", endpoints);
        Assert.Contains("department_delete_conflict", endpoints);
        Assert.Contains("Results.NoContent()", endpoints);
    }

    [Fact]
    public void DeleteContract_UsesOnlyTheControlledFunctionAndNeverDeletesEmployees()
    {
        var repository = Read("apps", "api", "src", "Api", "Modules", "Organization", "OrganizationRepository.cs");
        Assert.Contains("organization.delete_unreferenced_department(@PublicId)", repository);
        Assert.DoesNotContain("DELETE FROM organization.departments", repository);
        Assert.DoesNotContain("CASCADE", repository, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Migration030_GrantsLeastPrivilegeAndOwnsAControlledDeleteFunction()
    {
        var migration = Read("database", "migrations", "030_department_administration.sql");
        Assert.Contains("organization.departments.manage", migration);
        Assert.Contains("GRANT INSERT", migration);
        Assert.Contains("GRANT UPDATE", migration);
        Assert.Contains("GRANT USAGE", migration);
        Assert.Contains("organization.departments_id_seq", migration);
        Assert.Contains("SECURITY DEFINER", migration);
        Assert.Contains("SET search_path = pg_catalog", migration);
        Assert.Contains("REVOKE ALL", migration);
        Assert.Contains("FROM PUBLIC", migration);
        Assert.Contains("GRANT EXECUTE", migration);
        Assert.Contains("TO internal_apps_app", migration);
        Assert.Contains("department_delete_conflict:v1:Organization employee", migration);
        Assert.DoesNotContain("GRANT DELETE", migration);
        Assert.DoesNotContain("CASCADE", migration, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Models_KeepDepartmentCodeImmutableOnUpdate()
    {
        var models = Read("apps", "api", "src", "Api", "Modules", "Organization", "OrganizationModels.cs");
        var updateRequest = models[models.IndexOf("record UpdateDepartmentRequest", StringComparison.Ordinal)..];
        updateRequest = updateRequest[..updateRequest.IndexOf(");", StringComparison.Ordinal)];
        Assert.DoesNotContain("Code", updateRequest);
        Assert.Contains("string? Name", updateRequest);
    }

    [Fact]
    public void DeleteConflictParser_RejectsMalformedAndUnknownTokensAsAWhole()
    {
        var serviceType = typeof(DepartmentsService);
        var parser = serviceType.GetMethod("ParseDeleteConflictDependencies",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)!;
        string[] Parse(string message) => (string[])parser.Invoke(null, [message])!;

        Assert.Equal(["Organization employee"],
            Parse("department_delete_conflict:v1:Organization employee"));
        Assert.Empty(Parse("department_delete_conflict:v1:Organization employee|Uncontrolled internal marker"));
        Assert.Empty(Parse("department_delete_conflict:v1:Organization employee|"));
        Assert.Empty(Parse("department_delete_conflict:v2:Organization employee"));
        Assert.Empty(Parse("department_delete_conflict"));
    }

    [Fact]
    public async Task DepartmentDeleteFunction_ConflictsWhenReferencedAndSucceedsWhenUnreferenced_InConfiguredSchema()
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
            var referenced = await InsertDepartmentAsync(connection, transaction);
            await InsertEmployeeAsync(connection, transaction, referenced.Id);

            await using (var savepoint = new NpgsqlCommand("SAVEPOINT delete_conflict", connection, transaction))
                await savepoint.ExecuteNonQueryAsync();
            await using (var command = new NpgsqlCommand(
                "SELECT organization.delete_unreferenced_department(@publicId)", connection, transaction))
            {
                command.Parameters.AddWithValue("publicId", referenced.PublicId);
                var exception = await Assert.ThrowsAsync<PostgresException>(() => command.ExecuteScalarAsync());
                Assert.Equal("P0001", exception.SqlState);
                Assert.Equal("department_delete_conflict:v1:Organization employee", exception.MessageText);
            }
            await using (var rollback = new NpgsqlCommand("ROLLBACK TO SAVEPOINT delete_conflict", connection, transaction))
                await rollback.ExecuteNonQueryAsync();

            var unreferenced = await InsertDepartmentAsync(connection, transaction);
            await using var deleteCommand = new NpgsqlCommand(
                "SELECT organization.delete_unreferenced_department(@publicId)", connection, transaction);
            deleteCommand.Parameters.AddWithValue("publicId", unreferenced.PublicId);
            Assert.True((bool)(await deleteCommand.ExecuteScalarAsync())!);

            await using var missingCommand = new NpgsqlCommand(
                "SELECT organization.delete_unreferenced_department(@publicId)", connection, transaction);
            missingCommand.Parameters.AddWithValue("publicId", Guid.NewGuid());
            Assert.False((bool)(await missingCommand.ExecuteScalarAsync())!);
        }
        finally { await transaction.RollbackAsync(); }
    }

    [Fact]
    public async Task RuntimeRole_HasOnlyDocumentedDepartmentGrants_InConfiguredSchema()
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("RUN_DATABASE_INTEGRATION_TESTS"),
                "true", StringComparison.OrdinalIgnoreCase))
            return;

        LoadRepositoryEnvironment();
        await using var dataSource = NpgsqlDataSource.Create(BuildOwnerConnectionString());
        await using var connection = await dataSource.OpenConnectionAsync();

        var insertColumns = (await connection.QueryAsync<string>("""
            SELECT column_name FROM information_schema.column_privileges
            WHERE table_schema = 'organization' AND table_name = 'departments'
              AND grantee = 'internal_apps_app' AND privilege_type = 'INSERT'
            ORDER BY column_name
            """)).ToArray();
        Assert.Equal(["code", "is_active", "name", "public_id"], insertColumns);

        var updateColumns = (await connection.QueryAsync<string>("""
            SELECT column_name FROM information_schema.column_privileges
            WHERE table_schema = 'organization' AND table_name = 'departments'
              AND grantee = 'internal_apps_app' AND privilege_type = 'UPDATE'
            ORDER BY column_name
            """)).ToArray();
        Assert.Equal(["is_active", "name", "updated_at"], updateColumns);

        var canDeleteDirectly = await connection.ExecuteScalarAsync<bool>("""
            SELECT has_table_privilege('internal_apps_app', 'organization.departments', 'DELETE')
            """);
        Assert.False(canDeleteDirectly);

        var canExecuteFunction = await connection.ExecuteScalarAsync<bool>("""
            SELECT has_function_privilege('internal_apps_app',
                'organization.delete_unreferenced_department(uuid)', 'EXECUTE')
            """);
        Assert.True(canExecuteFunction);
    }

    private static string Read(params string[] parts) =>
        File.ReadAllText(Path.Combine([RepositoryRoot(), .. parts]));

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

    private static async Task<(long Id, Guid PublicId)> InsertDepartmentAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction)
    {
        await using var command = new NpgsqlCommand("""
            INSERT INTO organization.departments (code, name, is_active)
            VALUES ('TEST-' || left(gen_random_uuid()::text, 20), 'Deletion Fixture', true)
            RETURNING id, public_id
            """, connection, transaction);
        await using var reader = await command.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        return (reader.GetInt64(0), reader.GetGuid(1));
    }

    private static async Task InsertEmployeeAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, long departmentId)
    {
        await using var command = new NpgsqlCommand("""
            INSERT INTO organization.employees
                (employee_number, first_name, last_name, department_id, employment_status)
            VALUES ('TEST-' || left(gen_random_uuid()::text, 24),
                'Department', 'Fixture', @departmentId, 'Active')
            """, connection, transaction);
        command.Parameters.AddWithValue("departmentId", departmentId);
        await command.ExecuteNonQueryAsync();
    }
}
