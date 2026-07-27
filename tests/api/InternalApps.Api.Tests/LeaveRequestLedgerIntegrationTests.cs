using Dapper;
using InternalApps.Api.Infrastructure;
using InternalApps.Api.Modules.Vacation;
using Npgsql;
using Xunit;

namespace InternalApps.Api.Tests;

public sealed class LeaveRequestLedgerIntegrationTests
{
    [Fact]
    public void BalanceConsumingTransitions_PostTheStoredRequestQuantityWithinTheRequestTransaction()
    {
        var service = ReadRepositoryFile("apps", "api", "src", "Api", "Modules",
            "Vacation", "LeaveRequestService.cs");
        var ledger = ReadRepositoryFile("apps", "api", "src", "Api", "Modules",
            "Vacation", "LeaveBalanceLedgerRepository.cs");

        Assert.Contains("LeaveBalanceLedgerRepository ledgerRepository", service);
        Assert.Contains("await repository.SetStatusAsync", service);
        Assert.Contains("await ledgerRepository.InsertRequestConsumptionAsync", service);
        Assert.Contains("await ledgerRepository.InsertCancellationReversalAsync", service);
        Assert.True(service.IndexOf("await repository.SetStatusAsync", StringComparison.Ordinal) <
                    service.IndexOf("await ledgerRepository.InsertRequestConsumptionAsync", StringComparison.Ordinal));
        Assert.True(service.IndexOf("await ledgerRepository.InsertRequestConsumptionAsync", StringComparison.Ordinal) <
                    service.LastIndexOf("await repository.InsertHistoryAsync", StringComparison.Ordinal));
        Assert.True(service.LastIndexOf("await repository.InsertHistoryAsync", StringComparison.Ordinal) <
                    service.LastIndexOf("await auditWriter.WriteAsync", StringComparison.Ordinal));
        Assert.True(service.LastIndexOf("await auditWriter.WriteAsync", StringComparison.Ordinal) <
                    service.LastIndexOf("await transaction.CommitAsync", StringComparison.Ordinal));

        Assert.Contains("-request.WorkingDays", ledger);
        Assert.Contains("request.WorkingDays,", ledger);
        Assert.Contains("SourceReference = request.Id.ToString()", ledger);
        Assert.Contains("original.entry_kind = @ReversesConsumption", ledger);
        Assert.Contains("AND original.leave_request_id = @RequestId) END", ledger);
        Assert.Contains("\"request_consumption\", token", ledger);
    }

    [Fact]
    public async Task RequestConsumption_ExecutesAgainstTheConfiguredRuntimeDatabaseContract()
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("RUN_DATABASE_INTEGRATION_TESTS"),
                "true", StringComparison.OrdinalIgnoreCase))
            return;

        LoadRepositoryEnvironment();
        SqlMapper.AddTypeHandler(new DateOnlyTypeHandler());
        await using var dataSource = NpgsqlDataSource.Create(BuildRuntimeConnectionString());
        await using var connection = await dataSource.OpenConnectionAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        try
        {
            const string fixtureSql = """
                SELECT requests.id AS Id, requests.public_id AS PublicId,
                       requests.employee_id AS EmployeeId,
                       employees.public_id AS EmployeePublicId,
                       requests.leave_type_id AS LeaveTypeId,
                       leave_types.public_id AS LeaveTypePublicId,
                       leave_types.requires_balance AS RequiresBalance,
                       requests.date_from AS DateFrom, requests.date_to AS DateTo,
                       requests.working_days AS WorkingDays, requests.status AS Status,
                       users.public_id AS Actor
                FROM vacation.leave_requests AS requests
                INNER JOIN organization.employees AS employees
                    ON employees.id = requests.employee_id
                INNER JOIN vacation.leave_types AS leave_types
                    ON leave_types.id = requests.leave_type_id
                CROSS JOIN LATERAL (
                    SELECT public_id
                    FROM identity.users
                    WHERE username = @AdminUsername
                ) AS users
                WHERE leave_types.name_en LIKE 'LV2SMOKE-% sufficient'
                  AND requests.status = 'SUBMITTED'
                  AND (
                      SELECT coalesce(sum(entries.quantity_days), 0)
                      FROM vacation.leave_balance_entries AS entries
                      WHERE entries.employee_id = requests.employee_id
                        AND entries.leave_type_id = requests.leave_type_id
                        AND entries.leave_year = extract(year FROM requests.date_from)
                  ) >= requests.working_days
                ORDER BY requests.created_at DESC
                LIMIT 1
                """;
            var fixture = await connection.QuerySingleAsync<RuntimeFixture>(
                fixtureSql, new { AdminUsername = Required("SMOKE_ADMIN_USERNAME") },
                transaction);
            await connection.ExecuteAsync("""
                UPDATE vacation.leave_requests
                SET status = 'APPROVED',
                    decided_at = now(),
                    decided_by_user_id = (
                        SELECT id FROM identity.users WHERE public_id = @Actor),
                    updated_at = now()
                WHERE id = @Id
                """, new { fixture.Actor, fixture.Id }, transaction);

            var repository = new LeaveBalanceLedgerRepository(dataSource);
            await repository.InsertRequestConsumptionAsync(connection, transaction,
                new(fixture.Id, fixture.PublicId, fixture.EmployeeId,
                    fixture.EmployeePublicId, fixture.LeaveTypeId,
                    fixture.LeaveTypePublicId, fixture.RequiresBalance,
                    fixture.DateFrom, fixture.DateTo, fixture.WorkingDays,
                    LeaveRequestStatuses.Approved),
                fixture.Actor, CancellationToken.None);

            var consumptionCount = await connection.ExecuteScalarAsync<int>("""
                SELECT count(*)
                FROM vacation.leave_balance_entries
                WHERE entry_kind = 'request_consumption'
                  AND leave_request_id = @Id
                  AND quantity_days = @QuantityDays
                  AND source_reference = @SourceReference
                """, new
                {
                    fixture.Id,
                    QuantityDays = -fixture.WorkingDays,
                    SourceReference = fixture.Id.ToString()
                }, transaction);
            Assert.Equal(1, consumptionCount);

            await connection.ExecuteAsync("""
                UPDATE vacation.leave_requests
                SET status = 'CANCELLED',
                    cancelled_at = now(),
                    cancelled_by_user_id = (
                        SELECT id FROM identity.users WHERE public_id = @Actor),
                    updated_at = now()
                WHERE id = @Id
                """, new { fixture.Actor, fixture.Id }, transaction);

            await repository.InsertCancellationReversalAsync(connection, transaction,
                new(fixture.Id, fixture.PublicId, fixture.EmployeeId,
                    fixture.EmployeePublicId, fixture.LeaveTypeId,
                    fixture.LeaveTypePublicId, fixture.RequiresBalance,
                    fixture.DateFrom, fixture.DateTo, fixture.WorkingDays,
                    LeaveRequestStatuses.Approved),
                fixture.Actor, CancellationToken.None);

            var reversalCount = await connection.ExecuteScalarAsync<int>("""
                SELECT count(*)
                FROM vacation.leave_balance_entries AS reversal
                INNER JOIN vacation.leave_balance_entries AS consumption
                    ON consumption.id = reversal.reverses_entry_id
                WHERE reversal.entry_kind = 'cancellation_reversal'
                  AND reversal.leave_request_id = @Id
                  AND reversal.quantity_days = -consumption.quantity_days
                  AND consumption.entry_kind = 'request_consumption'
                  AND consumption.leave_request_id = @Id
                """, new { fixture.Id }, transaction);
            Assert.Equal(1, reversalCount);

            await transaction.SaveAsync("duplicate_cancellation_reversal");
            var duplicate = await Assert.ThrowsAsync<PostgresException>(() =>
                repository.InsertCancellationReversalAsync(connection, transaction,
                    new(fixture.Id, fixture.PublicId, fixture.EmployeeId,
                        fixture.EmployeePublicId, fixture.LeaveTypeId,
                        fixture.LeaveTypePublicId, fixture.RequiresBalance,
                        fixture.DateFrom, fixture.DateTo, fixture.WorkingDays,
                        LeaveRequestStatuses.Approved),
                    fixture.Actor, CancellationToken.None));
            Assert.Equal(PostgresErrorCodes.UniqueViolation, duplicate.SqlState);
            await transaction.RollbackAsync("duplicate_cancellation_reversal");
        }
        finally
        {
            await transaction.RollbackAsync();
        }
    }

    [Fact]
    public void ApprovalInsufficiency_RollsBackTheTransitionBeforeAuditOrCommit()
    {
        var service = ReadRepositoryFile("apps", "api", "src", "Api", "Modules",
            "Vacation", "LeaveRequestService.cs");
        var endpoints = ReadRepositoryFile("apps", "api", "src", "Api", "Modules",
            "Vacation", "LeaveRequestEndpoints.cs");
        var migration = ReadRepositoryFile("database", "migrations",
            "020_vacation_leave_balance_ledger.sql");

        Assert.Contains("RAISE EXCEPTION 'Leave balance entry would make the balance negative.'",
            migration);
        Assert.Contains("PostgresErrorCodes.RaiseException", service);
        Assert.Contains("exception.MessageText.Contains(\"negative\"", service);
        Assert.Contains("await transaction.RollbackAsync(cancellationToken);", service);
        Assert.Contains("LeaveRequestOperationStatus.BalanceInsufficient", service);
        Assert.Contains("(409, \"Insufficient leave balance\", \"vacation_balance_insufficient\"",
            endpoints);
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
        var path = Path.Combine(RepositoryRoot(), ".env");
        foreach (var line in File.ReadLines(path))
        {
            if (string.IsNullOrWhiteSpace(line) || line.TrimStart().StartsWith('#'))
                continue;
            var separator = line.IndexOf('=');
            if (separator <= 0)
                continue;
            var name = line[..separator].Trim();
            if (Environment.GetEnvironmentVariable(name) is null)
                Environment.SetEnvironmentVariable(name, line[(separator + 1)..].Trim());
        }
    }

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

    private static string Required(string name) =>
        Environment.GetEnvironmentVariable(name)
        ?? throw new InvalidOperationException(
            $"Missing required database integration test setting: {name}");

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null &&
               !File.Exists(Path.Combine(directory.FullName, "internal.ps1")))
            directory = directory.Parent;
        return directory?.FullName
               ?? throw new InvalidOperationException("Repository root not found.");
    }

    private sealed record RuntimeFixture(
        long Id,
        Guid PublicId,
        long EmployeeId,
        Guid EmployeePublicId,
        long LeaveTypeId,
        Guid LeaveTypePublicId,
        bool RequiresBalance,
        DateOnly DateFrom,
        DateOnly DateTo,
        int WorkingDays,
        string Status,
        Guid Actor);
}
