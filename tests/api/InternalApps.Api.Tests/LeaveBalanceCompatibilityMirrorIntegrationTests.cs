using Dapper;
using InternalApps.Api.Infrastructure;
using InternalApps.Api.Modules.Vacation;
using Npgsql;
using Xunit;

namespace InternalApps.Api.Tests;

public sealed class LeaveBalanceCompatibilityMirrorIntegrationTests
{
    [Fact]
    public void LedgerPosting_UpdatesTheMirrorInsideTheExistingServiceTransaction()
    {
        var service = ReadRepositoryFile("apps", "api", "src", "Api", "Modules",
            "Vacation", "LeaveBalanceLedgerService.cs");
        var repository = ReadRepositoryFile("apps", "api", "src", "Api", "Modules",
            "Vacation", "LeaveBalanceLedgerRepository.cs");
        var migration = ReadRepositoryFile("database", "migrations",
            "034_vacation_leave_balance_mirror_precision.sql");
        var insert = service.IndexOf("await repository.InsertAsync", StringComparison.Ordinal);
        var mirror = service.IndexOf("await repository.UpsertCompatibilityBalanceAsync", StringComparison.Ordinal);
        var audit = service.IndexOf("await auditWriter.WriteAsync", StringComparison.Ordinal);
        var commit = service.IndexOf("await transaction.CommitAsync", StringComparison.Ordinal);

        Assert.True(insert >= 0 && insert < mirror);
        Assert.True(mirror < audit);
        Assert.True(audit < commit);
        Assert.Contains("ON CONFLICT (employee_id, leave_type_id, year) DO UPDATE", repository);
        Assert.Contains("FILTER (WHERE entries.entry_kind = 'annual_entitlement')", repository);
        Assert.Contains("ALTER COLUMN entitlement_days TYPE numeric(6, 1)", migration);
    }

    [Fact]
    public async Task CreditCommands_MirrorApprovalCancellationAndRollbackAgainstRuntimeDatabase()
    {
        if (!DatabaseIntegrationEnabled()) return;

        LoadRepositoryEnvironment();
        SqlMapper.AddTypeHandler(new DateOnlyTypeHandler());
        await using var dataSource = NpgsqlDataSource.Create(BuildRuntimeConnectionString());
        await using var connection = await dataSource.OpenConnectionAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        try
        {
            var scope = await connection.QuerySingleAsync<ScopeFixture>("""
                SELECT employees.public_id AS EmployeeId,
                       leave_types.public_id AS LeaveTypeId,
                       users.public_id AS Actor
                FROM organization.employees AS employees
                CROSS JOIN vacation.leave_types AS leave_types
                CROSS JOIN identity.users AS users
                WHERE leave_types.code = 'ANNUAL_LEAVE'
                  AND leave_types.requires_balance
                  AND users.username = @AdminUsername
                LIMIT 1
                """, new { AdminUsername = Required("SMOKE_ADMIN_USERNAME") }, transaction);
            var year = 8000 + Random.Shared.Next(0, 1000);
            while (await ScopeExistsAsync(connection, transaction, scope, year)) year++;

            Assert.False(await BaselineExistsAsync(connection, transaction, scope, year));
            var ledger = new LeaveBalanceLedgerRepository(dataSource);

            await PostAsync(ledger, connection, transaction, scope, year,
                "annual_entitlement", 10.5m, "mirror-entitlement");
            Assert.Equal((10.5m, 0m, 0m, 0),
                await ReadMirrorAsync(connection, transaction, scope, year));
            Assert.Equal(10.5m, await ReadLedgerAsync(connection, transaction, scope, year));

            await PostAsync(ledger, connection, transaction, scope, year,
                "carry_over", 2m, "mirror-carry-over");
            Assert.Equal((10.5m, 2m, 0m, 0),
                await ReadMirrorAsync(connection, transaction, scope, year));
            Assert.Equal(12.5m, await ReadLedgerAsync(connection, transaction, scope, year));

            await PostAsync(ledger, connection, transaction, scope, year,
                "manual_adjustment", -1.5m, "mirror-adjustment");
            Assert.Equal((10.5m, 2m, -1.5m, 0),
                await ReadMirrorAsync(connection, transaction, scope, year));
            Assert.Equal(11m, await ReadLedgerAsync(connection, transaction, scope, year));

            await transaction.SaveAsync("duplicate_source");
            await Assert.ThrowsAsync<PostgresException>(() => PostAsync(ledger, connection,
                transaction, scope, year, "manual_adjustment", -1.5m,
                "mirror-adjustment"));
            await transaction.RollbackAsync("duplicate_source");
            Assert.Equal((10.5m, 2m, -1.5m, 0),
                await ReadMirrorAsync(connection, transaction, scope, year));

            var request = await CreateSubmittedRequestAsync(connection, transaction, scope, year);
            var requests = new LeaveRequestsRepository(dataSource);
            var balance = await requests.GetBalanceForUpdateAsync(connection, transaction,
                request.EmployeeId, request.LeaveTypeId, year, CancellationToken.None);
            Assert.NotNull(balance);
            await requests.UpdateUsedDaysAsync(connection, transaction, balance!.Id, 2,
                CancellationToken.None);
            await connection.ExecuteAsync("""
                UPDATE vacation.leave_requests
                SET status = 'APPROVED', decided_at = now(),
                    decided_by_user_id = (SELECT id FROM identity.users WHERE public_id = @Actor),
                    updated_at = now()
                WHERE id = @Id
                """, new { request.Id, scope.Actor }, transaction);
            await ledger.InsertRequestConsumptionAsync(connection, transaction,
                request with { Status = LeaveRequestStatuses.Approved }, scope.Actor,
                CancellationToken.None);
            Assert.Equal(9m, await ReadLedgerAsync(connection, transaction, scope, year));
            Assert.Equal(9m, await ReadEmployeeAvailableAsync(connection, transaction, scope, year));

            await requests.UpdateUsedDaysAsync(connection, transaction, balance.Id, 0,
                CancellationToken.None);
            await connection.ExecuteAsync("""
                UPDATE vacation.leave_requests
                SET status = 'CANCELLED', cancelled_at = now(),
                    cancelled_by_user_id = (SELECT id FROM identity.users WHERE public_id = @Actor),
                    updated_at = now()
                WHERE id = @Id
                """, new { request.Id, scope.Actor }, transaction);
            await ledger.InsertCancellationReversalAsync(connection, transaction,
                request with { Status = LeaveRequestStatuses.Approved }, scope.Actor,
                CancellationToken.None);
            Assert.Equal(11m, await ReadLedgerAsync(connection, transaction, scope, year));
            Assert.Equal(11m, await ReadEmployeeAvailableAsync(connection, transaction, scope, year));

            await transaction.SaveAsync("failed_after_mirror");
            await PostAsync(ledger, connection, transaction, scope, year,
                "manual_adjustment", 1m, "mirror-rolled-back");
            await transaction.RollbackAsync("failed_after_mirror");
            Assert.Equal(11m, await ReadLedgerAsync(connection, transaction, scope, year));
            Assert.Equal((10.5m, 2m, -1.5m, 0),
                await ReadMirrorAsync(connection, transaction, scope, year));

            await transaction.SaveAsync("failed_post");
            await Assert.ThrowsAsync<PostgresException>(() => PostAsync(ledger, connection,
                transaction, scope, year, "manual_adjustment", -20m, "mirror-failed"));
            await transaction.RollbackAsync("failed_post");
            Assert.Equal((10.5m, 2m, -1.5m, 0),
                await ReadMirrorAsync(connection, transaction, scope, year));
        }
        finally
        {
            await transaction.RollbackAsync();
        }
    }

    private static async Task PostAsync(LeaveBalanceLedgerRepository repository,
        NpgsqlConnection connection, NpgsqlTransaction transaction, ScopeFixture scope,
        int year, string kind, decimal quantity, string source)
    {
        var command = new PostLeaveBalanceEntryCommand(scope.EmployeeId, scope.LeaveTypeId,
            year, quantity, new DateOnly(year, 1, 2), kind, null,
            $"{source}-{year}");
        var entry = await repository.InsertAsync(connection, transaction, command, kind,
            scope.Actor, CancellationToken.None);
        Assert.NotNull(entry);
        await repository.UpsertCompatibilityBalanceAsync(connection, transaction, command,
            CancellationToken.None);
    }

    private static async Task<LeaveRequestEntity> CreateSubmittedRequestAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, ScopeFixture scope, int year)
    {
        const string sql = """
            INSERT INTO vacation.leave_requests
                (employee_id, leave_type_id, date_from, date_to, working_days, status,
                 employee_note, submitted_at, created_by_user_id)
            SELECT employees.id, leave_types.id, @Date, @Date, 2, 'SUBMITTED',
                   'Compatibility mirror integration test', now(), users.id
            FROM organization.employees AS employees
            CROSS JOIN vacation.leave_types AS leave_types
            CROSS JOIN identity.users AS users
            WHERE employees.public_id = @EmployeeId
              AND leave_types.public_id = @LeaveTypeId
              AND users.public_id = @Actor
            RETURNING id
            """;
        var id = await connection.ExecuteScalarAsync<long>(sql, new
        {
            scope.EmployeeId, scope.LeaveTypeId, scope.Actor,
            Date = new DateOnly(year, 2, 2)
        }, transaction);
        return await connection.QuerySingleAsync<LeaveRequestEntity>("""
            SELECT requests.id AS Id, requests.public_id AS PublicId,
                   requests.employee_id AS EmployeeId,
                   employees.public_id AS EmployeePublicId,
                   requests.leave_type_id AS LeaveTypeId,
                   leave_types.public_id AS LeaveTypePublicId,
                   leave_types.requires_balance AS RequiresBalance,
                   requests.date_from AS DateFrom, requests.date_to AS DateTo,
                   requests.working_days AS WorkingDays, requests.status AS Status
            FROM vacation.leave_requests AS requests
            INNER JOIN organization.employees AS employees ON employees.id = requests.employee_id
            INNER JOIN vacation.leave_types AS leave_types ON leave_types.id = requests.leave_type_id
            WHERE requests.id = @Id
            """, new { Id = id }, transaction);
    }

    private static Task<bool> ScopeExistsAsync(NpgsqlConnection connection,
        NpgsqlTransaction transaction, ScopeFixture scope, int year) =>
        connection.ExecuteScalarAsync<bool>("""
            SELECT EXISTS (
                SELECT 1 FROM vacation.leave_balances AS balances
                INNER JOIN organization.employees AS employees ON employees.id = balances.employee_id
                INNER JOIN vacation.leave_types AS leave_types ON leave_types.id = balances.leave_type_id
                WHERE employees.public_id = @EmployeeId AND leave_types.public_id = @LeaveTypeId
                  AND balances.year = @Year)
                OR EXISTS (
                SELECT 1 FROM vacation.leave_balance_entries AS entries
                INNER JOIN organization.employees AS employees ON employees.id = entries.employee_id
                INNER JOIN vacation.leave_types AS leave_types ON leave_types.id = entries.leave_type_id
                WHERE employees.public_id = @EmployeeId AND leave_types.public_id = @LeaveTypeId
                  AND entries.leave_year = @Year)
            """, new { scope.EmployeeId, scope.LeaveTypeId, Year = year }, transaction);

    private static Task<bool> BaselineExistsAsync(NpgsqlConnection connection,
        NpgsqlTransaction transaction, ScopeFixture scope, int year) =>
        connection.ExecuteScalarAsync<bool>("""
            SELECT EXISTS (SELECT 1 FROM vacation.leave_balances AS balances
                INNER JOIN organization.employees AS employees ON employees.id = balances.employee_id
                INNER JOIN vacation.leave_types AS leave_types ON leave_types.id = balances.leave_type_id
                WHERE employees.public_id = @EmployeeId AND leave_types.public_id = @LeaveTypeId
                  AND balances.year = @Year)
            """, new { scope.EmployeeId, scope.LeaveTypeId, Year = year }, transaction);

    private static Task<(decimal, decimal, decimal, int)> ReadMirrorAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, ScopeFixture scope, int year) =>
        connection.QuerySingleAsync<(decimal, decimal, decimal, int)>("""
            SELECT balances.entitlement_days, balances.carry_over_days,
                   balances.adjustment_days, balances.used_days
            FROM vacation.leave_balances AS balances
            INNER JOIN organization.employees AS employees ON employees.id = balances.employee_id
            INNER JOIN vacation.leave_types AS leave_types ON leave_types.id = balances.leave_type_id
            WHERE employees.public_id = @EmployeeId AND leave_types.public_id = @LeaveTypeId
              AND balances.year = @Year
            """, new { scope.EmployeeId, scope.LeaveTypeId, Year = year }, transaction);

    private static Task<decimal> ReadLedgerAsync(NpgsqlConnection connection,
        NpgsqlTransaction transaction, ScopeFixture scope, int year) =>
        connection.ExecuteScalarAsync<decimal>("""
            SELECT coalesce(sum(entries.quantity_days), 0)
            FROM vacation.leave_balance_entries AS entries
            INNER JOIN organization.employees AS employees ON employees.id = entries.employee_id
            INNER JOIN vacation.leave_types AS leave_types ON leave_types.id = entries.leave_type_id
            WHERE employees.public_id = @EmployeeId AND leave_types.public_id = @LeaveTypeId
              AND entries.leave_year = @Year
            """, new { scope.EmployeeId, scope.LeaveTypeId, Year = year }, transaction);

    private static Task<decimal> ReadEmployeeAvailableAsync(NpgsqlConnection connection,
        NpgsqlTransaction transaction, ScopeFixture scope, int year) =>
        connection.ExecuteScalarAsync<decimal>("""
            SELECT entitlement_days + carry_over_days + adjustment_days - used_days
            FROM vacation.leave_balances AS balances
            INNER JOIN organization.employees AS employees ON employees.id = balances.employee_id
            INNER JOIN vacation.leave_types AS leave_types ON leave_types.id = balances.leave_type_id
            WHERE employees.public_id = @EmployeeId AND leave_types.public_id = @LeaveTypeId
              AND balances.year = @Year
            """, new { scope.EmployeeId, scope.LeaveTypeId, Year = year }, transaction);

    private static bool DatabaseIntegrationEnabled() => string.Equals(
        Environment.GetEnvironmentVariable("RUN_DATABASE_INTEGRATION_TESTS"), "true",
        StringComparison.OrdinalIgnoreCase);

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

    private static string BuildRuntimeConnectionString() =>
        new NpgsqlConnectionStringBuilder
        {
            Host = Required("DB_HOST"), Port = int.Parse(Required("DB_PORT")),
            Database = Required("DB_NAME"), Username = Required("APP_DB_USER"),
            Password = Required("APP_DB_PASSWORD"),
            SslMode = Enum.Parse<SslMode>(Required("DB_SSL_MODE"), true)
        }.ConnectionString;

    private static string Required(string name) =>
        Environment.GetEnvironmentVariable(name) ?? throw new InvalidOperationException(
            $"Missing required database integration test setting: {name}");

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "internal.ps1")))
            directory = directory.Parent;
        return directory?.FullName ?? throw new InvalidOperationException("Repository root not found.");
    }

    private static string ReadRepositoryFile(params string[] parts) =>
        File.ReadAllText(Path.Combine([RepositoryRoot(), .. parts]));

    private sealed record ScopeFixture(Guid EmployeeId, Guid LeaveTypeId, Guid Actor);
}
