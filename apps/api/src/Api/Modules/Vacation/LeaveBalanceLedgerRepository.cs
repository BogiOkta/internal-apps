using Dapper;
using Npgsql;

namespace InternalApps.Api.Modules.Vacation;

internal sealed class LeaveBalanceLedgerRepository(NpgsqlDataSource dataSource)
{
    private const string Projection = """
        entries.public_id AS PublicId, employees.public_id AS EmployeeId,
        leave_types.public_id AS LeaveTypeId, entries.leave_year AS LeaveYear,
        entries.entry_kind AS EntryKind, entries.quantity_days AS QuantityDays,
        entries.effective_date AS EffectiveDate, entries.accepted_at AS AcceptedAt,
        users.public_id AS ActorUserId, entries.system_origin AS SystemOrigin,
        entries.reason AS Reason, entries.explanation AS Explanation,
        entries.source_reference AS SourceReference
        """;

    public async Task<LeaveBalanceEntryRecord?> InsertAsync(NpgsqlConnection connection,
        NpgsqlTransaction transaction, PostLeaveBalanceEntryCommand command, string kind,
        Guid actor, CancellationToken token)
    {
        var sql = $"""
            WITH inserted AS (
                INSERT INTO vacation.leave_balance_entries
                    (employee_id, leave_type_id, leave_year, entry_kind, quantity_days,
                     effective_date, actor_user_id, reason, explanation, source_reference)
                SELECT employees.id, leave_types.id, @LeaveYear, @Kind, @QuantityDays,
                       @EffectiveDate, users.id, @Reason, @Explanation, @SourceReference
                FROM organization.employees AS employees
                CROSS JOIN vacation.leave_types AS leave_types
                CROSS JOIN identity.users AS users
                WHERE employees.public_id = @EmployeeId
                  AND leave_types.public_id = @LeaveTypeId
                  AND users.public_id = @Actor
                RETURNING *
            )
            SELECT {Projection.Replace("entries.", "inserted.")}
            FROM inserted
            INNER JOIN organization.employees AS employees ON employees.id = inserted.employee_id
            INNER JOIN vacation.leave_types AS leave_types ON leave_types.id = inserted.leave_type_id
            LEFT JOIN identity.users AS users ON users.id = inserted.actor_user_id
            """;
        return await connection.QuerySingleOrDefaultAsync<LeaveBalanceEntryRecord>(
            new CommandDefinition(sql, new { command.EmployeeId, command.LeaveTypeId,
                command.LeaveYear, Kind = kind, command.QuantityDays, command.EffectiveDate,
                command.Reason, command.Explanation, command.SourceReference, Actor = actor },
                transaction, cancellationToken: token));
    }

    public async Task UpsertCompatibilityBalanceAsync(NpgsqlConnection connection,
        NpgsqlTransaction transaction, PostLeaveBalanceEntryCommand command,
        CancellationToken token)
    {
        const string sql = """
            INSERT INTO vacation.leave_balances
                (employee_id, leave_type_id, year, entitlement_days,
                 carry_over_days, adjustment_days)
            SELECT employees.id, leave_types.id, @LeaveYear,
                   coalesce(sum(entries.quantity_days)
                       FILTER (WHERE entries.entry_kind = 'annual_entitlement'), 0),
                   coalesce(sum(entries.quantity_days)
                       FILTER (WHERE entries.entry_kind = 'carry_over'), 0),
                   coalesce(sum(entries.quantity_days)
                       FILTER (WHERE entries.entry_kind = 'manual_adjustment'), 0)
            FROM organization.employees AS employees
            CROSS JOIN vacation.leave_types AS leave_types
            INNER JOIN vacation.leave_balance_entries AS entries
                ON entries.employee_id = employees.id
               AND entries.leave_type_id = leave_types.id
               AND entries.leave_year = @LeaveYear
            WHERE employees.public_id = @EmployeeId
              AND leave_types.public_id = @LeaveTypeId
            GROUP BY employees.id, leave_types.id
            ON CONFLICT (employee_id, leave_type_id, year) DO UPDATE
            SET entitlement_days = excluded.entitlement_days,
                carry_over_days = excluded.carry_over_days,
                adjustment_days = excluded.adjustment_days,
                updated_at = now()
            """;
        var affected = await connection.ExecuteAsync(new CommandDefinition(sql, new
        {
            command.EmployeeId,
            command.LeaveTypeId,
            command.LeaveYear
        }, transaction, cancellationToken: token));
        if (affected != 1)
            throw new InvalidOperationException("The leave balance scope could not be resolved.");
    }

    public Task InsertRequestConsumptionAsync(NpgsqlConnection connection,
        NpgsqlTransaction transaction, LeaveRequestEntity request, Guid actor,
        CancellationToken token) => InsertRequestEntryAsync(connection, transaction, request,
        actor, "request_consumption", -request.WorkingDays,
        "Approved leave request.", null, token);

    public Task InsertCancellationReversalAsync(NpgsqlConnection connection,
        NpgsqlTransaction transaction, LeaveRequestEntity request, Guid actor,
        CancellationToken token) => InsertRequestEntryAsync(connection, transaction, request,
        actor, "cancellation_reversal", request.WorkingDays,
        "Approved leave request cancellation.", "request_consumption", token);

    private static async Task InsertRequestEntryAsync(NpgsqlConnection connection,
        NpgsqlTransaction transaction, LeaveRequestEntity request, Guid actor, string kind,
        decimal quantityDays, string reason, string? reversesConsumption, CancellationToken token)
    {
        const string sql = """
            INSERT INTO vacation.leave_balance_entries
                (employee_id, leave_type_id, leave_year, entry_kind, quantity_days,
                 effective_date, actor_user_id, reason, source_reference,
                 leave_request_id, reverses_entry_id)
            SELECT @EmployeeId, @LeaveTypeId, @LeaveYear, @Kind, @QuantityDays,
                   @EffectiveDate, users.id, @Reason, @SourceReference, @RequestId,
                   CASE WHEN @ReversesConsumption IS NULL THEN NULL ELSE (
                       SELECT original.id
                       FROM vacation.leave_balance_entries AS original
                       WHERE original.entry_kind = @ReversesConsumption
                         AND original.leave_request_id = @RequestId) END
            FROM identity.users AS users
            WHERE users.public_id = @Actor
            """;
        var affected = await connection.ExecuteAsync(new CommandDefinition(sql, new
        {
            request.EmployeeId,
            request.LeaveTypeId,
            LeaveYear = request.DateFrom.Year,
            Kind = kind,
            QuantityDays = quantityDays,
            EffectiveDate = request.DateFrom,
            Reason = reason,
            SourceReference = request.Id.ToString(),
            RequestId = request.Id,
            ReversesConsumption = reversesConsumption,
            Actor = actor
        }, transaction, cancellationToken: token));
        if (affected != 1)
            throw new InvalidOperationException("The authenticated actor could not be resolved.");
    }

    public async Task<bool> EmployeeExistsAsync(NpgsqlConnection connection, NpgsqlTransaction transaction,
        Guid id, CancellationToken token) => await connection.ExecuteScalarAsync<bool>(new CommandDefinition(
            "SELECT EXISTS (SELECT 1 FROM organization.employees WHERE public_id = @Id)", new { Id = id }, transaction, cancellationToken: token));

    public async Task<bool> LeaveTypeExistsAsync(NpgsqlConnection connection, NpgsqlTransaction transaction,
        Guid id, CancellationToken token) => await connection.ExecuteScalarAsync<bool>(new CommandDefinition(
            "SELECT EXISTS (SELECT 1 FROM vacation.leave_types WHERE public_id = @Id)", new { Id = id }, transaction, cancellationToken: token));

    public async Task<bool> LeaveTypeRequiresBalanceAsync(NpgsqlConnection connection, NpgsqlTransaction transaction,
        Guid id, CancellationToken token) => await connection.ExecuteScalarAsync<bool>(new CommandDefinition(
            "SELECT EXISTS (SELECT 1 FROM vacation.leave_types WHERE public_id = @Id AND requires_balance)", new { Id = id }, transaction, cancellationToken: token));

    public async Task<LeaveBalanceLedgerResponse?> GetBalanceAsync(Guid employeeId, Guid leaveTypeId, int leaveYear, CancellationToken token)
    {
        const string sql = """
            SELECT employees.public_id AS EmployeeId, leave_types.public_id AS LeaveTypeId,
                   entries.leave_year AS LeaveYear, sum(entries.quantity_days) AS BalanceDays
            FROM vacation.leave_balance_entries AS entries
            INNER JOIN organization.employees AS employees ON employees.id = entries.employee_id
            INNER JOIN vacation.leave_types AS leave_types ON leave_types.id = entries.leave_type_id
            WHERE employees.public_id = @EmployeeId AND leave_types.public_id = @LeaveTypeId
              AND entries.leave_year = @LeaveYear
            GROUP BY employees.public_id, leave_types.public_id, entries.leave_year
            """;
        await using var connection = await dataSource.OpenConnectionAsync(token);
        return await connection.QuerySingleOrDefaultAsync<LeaveBalanceLedgerResponse>(new CommandDefinition(sql,
            new { EmployeeId = employeeId, LeaveTypeId = leaveTypeId, LeaveYear = leaveYear }, cancellationToken: token));
    }

    public async Task<IReadOnlyList<LeaveBalanceEntryRecord>> ListHistoryAsync(Guid employeeId, Guid leaveTypeId, int leaveYear, CancellationToken token)
    {
        var sql = $"""
            SELECT {Projection}
            FROM vacation.leave_balance_entries AS entries
            INNER JOIN organization.employees AS employees ON employees.id = entries.employee_id
            INNER JOIN vacation.leave_types AS leave_types ON leave_types.id = entries.leave_type_id
            LEFT JOIN identity.users AS users ON users.id = entries.actor_user_id
            WHERE employees.public_id = @EmployeeId AND leave_types.public_id = @LeaveTypeId
              AND entries.leave_year = @LeaveYear
            ORDER BY entries.accepted_at, entries.id
            """;
        await using var connection = await dataSource.OpenConnectionAsync(token);
        var rows = await connection.QueryAsync<LeaveBalanceEntryRecord>(new CommandDefinition(sql,
            new { EmployeeId = employeeId, LeaveTypeId = leaveTypeId, LeaveYear = leaveYear }, cancellationToken: token));
        return rows.AsList();
    }
}
