using Dapper;
using Npgsql;

namespace InternalApps.Api.Modules.Vacation;

internal sealed class LeavePoliciesRepository(NpgsqlDataSource dataSource)
{
    private const string Projection = """
        policies.public_id AS PublicId,
        employees.public_id AS EmployeeId,
        employees.employee_number AS EmployeeNumber,
        concat_ws(' ', employees.first_name, employees.last_name) AS EmployeeName,
        policies.leave_year AS LeaveYear,
        policies.annual_entitlement_days AS AnnualEntitlementDays,
        policies.carry_over_days AS CarryOverDays,
        policies.carry_over_expiration_date AS CarryOverExpirationDate,
        policies.manual_adjustment_days AS ManualAdjustmentDays,
        policies.notes AS Notes,
        policies.created_at AS CreatedAt,
        policies.updated_at AS UpdatedAt
        """;

    public async Task<IReadOnlyList<LeavePolicyRecord>> ListAsync(
        int? leaveYear, Guid? employeeId, CancellationToken token)
    {
        var sql = $"""
            SELECT {Projection}
            FROM vacation.leave_policies AS policies
            INNER JOIN organization.employees
                ON employees.id = policies.employee_id
            WHERE (@LeaveYear IS NULL OR policies.leave_year = @LeaveYear)
              AND (@EmployeeId IS NULL OR employees.public_id = @EmployeeId)
            ORDER BY employees.last_name, employees.first_name,
                employees.employee_number, policies.leave_year
            """;
        await using var connection = await dataSource.OpenConnectionAsync(token);
        var rows = await connection.QueryAsync<LeavePolicyRecord>(
            new CommandDefinition(sql, new { LeaveYear = leaveYear, EmployeeId = employeeId },
                cancellationToken: token));
        return rows.AsList();
    }

    public async Task<LeavePolicyRecord?> GetAsync(Guid publicId, CancellationToken token)
    {
        await using var connection = await dataSource.OpenConnectionAsync(token);
        return await GetAsync(connection, null, publicId, false, token);
    }

    public Task<LeavePolicyRecord?> GetForUpdateAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        Guid publicId, CancellationToken token) =>
        GetAsync(connection, transaction, publicId, true, token);

    public Task<long?> ResolveEmployeeIdAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        Guid employeeId, CancellationToken token) =>
        connection.QuerySingleOrDefaultAsync<long?>(new CommandDefinition(
            "SELECT id FROM organization.employees WHERE public_id = @EmployeeId",
            new { EmployeeId = employeeId }, transaction, cancellationToken: token));

    public async Task<LeavePolicyRecord> CreateAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        SaveLeavePolicyCommand command, long employeeId, CancellationToken token)
    {
        var publicId = await connection.ExecuteScalarAsync<Guid>(new CommandDefinition(
            """
            INSERT INTO vacation.leave_policies
                (employee_id, leave_year, annual_entitlement_days, carry_over_days,
                 carry_over_expiration_date, manual_adjustment_days, notes)
            VALUES
                (@EmployeeId, @LeaveYear, @AnnualEntitlementDays, @CarryOverDays,
                 @CarryOverExpirationDate, @ManualAdjustmentDays, @Notes)
            RETURNING public_id
            """,
            new { EmployeeId = employeeId, command.LeaveYear,
                command.AnnualEntitlementDays, command.CarryOverDays,
                command.CarryOverExpirationDate, command.ManualAdjustmentDays,
                command.Notes }, transaction, cancellationToken: token));
        return (await GetAsync(connection, transaction, publicId, false, token))!;
    }

    public async Task<LeavePolicyRecord> UpdateAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        Guid publicId, SaveLeavePolicyCommand command, long employeeId,
        CancellationToken token)
    {
        await connection.ExecuteAsync(new CommandDefinition(
            """
            UPDATE vacation.leave_policies
            SET employee_id = @EmployeeId, leave_year = @LeaveYear,
                annual_entitlement_days = @AnnualEntitlementDays,
                carry_over_days = @CarryOverDays,
                carry_over_expiration_date = @CarryOverExpirationDate,
                manual_adjustment_days = @ManualAdjustmentDays, notes = @Notes,
                updated_at = now()
            WHERE public_id = @PublicId
            """,
            new { PublicId = publicId, EmployeeId = employeeId, command.LeaveYear,
                command.AnnualEntitlementDays, command.CarryOverDays,
                command.CarryOverExpirationDate, command.ManualAdjustmentDays,
                command.Notes }, transaction, cancellationToken: token));
        return (await GetAsync(connection, transaction, publicId, false, token))!;
    }

    public Task DeleteAsync(NpgsqlConnection connection, NpgsqlTransaction transaction,
        Guid publicId, CancellationToken token) =>
        connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM vacation.leave_policies WHERE public_id = @PublicId",
            new { PublicId = publicId }, transaction, cancellationToken: token));

    private static Task<LeavePolicyRecord?> GetAsync(
        NpgsqlConnection connection, NpgsqlTransaction? transaction,
        Guid publicId, bool forUpdate, CancellationToken token)
    {
        var sql = $"""
            SELECT {Projection}
            FROM vacation.leave_policies AS policies
            INNER JOIN organization.employees
                ON employees.id = policies.employee_id
            WHERE policies.public_id = @PublicId
            {(forUpdate ? "FOR UPDATE OF policies" : "")}
            """;
        return connection.QuerySingleOrDefaultAsync<LeavePolicyRecord>(
            new CommandDefinition(sql, new { PublicId = publicId }, transaction,
                cancellationToken: token));
    }
}
