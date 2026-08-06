using Dapper;
using InternalApps.Api.Modules.Vacation;
using Npgsql;
using Xunit;

namespace InternalApps.Api.Tests;

public sealed class VacationLeaveTypeAdministrationTests
{
    [Fact]
    public void EndpointContract_DeclaresLeaveTypeManagementRoutesWithTheExistingPermission()
    {
        var endpoints = Read("apps", "api", "src", "Api", "Modules", "Vacation", "VacationEndpoints.cs");
        Assert.Contains("MapPost(\"/leave-types\", CreateLeaveTypeAsync)", endpoints);
        Assert.Contains("MapPut(\"/leave-types/{publicId:guid}\", UpdateLeaveTypeAsync)", endpoints);
        Assert.Contains("MapDelete(\"/leave-types/{publicId:guid}\", DeleteLeaveTypeAsync)", endpoints);
        Assert.Contains("/leave-types/{publicId:guid}/activate", endpoints);
        Assert.Contains("/leave-types/{publicId:guid}/deactivate", endpoints);
        Assert.Contains("RequireAuthorization(VacationPermissions.ManageLeaveTypes)", endpoints);
        Assert.Contains("RequireAuthorization(VacationPermissions.DeleteLeaveTypes)", endpoints);
        Assert.Contains("leave_type_delete_conflict", endpoints);
        Assert.Contains("leave_type_system_protected", endpoints);
        Assert.Contains("Results.NoContent()", endpoints);

        var permissions = Read("apps", "api", "src", "Api", "Modules", "Vacation", "VacationPermissions.cs");
        Assert.Contains("\"vacation.leave-types.manage\"", permissions);
        Assert.Contains("\"vacation.leave-types.delete\"", permissions);
    }

    [Fact]
    public void DeleteContract_UsesOnlyTheControlledFunctionAndNeverDeletesDependentRows()
    {
        var repository = Read("apps", "api", "src", "Api", "Modules", "Vacation", "LeaveTypesRepository.cs");
        Assert.Contains("vacation.delete_unreferenced_leave_type(@PublicId)", repository);
        Assert.DoesNotContain("DELETE FROM vacation.leave_types", repository);
        Assert.DoesNotContain("DELETE FROM vacation.leave_requests", repository);
        Assert.DoesNotContain("DELETE FROM vacation.leave_balances", repository);
        Assert.DoesNotContain("DELETE FROM vacation.leave_balance_entries", repository);
        Assert.DoesNotContain("CASCADE", repository, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Migration032_GrantsLeastPrivilegeAndOwnsAControlledDeleteFunction()
    {
        var migration = Read("database", "migrations", "032_vacation_leave_type_administration.sql");
        Assert.Contains("vacation.leave-types.manage", migration);
        Assert.Contains("GRANT UPDATE (requires_balance)", migration);
        Assert.Contains("SECURITY DEFINER", migration);
        Assert.Contains("SET search_path = pg_catalog", migration);
        Assert.Contains("REVOKE ALL", migration);
        Assert.Contains("FROM PUBLIC", migration);
        Assert.Contains("GRANT EXECUTE", migration);
        Assert.Contains("TO internal_apps_app", migration);
        Assert.Contains("leave_type_delete_conflict:v1:", migration);
        Assert.Contains("'Vacation leave request'", migration);
        Assert.Contains("'Vacation leave balance'", migration);
        Assert.Contains("'Vacation leave balance entry'", migration);
        Assert.DoesNotContain("GRANT DELETE", migration);
        Assert.DoesNotContain("CASCADE", migration, StringComparison.OrdinalIgnoreCase);

        // The permission is reused, never re-seeded, and no new permission is introduced.
        Assert.DoesNotContain("INSERT INTO identity.permissions", migration);
        Assert.DoesNotContain("INSERT INTO identity.role_permissions", migration);
    }

    [Fact]
    public void Models_KeepLeaveTypeCodeImmutableOnUpdate()
    {
        var models = Read("apps", "api", "src", "Api", "Modules", "Vacation", "LeaveTypesModels.cs");
        var updateRequest = models[models.IndexOf("record UpdateLeaveTypeRequest", StringComparison.Ordinal)..];
        updateRequest = updateRequest[..updateRequest.IndexOf(");", StringComparison.Ordinal)];
        Assert.DoesNotContain("Code", updateRequest);
        Assert.Contains("bool? RequiresBalance", updateRequest);
        Assert.DoesNotContain("IsActive", updateRequest);
    }

    [Fact]
    public void DeleteConflictParser_RejectsMalformedAndUnknownTokensAsAWhole()
    {
        var parser = typeof(LeaveTypesService).GetMethod(
            "ParseDeleteConflictDependencies",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)!;
        string[] Parse(string message) => (string[])parser.Invoke(null, [message])!;

        Assert.Equal(
            ["Vacation leave request"],
            Parse("leave_type_delete_conflict:v1:Vacation leave request"));
        Assert.Equal(
            ["Vacation leave request", "Vacation leave balance", "Vacation leave balance entry"],
            Parse("leave_type_delete_conflict:v1:Vacation leave request|Vacation leave balance|Vacation leave balance entry"));
        Assert.Empty(Parse("leave_type_delete_conflict:v1:Vacation leave request|Uncontrolled internal marker"));
        Assert.Empty(Parse("leave_type_delete_conflict:v1:Vacation leave request|"));
        Assert.Empty(Parse("leave_type_delete_conflict:v2:Vacation leave request"));
        Assert.Empty(Parse("leave_type_delete_conflict"));
    }

    [Fact]
    public void LockedFieldRule_RejectsChangedBalanceBehaviourOnlyWhileInUse()
    {
        var validate = typeof(LeaveTypesService).GetMethod(
            "ValidateLockedFields",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)!;

        Dictionary<string, string[]> Validate(bool isInUse, bool countsAgainst, bool requiresBalance)
        {
            var previous = new LeaveTypeRecord(
                Guid.NewGuid(), "ANNUAL_LEAVE", "Godišnji odmor", "Annual leave",
                null, null, null,
                CountsAgainstVacationBalance: true,
                RequiresBalance: true,
                RequiresApproval: true,
                IsActive: true,
                IsSystem: true,
                DisplayOrder: 10,
                IsInUse: isInUse);
            var command = new UpdateLeaveTypeCommand(
                "Godišnji odmor", "Annual leave", null, null, null,
                countsAgainst, requiresBalance, RequiresApproval: true, DisplayOrder: 10);
            return (Dictionary<string, string[]>)validate.Invoke(null, [previous, command])!;
        }

        // Unused leave types accept every balance-behaviour change.
        Assert.Empty(Validate(isInUse: false, countsAgainst: false, requiresBalance: false));

        // Used leave types accept only the persisted values.
        Assert.Empty(Validate(isInUse: true, countsAgainst: true, requiresBalance: true));
        Assert.Equal(
            ["countsAgainstVacationBalance"],
            Validate(isInUse: true, countsAgainst: false, requiresBalance: true).Keys);
        Assert.Equal(
            ["requiresBalance"],
            Validate(isInUse: true, countsAgainst: true, requiresBalance: false).Keys);
        Assert.Equal(2, Validate(isInUse: true, countsAgainst: false, requiresBalance: false).Count);
    }

    [Fact]
    public void UsageProjection_DerivesInUseFromAllThreeReferencingTables()
    {
        var repository = Read("apps", "api", "src", "Api", "Modules", "Vacation", "LeaveTypesRepository.cs");
        Assert.Contains("vacation.leave_requests AS used_requests", repository);
        Assert.Contains("vacation.leave_balances AS used_balances", repository);
        Assert.Contains("vacation.leave_balance_entries AS used_entries", repository);
        Assert.Contains("AS IsInUse", repository);
    }

    [Fact]
    public async Task LeaveTypeDeleteFunction_ConflictsWhenReferencedAndSucceedsWhenUnreferenced_InConfiguredSchema()
    {
        if (!DatabaseIntegrationEnabled()) return;

        LoadRepositoryEnvironment();
        await using var dataSource = NpgsqlDataSource.Create(BuildOwnerConnectionString());
        await using var connection = await dataSource.OpenConnectionAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        try
        {
            var employeeId = await InsertEmployeeAsync(connection, transaction);

            // A leave type referenced by a leave request conflicts with its dependency label.
            var referencedByRequest = await InsertLeaveTypeAsync(connection, transaction);
            await InsertLeaveRequestAsync(connection, transaction, employeeId, referencedByRequest.Id);
            await AssertConflictAsync(
                connection, transaction, referencedByRequest.PublicId,
                "leave_type_delete_conflict:v1:Vacation leave request");

            // A leave type referenced only by a yearly balance conflicts with its own label.
            var referencedByBalance = await InsertLeaveTypeAsync(connection, transaction);
            await InsertLeaveBalanceAsync(connection, transaction, employeeId, referencedByBalance.Id);
            await AssertConflictAsync(
                connection, transaction, referencedByBalance.PublicId,
                "leave_type_delete_conflict:v1:Vacation leave balance");

            // A never-referenced leave type is physically deleted.
            var unreferenced = await InsertLeaveTypeAsync(connection, transaction);
            await using (var deleteCommand = new NpgsqlCommand(
                "SELECT vacation.delete_unreferenced_leave_type(@publicId)", connection, transaction))
            {
                deleteCommand.Parameters.AddWithValue("publicId", unreferenced.PublicId);
                Assert.True((bool)(await deleteCommand.ExecuteScalarAsync())!);
            }

            await using var missingCommand = new NpgsqlCommand(
                "SELECT vacation.delete_unreferenced_leave_type(@publicId)", connection, transaction);
            missingCommand.Parameters.AddWithValue("publicId", Guid.NewGuid());
            Assert.False((bool)(await missingCommand.ExecuteScalarAsync())!);
        }
        finally { await transaction.RollbackAsync(); }
    }

    [Fact]
    public async Task RuntimeRole_HasOnlyDocumentedLeaveTypeGrants_InConfiguredSchema()
    {
        if (!DatabaseIntegrationEnabled()) return;

        LoadRepositoryEnvironment();
        await using var dataSource = NpgsqlDataSource.Create(BuildOwnerConnectionString());
        await using var connection = await dataSource.OpenConnectionAsync();

        var updateColumns = (await connection.QueryAsync<string>("""
            SELECT column_name FROM information_schema.column_privileges
            WHERE table_schema = 'vacation' AND table_name = 'leave_types'
              AND grantee = 'internal_apps_app' AND privilege_type = 'UPDATE'
            ORDER BY column_name
            """)).ToArray();
        Assert.Equal(
            [
                "calendar_color", "counts_against_vacation_balance", "description_en",
                "description_sr", "display_order", "is_active", "name_en", "name_sr",
                "requires_approval", "requires_balance", "updated_at"
            ],
            updateColumns);

        var canDeleteDirectly = await connection.ExecuteScalarAsync<bool>("""
            SELECT has_table_privilege('internal_apps_app', 'vacation.leave_types', 'DELETE')
            """);
        Assert.False(canDeleteDirectly);

        var canExecuteFunction = await connection.ExecuteScalarAsync<bool>("""
            SELECT has_function_privilege('internal_apps_app',
                'vacation.delete_unreferenced_leave_type(uuid)', 'EXECUTE')
            """);
        Assert.True(canExecuteFunction);

        var isSecurityDefiner = await connection.ExecuteScalarAsync<bool>("""
            SELECT prosecdef FROM pg_proc
            WHERE oid = 'vacation.delete_unreferenced_leave_type(uuid)'::regprocedure
            """);
        Assert.True(isSecurityDefiner);
    }

    private static async Task AssertConflictAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid leaveTypePublicId,
        string expectedMessage)
    {
        await using (var savepoint = new NpgsqlCommand(
            "SAVEPOINT leave_type_delete_conflict", connection, transaction))
        {
            await savepoint.ExecuteNonQueryAsync();
        }

        await using (var command = new NpgsqlCommand(
            "SELECT vacation.delete_unreferenced_leave_type(@publicId)", connection, transaction))
        {
            command.Parameters.AddWithValue("publicId", leaveTypePublicId);
            var exception = await Assert.ThrowsAsync<PostgresException>(() => command.ExecuteScalarAsync());
            Assert.Equal("P0001", exception.SqlState);
            Assert.Equal(expectedMessage, exception.MessageText);
        }

        await using var rollback = new NpgsqlCommand(
            "ROLLBACK TO SAVEPOINT leave_type_delete_conflict", connection, transaction);
        await rollback.ExecuteNonQueryAsync();
    }

    private static bool DatabaseIntegrationEnabled() =>
        string.Equals(
            Environment.GetEnvironmentVariable("RUN_DATABASE_INTEGRATION_TESTS"),
            "true",
            StringComparison.OrdinalIgnoreCase);

    private static async Task<(long Id, Guid PublicId)> InsertLeaveTypeAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction)
    {
        await using var command = new NpgsqlCommand("""
            INSERT INTO vacation.leave_types
                (code, name_sr, name_en, counts_against_vacation_balance,
                 requires_balance, requires_approval, is_active, display_order)
            VALUES ('TEST_' || upper(replace(left(gen_random_uuid()::text, 12), '-', '_')),
                'Test vrsta', 'Test type', false, false, true, true, 900)
            RETURNING id, public_id
            """, connection, transaction);
        await using var reader = await command.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        return (reader.GetInt64(0), reader.GetGuid(1));
    }

    private static async Task<long> InsertEmployeeAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction)
    {
        await using var command = new NpgsqlCommand("""
            INSERT INTO organization.employees
                (employee_number, first_name, last_name, department_id, employment_status)
            SELECT 'TEST-' || left(gen_random_uuid()::text, 24),
                'Leave type', 'Fixture', departments.id, 'Active'
            FROM organization.departments AS departments
            ORDER BY departments.id
            LIMIT 1
            RETURNING id
            """, connection, transaction);
        return (long)(await command.ExecuteScalarAsync())!;
    }

    private static async Task InsertLeaveRequestAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        long employeeId, long leaveTypeId)
    {
        await using var command = new NpgsqlCommand("""
            WITH new_identity AS (
                INSERT INTO vacation.leave_request_identities DEFAULT VALUES
                RETURNING id, public_id
            )
            INSERT INTO vacation.leave_requests
                (id, public_id, employee_id, leave_type_id, date_from, date_to, working_days, status,
                 created_by_user_id)
            SELECT new_identity.id, new_identity.public_id,
                @employeeId, @leaveTypeId, DATE '2999-03-01', DATE '2999-03-01', 1,
                'SUBMITTED', users.id
            FROM new_identity
            CROSS JOIN identity.users AS users
            ORDER BY users.id
            LIMIT 1
            """, connection, transaction);
        command.Parameters.AddWithValue("employeeId", employeeId);
        command.Parameters.AddWithValue("leaveTypeId", leaveTypeId);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task InsertLeaveBalanceAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        long employeeId, long leaveTypeId)
    {
        await using var command = new NpgsqlCommand("""
            INSERT INTO vacation.leave_balances (employee_id, leave_type_id, year)
            VALUES (@employeeId, @leaveTypeId, 2999)
            """, connection, transaction);
        command.Parameters.AddWithValue("employeeId", employeeId);
        command.Parameters.AddWithValue("leaveTypeId", leaveTypeId);
        await command.ExecuteNonQueryAsync();
    }

    private static string Read(params string[] parts) =>
        File.ReadAllText(Path.Combine([RepositoryRoot(), .. parts]));

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null &&
               !File.Exists(Path.Combine(directory.FullName, "internal.ps1")))
        {
            directory = directory.Parent;
        }

        Assert.NotNull(directory);
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
}
