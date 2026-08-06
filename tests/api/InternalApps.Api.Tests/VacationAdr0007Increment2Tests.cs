using Dapper;
using Npgsql;
using Xunit;

namespace InternalApps.Api.Tests;

public sealed class VacationAdr0007Increment2Tests
{
    [Fact]
    public void PermissionDefinitions_AreRegisteredWithoutChangingEndpointAuthorization()
    {
        var permissions = Read("apps", "api", "src", "Api", "Modules", "Vacation",
            "VacationPermissions.cs");
        var program = Read("apps", "api", "src", "Api", "Program.cs");
        var requestEndpoints = Read("apps", "api", "src", "Api", "Modules", "Vacation",
            "LeaveRequestEndpoints.cs");
        var vacationEndpoints = Read("apps", "api", "src", "Api", "Modules", "Vacation",
            "VacationEndpoints.cs");

        Assert.Contains("vacation.requests.delete", permissions);
        Assert.Contains("vacation.leave-types.delete", permissions);
        Assert.Contains("VacationPermissions.DeleteRequests", program);
        Assert.Contains("VacationPermissions.DeleteLeaveTypes", program);
        Assert.DoesNotContain("VacationPermissions.DeleteRequests", requestEndpoints);
        Assert.DoesNotContain("VacationPermissions.DeleteLeaveTypes", vacationEndpoints);
        Assert.DoesNotContain("/delete", requestEndpoints);
        Assert.Contains("RequireAuthorization(VacationPermissions.ManageLeaveTypes)", vacationEndpoints);
    }

    [Fact]
    public void Migrations_AreForwardOnlyLeastPrivilegeAndUseFixedConflictTokens()
    {
        var permissions = Read("database", "migrations", "040_vacation_delete_permissions.sql");
        var function = Read("database", "migrations",
            "041_vacation_delete_neutralized_leave_request.sql");

        Assert.Contains("ON CONFLICT (code) DO NOTHING", permissions);
        Assert.Contains("ON CONFLICT (role_id, permission_id) DO NOTHING", permissions);
        Assert.Contains("WHERE roles.name = 'Administrator'", permissions);
        Assert.DoesNotContain("vacation.requests.manage", permissions);
        Assert.DoesNotContain("vacation.leave-types.manage", permissions);
        Assert.DoesNotContain("vacation.leave-balances.manage", permissions);
        Assert.DoesNotContain("identity.", permissions.Replace("identity.permissions", "")
            .Replace("identity.roles", "").Replace("identity.role_permissions", ""));

        Assert.Contains("SECURITY DEFINER", function);
        Assert.Contains("SET search_path = pg_catalog", function);
        Assert.Contains("OWNER TO internal_apps_owner", function);
        Assert.Contains("FROM PUBLIC", function);
        Assert.Contains("TO internal_apps_app", function);
        Assert.Contains("non_terminal_status", function);
        Assert.Contains("ledger_effect_not_zero", function);
        Assert.Contains("protected_dependency", function);
        Assert.True(function.IndexOf("DELETE FROM vacation.leave_request_history",
            StringComparison.Ordinal) < function.IndexOf("DELETE FROM vacation.leave_requests",
            StringComparison.Ordinal));
        Assert.DoesNotContain("COMMIT", function, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("GRANT DELETE", function, StringComparison.OrdinalIgnoreCase);
        foreach (var protectedTable in new[]
        {
            "vacation.leave_balance_entries", "vacation.leave_balances",
            "vacation.leave_policies", "vacation.leave_request_identities",
            "vacation.leave_type_protected_dependencies", "organization.",
            "identity.", "audit."
        })
        {
            Assert.DoesNotContain($"DELETE FROM {protectedTable}", function,
                StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain($"UPDATE {protectedTable}", function,
                StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public async Task PermissionRows_AreAdministratorOnly_WhenDatabaseTestsAreEnabled()
    {
        if (!DatabaseIntegrationEnabled()) return;
        await using var connection = await OpenOwnerConnectionAsync();
        var assignments = (await connection.QueryAsync<(string Permission, string Role)>("""
            SELECT permissions.code AS Permission, roles.name AS Role
            FROM identity.permissions AS permissions
            LEFT JOIN identity.role_permissions AS role_permissions
              ON role_permissions.permission_id = permissions.id
            LEFT JOIN identity.roles AS roles ON roles.id = role_permissions.role_id
            WHERE permissions.code IN ('vacation.requests.delete', 'vacation.leave-types.delete')
            ORDER BY permissions.code, roles.name
            """)).ToArray();

        Assert.Equal(2, assignments.Length);
        Assert.All(assignments, assignment => Assert.Equal("Administrator", assignment.Role));
        Assert.Equal(["vacation.leave-types.delete", "vacation.requests.delete"],
            assignments.Select(assignment => assignment.Permission).ToArray());
    }

    [Fact]
    public async Task ControlledFunction_HasTheRequiredSecurityBoundary_WhenDatabaseTestsAreEnabled()
    {
        if (!DatabaseIntegrationEnabled()) return;
        await using var connection = await OpenOwnerConnectionAsync();
        var metadata = await connection.QuerySingleAsync<(bool SecurityDefiner, string Owner,
            string Configuration, string Body)>("""
            SELECT procedures.prosecdef AS SecurityDefiner,
                   roles.rolname AS Owner,
                   array_to_string(procedures.proconfig, ',') AS Configuration,
                   procedures.prosrc AS Body
            FROM pg_proc AS procedures
            JOIN pg_roles AS roles ON roles.oid = procedures.proowner
            WHERE procedures.oid =
                'vacation.delete_neutralized_leave_request(uuid)'::regprocedure
            """);
        Assert.True(metadata.SecurityDefiner);
        Assert.Equal("internal_apps_owner", metadata.Owner);
        Assert.Equal("search_path=pg_catalog", metadata.Configuration);
        Assert.False(await connection.ExecuteScalarAsync<bool>("""
            SELECT has_function_privilege('public',
                'vacation.delete_neutralized_leave_request(uuid)', 'EXECUTE')
            """));
        Assert.True(await connection.ExecuteScalarAsync<bool>("""
            SELECT has_function_privilege('internal_apps_app',
                'vacation.delete_neutralized_leave_request(uuid)', 'EXECUTE')
            """));

        var forbiddenDeleteTables = new[]
        {
            "vacation.leave_requests", "vacation.leave_request_history",
            "vacation.leave_balance_entries", "vacation.leave_balances",
            "vacation.leave_request_identities",
            "vacation.leave_type_protected_dependencies",
            "audit.audit_events", "audit.audit_details"
        };
        foreach (var table in forbiddenDeleteTables)
        {
            Assert.False(await connection.ExecuteScalarAsync<bool>(
                "SELECT has_table_privilege('internal_apps_app', @table, 'DELETE')",
                new { table }));
        }

        foreach (var forbidden in new[]
        {
            "DELETE FROM vacation.leave_balance_entries", "UPDATE vacation.leave_balance_entries",
            "DELETE FROM vacation.leave_balances", "UPDATE vacation.leave_balances",
            "DELETE FROM vacation.leave_policies", "UPDATE vacation.leave_policies",
            "DELETE FROM vacation.leave_request_identities", "UPDATE vacation.leave_request_identities",
            "DELETE FROM vacation.leave_type_protected_dependencies",
            "UPDATE vacation.leave_type_protected_dependencies", "DELETE FROM audit.",
            "UPDATE audit.", "DELETE FROM identity.", "UPDATE identity."
        }) Assert.DoesNotContain(forbidden, metadata.Body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ControlledRequestDeletion_EnforcesEligibilityAndPreservesEvidence_WhenDatabaseTestsAreEnabled()
    {
        if (!DatabaseIntegrationEnabled()) return;
        await using var connection = await OpenOwnerConnectionAsync();
        await using var transaction = await connection.BeginTransactionAsync();

        var scope = await connection.QuerySingleAsync<Scope>("""
            SELECT employees.id AS EmployeeId, employees.public_id AS EmployeePublicId,
                   leave_types.id AS LeaveTypeId, leave_types.public_id AS LeaveTypePublicId,
                   leave_types.code AS LeaveTypeCode, users.id AS UserId
            FROM organization.employees AS employees
            CROSS JOIN vacation.leave_types AS leave_types
            CROSS JOIN identity.users AS users
            WHERE leave_types.requires_balance
            ORDER BY employees.id, leave_types.id, users.id LIMIT 1
            """, transaction: transaction);

        Assert.Empty(await connection.QueryAsync("""
            SELECT * FROM vacation.delete_neutralized_leave_request(@PublicId)
            """, new { PublicId = Guid.NewGuid() }, transaction));

        var submitted = await InsertRequestAsync(connection, transaction, scope, "SUBMITTED", 2993, 1);
        await AssertConflictAsync(connection, transaction, submitted.PublicId,
            "leave_request_delete_conflict:v1:non_terminal_status");

        var approved = await InsertRequestAsync(connection, transaction, scope, "APPROVED", 2993, 2);
        await AssertConflictAsync(connection, transaction, approved.PublicId,
            "leave_request_delete_conflict:v1:non_terminal_status");

        var rejected = await InsertRequestAsync(connection, transaction, scope, "REJECTED", 2993, 3);
        await InsertHistoryAsync(connection, transaction, rejected.Id, scope.UserId, "REJECTED");
        var rejectedResult = await connection.QuerySingleAsync<DeleteResult>("""
            SELECT employee_public_id AS EmployeePublicId,
                   leave_type_public_id AS LeaveTypePublicId,
                   leave_type_code AS LeaveTypeCode, date_from AS DateFrom, date_to AS DateTo,
                   working_days AS WorkingDays, previous_status AS PreviousStatus,
                   source AS Source, ledger_net_effect AS LedgerNetEffect,
                   deleted_history_rows AS DeletedHistoryRows
            FROM vacation.delete_neutralized_leave_request(@PublicId)
            """, new { rejected.PublicId }, transaction);
        Assert.Equal("REJECTED", rejectedResult.PreviousStatus);
        Assert.Equal(0m, rejectedResult.LedgerNetEffect);
        Assert.Equal(1, rejectedResult.DeletedHistoryRows);

        await connection.ExecuteAsync("""
            INSERT INTO vacation.leave_balance_entries
                (employee_id, leave_type_id, leave_year, entry_kind, quantity_days,
                 effective_date, actor_user_id, reason, source_reference)
            VALUES (@EmployeeId, @LeaveTypeId, 2993, 'annual_entitlement', 20,
                    DATE '2993-01-01', @UserId, 'ADR-0007 increment 2 credit',
                    gen_random_uuid()::text)
            """, scope, transaction);

        var cancelled = await InsertRequestAsync(connection, transaction, scope, "APPROVED", 2993, 4);
        var consumptionId = await InsertConsumptionAsync(connection, transaction, scope, cancelled);
        await CancelRequestAsync(connection, transaction, cancelled.Id, scope.UserId);
        await connection.ExecuteAsync("""
            INSERT INTO vacation.leave_balance_entries
                (employee_id, leave_type_id, leave_year, entry_kind, quantity_days,
                 effective_date, actor_user_id, reason, source_reference,
                 leave_request_id, reverses_entry_id)
            VALUES (@EmployeeId, @LeaveTypeId, 2993, 'cancellation_reversal', 1,
                    DATE '2993-06-04', @UserId, 'ADR-0007 reversal', @RequestId::text,
                    @RequestId, @ConsumptionId)
            """, new { scope.EmployeeId, scope.LeaveTypeId, scope.UserId,
                RequestId = cancelled.Id, ConsumptionId = consumptionId }, transaction);
        await InsertHistoryAsync(connection, transaction, cancelled.Id, scope.UserId, "CANCELLED");
        var ledgerBefore = (await connection.QueryAsync<(long Id, decimal Quantity)>("""
            SELECT id AS Id, quantity_days AS Quantity
            FROM vacation.leave_balance_entries WHERE leave_request_id = @Id ORDER BY id
            """, new { cancelled.Id }, transaction)).ToArray();
        var balanceBefore = await connection.ExecuteScalarAsync<decimal>("""
            SELECT coalesce(sum(quantity_days), 0) FROM vacation.leave_balance_entries
            WHERE employee_id = @EmployeeId AND leave_type_id = @LeaveTypeId AND leave_year = 2993
            """, scope, transaction);
        var markersBefore = await MarkerCountsAsync(connection, transaction, scope, cancelled.Id);

        var result = await connection.QuerySingleAsync<DeleteResult>("""
            SELECT employee_public_id AS EmployeePublicId,
                   leave_type_public_id AS LeaveTypePublicId,
                   leave_type_code AS LeaveTypeCode, date_from AS DateFrom, date_to AS DateTo,
                   working_days AS WorkingDays, previous_status AS PreviousStatus,
                   source AS Source, ledger_net_effect AS LedgerNetEffect,
                   deleted_history_rows AS DeletedHistoryRows
            FROM vacation.delete_neutralized_leave_request(@PublicId)
            """, new { cancelled.PublicId }, transaction);
        Assert.Equal(scope.EmployeePublicId, result.EmployeePublicId);
        Assert.Equal(scope.LeaveTypePublicId, result.LeaveTypePublicId);
        Assert.Equal(scope.LeaveTypeCode, result.LeaveTypeCode);
        Assert.Equal("CANCELLED", result.PreviousStatus);
        Assert.Equal(0m, result.LedgerNetEffect);
        Assert.Equal(1, result.DeletedHistoryRows);
        Assert.Equal(0, await connection.ExecuteScalarAsync<int>(
            "SELECT count(*) FROM vacation.leave_requests WHERE id = @Id",
            new { cancelled.Id }, transaction));
        Assert.Equal(0, await connection.ExecuteScalarAsync<int>(
            "SELECT count(*) FROM vacation.leave_request_history WHERE leave_request_id = @Id",
            new { cancelled.Id }, transaction));
        Assert.Equal(1, await connection.ExecuteScalarAsync<int>(
            "SELECT count(*) FROM vacation.leave_request_identities WHERE id = @Id",
            new { cancelled.Id }, transaction));
        Assert.Equal(ledgerBefore, (await connection.QueryAsync<(long Id, decimal Quantity)>("""
            SELECT id AS Id, quantity_days AS Quantity
            FROM vacation.leave_balance_entries WHERE leave_request_id = @Id ORDER BY id
            """, new { cancelled.Id }, transaction)).ToArray());
        Assert.Equal(balanceBefore, await connection.ExecuteScalarAsync<decimal>("""
            SELECT coalesce(sum(quantity_days), 0) FROM vacation.leave_balance_entries
            WHERE employee_id = @EmployeeId AND leave_type_id = @LeaveTypeId AND leave_year = 2993
            """, scope, transaction));
        Assert.Equal(markersBefore, await MarkerCountsAsync(connection, transaction, scope, cancelled.Id));
        Assert.Equal(1, await connection.ExecuteScalarAsync<int>(
            "SELECT count(*) FROM vacation.leave_requests WHERE id = @Id",
            new { submitted.Id }, transaction));

        var nonZero = await InsertRequestAsync(connection, transaction, scope, "APPROVED", 2993, 5);
        await InsertConsumptionAsync(connection, transaction, scope, nonZero);
        await CancelRequestAsync(connection, transaction, nonZero.Id, scope.UserId);
        await AssertConflictAsync(connection, transaction, nonZero.PublicId,
            "leave_request_delete_conflict:v1:ledger_effect_not_zero");

        await transaction.RollbackAsync();
    }

    [Fact]
    public async Task LaterFailureRollback_RestoresRequestAndHistory_WhenDatabaseTestsAreEnabled()
    {
        if (!DatabaseIntegrationEnabled()) return;
        await using var connection = await OpenOwnerConnectionAsync();
        var scope = await connection.QuerySingleAsync<Scope>("""
            SELECT employees.id AS EmployeeId, employees.public_id AS EmployeePublicId,
                   leave_types.id AS LeaveTypeId, leave_types.public_id AS LeaveTypePublicId,
                   leave_types.code AS LeaveTypeCode, users.id AS UserId
            FROM organization.employees employees CROSS JOIN vacation.leave_types leave_types
            CROSS JOIN identity.users users ORDER BY employees.id, leave_types.id, users.id LIMIT 1
            """);
        await using var transaction = await connection.BeginTransactionAsync();
        var request = await InsertRequestAsync(connection, transaction, scope, "REJECTED", 2992, 1);
        await InsertHistoryAsync(connection, transaction, request.Id, scope.UserId, "REJECTED");
        await transaction.SaveAsync("before_later_audit");
        await connection.QuerySingleAsync<DeleteResult>("""
            SELECT employee_public_id AS EmployeePublicId,
                   leave_type_public_id AS LeaveTypePublicId,
                   leave_type_code AS LeaveTypeCode, date_from AS DateFrom, date_to AS DateTo,
                   working_days AS WorkingDays, previous_status AS PreviousStatus,
                   source AS Source, ledger_net_effect AS LedgerNetEffect,
                   deleted_history_rows AS DeletedHistoryRows
            FROM vacation.delete_neutralized_leave_request(@PublicId)
            """, new { request.PublicId }, transaction);
        await transaction.RollbackAsync("before_later_audit"); // Simulated later AuditWriter failure.
        Assert.Equal(1, await connection.ExecuteScalarAsync<int>(
            "SELECT count(*) FROM vacation.leave_requests WHERE id = @Id",
            new { request.Id }, transaction));
        Assert.Equal(1, await connection.ExecuteScalarAsync<int>(
            "SELECT count(*) FROM vacation.leave_request_history WHERE leave_request_id = @Id",
            new { request.Id }, transaction));
        await transaction.RollbackAsync();
    }

    [Fact]
    public async Task LeaveTypeSafeDelete_IgnoresAuditAndDeletesOnlyUnusedCustomType_WhenDatabaseTestsAreEnabled()
    {
        if (!DatabaseIntegrationEnabled()) return;
        await using var connection = await OpenOwnerConnectionAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        var leaveType = await connection.QuerySingleAsync<(long Id, Guid PublicId)>("""
            INSERT INTO vacation.leave_types
                (code, name_sr, name_en, counts_against_vacation_balance,
                 requires_balance, requires_approval, is_active, display_order)
            VALUES ('ADR7_' || upper(replace(left(gen_random_uuid()::text, 12), '-', '_')),
                    'ADR test', 'ADR test', false, false, false, true, 999)
            RETURNING id AS Id, public_id AS PublicId
            """, transaction: transaction);
        var auditId = await connection.ExecuteScalarAsync<long>("""
            INSERT INTO audit.audit_events
                (actor_system_code, module, action, target_type, target_public_id,
                 outcome, trace_id)
            VALUES ('adr-0007-test', 'vacation', 'test', 'leave_type', @PublicId,
                    'succeeded', gen_random_uuid()::text)
            RETURNING id
            """, new { leaveType.PublicId }, transaction);

        Assert.True(await connection.ExecuteScalarAsync<bool>(
            "SELECT vacation.delete_unreferenced_leave_type(@PublicId)",
            new { leaveType.PublicId }, transaction));
        Assert.Equal(0, await connection.ExecuteScalarAsync<int>(
            "SELECT count(*) FROM vacation.leave_types WHERE id = @Id",
            new { leaveType.Id }, transaction));
        Assert.Equal(1, await connection.ExecuteScalarAsync<int>(
            "SELECT count(*) FROM audit.audit_events WHERE id = @auditId", new { auditId }, transaction));
        await transaction.RollbackAsync();
    }

    private static async Task<(long Id, Guid PublicId)> InsertRequestAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, Scope scope,
        string status, int year, int day)
    {
        return await connection.QuerySingleAsync<(long Id, Guid PublicId)>("""
            WITH new_identity AS (
                INSERT INTO vacation.leave_request_identities DEFAULT VALUES RETURNING id, public_id
            )
            INSERT INTO vacation.leave_requests
                (id, public_id, employee_id, leave_type_id, date_from, date_to, working_days,
                 status, decided_at, decided_by_user_id, created_by_user_id)
            SELECT id, public_id, @EmployeeId, @LeaveTypeId, make_date(@Year, 6, @Day),
                   make_date(@Year, 6, @Day), 1, @Status,
                   CASE WHEN @Status = 'SUBMITTED' THEN NULL ELSE now() END,
                   CASE WHEN @Status = 'SUBMITTED' THEN NULL ELSE @UserId END, @UserId
            FROM new_identity RETURNING id AS Id, public_id AS PublicId
            """, new { scope.EmployeeId, scope.LeaveTypeId, scope.UserId, Year = year, Day = day,
                Status = status }, transaction);
    }

    private static Task InsertHistoryAsync(NpgsqlConnection connection, NpgsqlTransaction transaction,
        long requestId, long userId, string status) => connection.ExecuteAsync("""
        INSERT INTO vacation.leave_request_history
            (leave_request_id, previous_status, new_status, changed_by_user_id)
        VALUES (@requestId, NULL, @status, @userId)
        """, new { requestId, userId, status }, transaction);

    private static async Task<long> InsertConsumptionAsync(NpgsqlConnection connection,
        NpgsqlTransaction transaction, Scope scope, (long Id, Guid PublicId) request)
    {
        return await connection.ExecuteScalarAsync<long>("""
            INSERT INTO vacation.leave_balance_entries
                (employee_id, leave_type_id, leave_year, entry_kind, quantity_days,
                 effective_date, actor_user_id, reason, source_reference, leave_request_id)
            SELECT @EmployeeId, @LeaveTypeId, 2993, 'request_consumption', -1,
                   requests.date_from, @UserId, 'ADR-0007 consumption', @RequestId::text, @RequestId
            FROM vacation.leave_requests AS requests WHERE requests.id = @RequestId
            RETURNING id
            """, new { scope.EmployeeId, scope.LeaveTypeId, scope.UserId, RequestId = request.Id }, transaction);
    }

    private static Task CancelRequestAsync(NpgsqlConnection connection, NpgsqlTransaction transaction,
        long requestId, long userId) => connection.ExecuteAsync("""
        UPDATE vacation.leave_requests SET status = 'CANCELLED', cancelled_at = now(),
            cancelled_by_user_id = @userId WHERE id = @requestId
        """, new { requestId, userId }, transaction);

    private static async Task<(int Identity, int LeaveType, int Employee)> MarkerCountsAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, Scope scope, long requestId)
    {
        return (
            await connection.ExecuteScalarAsync<int>(
                "SELECT count(*) FROM vacation.leave_request_identities WHERE id = @requestId",
                new { requestId }, transaction),
            await connection.ExecuteScalarAsync<int>("""
                SELECT count(*) FROM vacation.leave_type_protected_dependencies
                WHERE leave_type_id = @LeaveTypeId AND dependency_name = 'Vacation leave request'
                """, new { scope.LeaveTypeId }, transaction),
            await connection.ExecuteScalarAsync<int>("""
                SELECT count(*) FROM organization.employee_protected_dependencies
                WHERE employee_id = @EmployeeId AND dependency_name = 'Vacation leave request'
                """, new { scope.EmployeeId }, transaction));
    }

    private static async Task AssertConflictAsync(NpgsqlConnection connection,
        NpgsqlTransaction transaction, Guid publicId, string expected)
    {
        var savepoint = $"adr7_{Guid.NewGuid():N}";
        await transaction.SaveAsync(savepoint);
        var exception = await Assert.ThrowsAsync<PostgresException>(() => connection.ExecuteAsync(
            "SELECT * FROM vacation.delete_neutralized_leave_request(@publicId)",
            new { publicId }, transaction));
        Assert.Equal(PostgresErrorCodes.RaiseException, exception.SqlState);
        Assert.Equal(expected, exception.MessageText);
        await transaction.RollbackAsync(savepoint);
    }

    private sealed record DeleteResult(Guid EmployeePublicId, Guid LeaveTypePublicId,
        string LeaveTypeCode, DateOnly DateFrom, DateOnly DateTo, int WorkingDays,
        string PreviousStatus, string Source, decimal LedgerNetEffect, int DeletedHistoryRows);

    private sealed record Scope(long EmployeeId, Guid EmployeePublicId, long LeaveTypeId,
        Guid LeaveTypePublicId, string LeaveTypeCode, long UserId);

    private static bool DatabaseIntegrationEnabled() => string.Equals(
        Environment.GetEnvironmentVariable("RUN_DATABASE_INTEGRATION_TESTS"), "true",
        StringComparison.OrdinalIgnoreCase);

    private static string Read(params string[] parts) =>
        File.ReadAllText(Path.Combine([RepositoryRoot(), .. parts]));

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "internal.ps1")))
            directory = directory.Parent;
        return directory?.FullName ?? throw new InvalidOperationException("Repository root not found.");
    }

    private static async Task<NpgsqlConnection> OpenOwnerConnectionAsync()
    {
        foreach (var line in File.ReadLines(Path.Combine(RepositoryRoot(), ".env")))
        {
            var separator = line.IndexOf('=');
            if (separator <= 0 || line.TrimStart().StartsWith('#')) continue;
            var name = line[..separator].Trim();
            if (Environment.GetEnvironmentVariable(name) is null)
                Environment.SetEnvironmentVariable(name, line[(separator + 1)..].Trim());
        }
        string Required(string name) => Environment.GetEnvironmentVariable(name)
            ?? throw new InvalidOperationException($"{name} is required.");
        var connection = new NpgsqlConnection(new NpgsqlConnectionStringBuilder
        {
            Host = Required("DB_HOST"), Port = int.Parse(Required("DB_PORT")),
            Database = Required("DB_NAME"), Username = Required("DB_OWNER_USER"),
            Password = Required("DB_OWNER_PASSWORD"),
            SslMode = Enum.Parse<SslMode>(Required("DB_SSL_MODE"), true)
        }.ConnectionString);
        await connection.OpenAsync();
        return connection;
    }
}
