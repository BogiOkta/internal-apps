using Dapper;
using Npgsql;
using System.Data;

namespace InternalApps.Api.Modules.Vacation;

internal sealed class LeaveRequestsRepository(NpgsqlDataSource dataSource)
{
    private const string RequestProjection = """
        requests.public_id AS PublicId,
        employees.public_id AS EmployeePublicId,
        employees.employee_number AS EmployeeNumber,
        concat(employees.first_name, ' ', employees.last_name) AS EmployeeName,
        departments.public_id AS DepartmentPublicId,
        departments.name AS DepartmentName,
        leave_types.public_id AS LeaveTypePublicId,
        leave_types.code AS LeaveTypeCode,
        leave_types.name_sr AS LeaveTypeNameSr,
        leave_types.name_en AS LeaveTypeNameEn,
        leave_types.calendar_color AS LeaveTypeColor,
        requests.date_from AS DateFrom,
        requests.date_to AS DateTo,
        requests.working_days AS WorkingDays,
        requests.status AS Status,
        requests.source AS Source,
        requests.employee_note AS EmployeeNote,
        requests.decision_note AS DecisionNote,
        requests.submitted_at AS SubmittedAt,
        requests.decided_at AS DecidedAt,
        requests.cancelled_at AS CancelledAt,
        requests.created_at AS CreatedAt,
        requests.updated_at AS UpdatedAt
        """;

    private const string RequestJoins = """
        FROM vacation.leave_requests AS requests
        INNER JOIN organization.employees AS employees ON employees.id = requests.employee_id
        INNER JOIN organization.departments AS departments ON departments.id = employees.department_id
        INNER JOIN vacation.leave_types AS leave_types ON leave_types.id = requests.leave_type_id
        """;

    public async Task<IReadOnlyList<LeaveTypeOptionResponse>> ListActiveLeaveTypesAsync(
        bool english, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT public_id AS PublicId, code AS Code,
                   name_sr AS NameSr, name_en AS NameEn,
                   description_sr AS DescriptionSr, description_en AS DescriptionEn,
                   calendar_color AS Color,
                   counts_against_vacation_balance AS CountsAgainstBalance,
                   requires_balance AS RequiresBalance
            FROM vacation.leave_types
            WHERE is_active = true
            ORDER BY display_order, lower(code), public_id
            """;
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync<LeaveTypeOptionRow>(
            new CommandDefinition(sql, cancellationToken: cancellationToken));
        return rows.Select(row => new LeaveTypeOptionResponse(
            row.PublicId, row.Code, english ? row.NameEn : row.NameSr,
            english ? row.DescriptionEn : row.DescriptionSr, row.Color,
            row.CountsAgainstBalance, row.RequiresBalance)).ToArray();
    }

    public async Task<LeaveTypeEntity?> GetLeaveTypeAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        Guid publicId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT id, public_id AS PublicId, is_active AS IsActive,
                   requires_balance AS RequiresBalance
            FROM vacation.leave_types
            WHERE public_id = @PublicId
            """;
        return await connection.QuerySingleOrDefaultAsync<LeaveTypeEntity>(
            new CommandDefinition(sql, new { PublicId = publicId }, transaction,
                cancellationToken: cancellationToken));
    }

    public async Task<EmployeeTargetEntity?> GetEmployeeAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        Guid publicId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT id AS Id, public_id AS PublicId, employment_status AS EmploymentStatus
            FROM organization.employees
            WHERE public_id = @PublicId
            """;
        return await connection.QuerySingleOrDefaultAsync<EmployeeTargetEntity>(
            new CommandDefinition(sql, new { PublicId = publicId }, transaction,
                cancellationToken: cancellationToken));
    }

    public async Task<LeaveRequestResponse> CreateAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        Guid employeePublicId, Guid leaveTypePublicId, Guid actorUserPublicId,
        DateOnly dateFrom, DateOnly dateTo, int workingDays, string? note,
        bool english, CancellationToken cancellationToken)
        => await CreateAsync(connection, transaction, employeePublicId, leaveTypePublicId,
            actorUserPublicId, dateFrom, dateTo, workingDays, note,
            LeaveRequestStatuses.Submitted, LeaveRequestSources.EmployeeRequest, false,
            english, cancellationToken);

    public async Task<LeaveRequestResponse> CreateAdministrativeAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        Guid employeePublicId, Guid leaveTypePublicId, Guid actorUserPublicId,
        DateOnly dateFrom, DateOnly dateTo, int workingDays, string? note,
        bool english, CancellationToken cancellationToken)
        => await CreateAsync(connection, transaction, employeePublicId, leaveTypePublicId,
            actorUserPublicId, dateFrom, dateTo, workingDays, note,
            LeaveRequestStatuses.Approved, LeaveRequestSources.AdministrativeEntry, true,
            english, cancellationToken);

    private async Task<LeaveRequestResponse> CreateAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        Guid employeePublicId, Guid leaveTypePublicId, Guid actorUserPublicId,
        DateOnly dateFrom, DateOnly dateTo, int workingDays, string? note,
        string status, string source, bool decided, bool english, CancellationToken cancellationToken)
    {
        var sql = $"""
            WITH inserted AS (
                INSERT INTO vacation.leave_requests (
                    employee_id, leave_type_id, date_from, date_to, working_days,
                    status, source, employee_note, submitted_at, decided_at, decided_by_user_id,
                    created_by_user_id
                )
                SELECT employees.id, leave_types.id, @DateFrom, @DateTo, @WorkingDays,
                       @Status, @Source, @Note, now(),
                       CASE WHEN @Decided THEN now() ELSE NULL END,
                       CASE WHEN @Decided THEN users.id ELSE NULL END, users.id
                FROM organization.employees AS employees
                CROSS JOIN vacation.leave_types AS leave_types
                CROSS JOIN identity.users AS users
                WHERE employees.public_id = @EmployeePublicId
                  AND leave_types.public_id = @LeaveTypePublicId
                  AND users.public_id = @ActorUserPublicId
                RETURNING *
            )
            SELECT {RequestProjection.Replace("requests.", "inserted.")}
            {RequestJoins.Replace("vacation.leave_requests AS requests", "inserted")
                .Replace("requests.", "inserted.")}
            """;
        try
        {
            var row = await connection.QuerySingleAsync<LeaveRequestRow>(
                new CommandDefinition(sql, new
                {
                    EmployeePublicId = employeePublicId,
                    LeaveTypePublicId = leaveTypePublicId,
                    ActorUserPublicId = actorUserPublicId,
                    DateFrom = dateFrom,
                    DateTo = dateTo,
                    WorkingDays = workingDays,
                    Note = note,
                    Status = status,
                    Source = source,
                    Decided = decided
                }, transaction, cancellationToken: cancellationToken));
            return Map(row, english);
        }
        catch (PostgresException exception) when (
            exception.SqlState == PostgresErrorCodes.ExclusionViolation &&
            exception.ConstraintName ==
                "ex_vacation_leave_requests_employee_active_overlap")
        {
            throw new LeaveRequestOverlapException();
        }
    }

    public async Task<IReadOnlyList<LeaveRequestResponse>> ListForEmployeeAsync(
        Guid employeePublicId, bool english, CancellationToken cancellationToken)
    {
        var sql = $"SELECT {RequestProjection} {RequestJoins} " +
                  "WHERE employees.public_id = @EmployeePublicId " +
                  "ORDER BY requests.date_from DESC, requests.public_id";
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync<LeaveRequestRow>(
            new CommandDefinition(sql, new { EmployeePublicId = employeePublicId },
                cancellationToken: cancellationToken));
        return rows.Select(row => Map(row, english)).ToArray();
    }

    public async Task<LeaveRequestResponse?> GetAsync(
        Guid publicId, Guid? employeePublicId, bool english,
        CancellationToken cancellationToken)
    {
        var sql = $"SELECT {RequestProjection} {RequestJoins} " +
                  "WHERE requests.public_id = @PublicId " +
                  "AND (@EmployeePublicId IS NULL OR employees.public_id = @EmployeePublicId)";
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync<LeaveRequestRow>(
            new CommandDefinition(sql, new
            {
                PublicId = publicId,
                EmployeePublicId = employeePublicId
            }, cancellationToken: cancellationToken));
        return row is null ? null : Map(row, english);
    }

    public async Task<PagedLeaveRequestsResponse> ListAdminAsync(
        LeaveRequestAdminQuery query, bool english, CancellationToken cancellationToken)
    {
        const string where = """
            WHERE (@EmployeeId IS NULL OR employees.public_id = @EmployeeId)
              AND (@DepartmentId IS NULL OR departments.public_id = @DepartmentId)
              AND (@LeaveTypeId IS NULL OR leave_types.public_id = @LeaveTypeId)
              AND (@Status IS NULL OR requests.status = @Status)
              AND (@Source IS NULL OR requests.source = @Source)
              AND (@DateFrom IS NULL OR requests.date_to >= @DateFrom)
              AND (@DateTo IS NULL OR requests.date_from <= @DateTo)
              AND (@SearchPattern IS NULL
                   OR employees.employee_number ILIKE @SearchPattern
                   OR employees.first_name ILIKE @SearchPattern
                   OR employees.last_name ILIKE @SearchPattern
                   OR employees.email ILIKE @SearchPattern)
            """;
        var parameters = new DynamicParameters();
        parameters.Add("EmployeeId", query.EmployeeId, DbType.Guid);
        parameters.Add("DepartmentId", query.DepartmentId, DbType.Guid);
        parameters.Add("LeaveTypeId", query.LeaveTypeId, DbType.Guid);
        parameters.Add("Status", query.Status, DbType.String);
        parameters.Add("Source", query.Source, DbType.String);
        parameters.Add("DateFrom", query.DateFrom, DbType.Date);
        parameters.Add("DateTo", query.DateTo, DbType.Date);
        parameters.Add("SearchPattern", string.IsNullOrWhiteSpace(query.Search)
            ? null : $"%{query.Search.Trim()}%", DbType.String);
        parameters.Add("Offset", (query.Page - 1) * query.PageSize, DbType.Int32);
        parameters.Add("PageSize", query.PageSize, DbType.Int32);
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var count = await connection.ExecuteScalarAsync<long>(
            new CommandDefinition($"SELECT count(*) {RequestJoins} {where}",
                parameters, cancellationToken: cancellationToken));
        var rows = await connection.QueryAsync<LeaveRequestRow>(
            new CommandDefinition(
                $"SELECT {RequestProjection} {RequestJoins} {where} " +
                "ORDER BY requests.submitted_at DESC, requests.public_id " +
                "OFFSET @Offset LIMIT @PageSize",
                parameters, cancellationToken: cancellationToken));
        return new(rows.Select(row => Map(row, english)).ToArray(),
            query.Page, query.PageSize, count);
    }

    public async Task<LeaveRequestEntity?> GetForUpdateAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        Guid publicId, Guid? employeePublicId, CancellationToken cancellationToken)
    {
        const string sql = """
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
            WHERE requests.public_id = @PublicId
              AND (@EmployeePublicId IS NULL OR employees.public_id = @EmployeePublicId)
            FOR UPDATE OF requests
            """;
        return await connection.QuerySingleOrDefaultAsync<LeaveRequestEntity>(
            new CommandDefinition(sql, new
            {
                PublicId = publicId,
                EmployeePublicId = employeePublicId
            }, transaction, cancellationToken: cancellationToken));
    }

    public async Task<LeaveRequestResponse> SetStatusAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        long id, string status, string? comment, Guid actorUserPublicId,
        bool english, CancellationToken cancellationToken)
    {
        var decision = status is LeaveRequestStatuses.Approved or LeaveRequestStatuses.Rejected;
        var cancellation = status == LeaveRequestStatuses.Cancelled;
        var sql = $"""
            WITH updated AS (
                UPDATE vacation.leave_requests
                SET status = @Status,
                    decision_note = CASE WHEN @Decision THEN @Comment ELSE decision_note END,
                    decided_at = CASE WHEN @Decision THEN now() ELSE decided_at END,
                    decided_by_user_id = CASE WHEN @Decision
                        THEN (SELECT id FROM identity.users WHERE public_id = @ActorUserPublicId)
                        ELSE decided_by_user_id END,
                    cancelled_at = CASE WHEN @Cancellation THEN now() ELSE cancelled_at END,
                    cancelled_by_user_id = CASE WHEN @Cancellation
                        THEN (SELECT id FROM identity.users WHERE public_id = @ActorUserPublicId)
                        ELSE cancelled_by_user_id END,
                    updated_at = now()
                WHERE id = @Id
                RETURNING *
            )
            SELECT {RequestProjection.Replace("requests.", "updated.")}
            {RequestJoins.Replace("vacation.leave_requests AS requests", "updated")
                .Replace("requests.", "updated.")}
            """;
        var row = await connection.QuerySingleAsync<LeaveRequestRow>(
            new CommandDefinition(sql, new
            {
                Id = id,
                Status = status,
                Comment = comment,
                ActorUserPublicId = actorUserPublicId,
                Decision = decision,
                Cancellation = cancellation
            }, transaction, cancellationToken: cancellationToken));
        return Map(row, english);
    }

    public Task InsertHistoryAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        long requestId, string? previousStatus, string newStatus,
        Guid actorUserPublicId, string? comment, CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO vacation.leave_request_history (
                leave_request_id, previous_status, new_status,
                changed_by_user_id, comment
            )
            SELECT @RequestId, @PreviousStatus, @NewStatus, users.id, @Comment
            FROM identity.users AS users
            WHERE users.public_id = @ActorUserPublicId
            """;
        return connection.ExecuteAsync(new CommandDefinition(sql, new
        {
            RequestId = requestId,
            PreviousStatus = previousStatus,
            NewStatus = newStatus,
            ActorUserPublicId = actorUserPublicId,
            Comment = comment
        }, transaction, cancellationToken: cancellationToken));
    }

    public async Task<IReadOnlyList<LeaveRequestHistoryResponse>> ListHistoryAsync(
        Guid requestPublicId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT history.public_id AS PublicId,
                   history.previous_status AS PreviousStatus,
                   history.new_status AS NewStatus,
                   users.public_id AS ChangedByUserPublicId,
                   users.display_name AS ChangedByDisplayName,
                   history.comment AS Comment,
                   history.changed_at AS ChangedAt
            FROM vacation.leave_request_history AS history
            INNER JOIN vacation.leave_requests AS requests
                ON requests.id = history.leave_request_id
            INNER JOIN identity.users AS users ON users.id = history.changed_by_user_id
            WHERE requests.public_id = @RequestPublicId
            ORDER BY history.changed_at, history.id
            """;
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync<LeaveRequestHistoryRow>(
            new CommandDefinition(sql, new { RequestPublicId = requestPublicId },
                cancellationToken: cancellationToken));
        return rows.Select(row => new LeaveRequestHistoryResponse(
            row.PublicId,
            row.PreviousStatus,
            row.NewStatus,
            row.ChangedByUserPublicId,
            row.ChangedByDisplayName,
            row.Comment,
            new DateTimeOffset(row.ChangedAt))).ToArray();
    }

    public async Task<IReadOnlyList<LeaveBalanceResponse>> ListBalancesAsync(
        Guid employeePublicId, bool english, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT balances.public_id AS PublicId,
                   employees.public_id AS EmployeePublicId,
                   leave_types.public_id AS LeaveTypePublicId,
                   leave_types.code AS LeaveTypeCode,
                   leave_types.name_sr AS LeaveTypeNameSr,
                   leave_types.name_en AS LeaveTypeNameEn,
                   balances.year AS Year,
                   balances.entitlement_days AS EntitlementDays,
                   balances.carry_over_days AS CarryOverDays,
                   balances.adjustment_days AS AdjustmentDays,
                   balances.used_days AS UsedDays
            FROM vacation.leave_balances AS balances
            INNER JOIN organization.employees AS employees ON employees.id = balances.employee_id
            INNER JOIN vacation.leave_types AS leave_types ON leave_types.id = balances.leave_type_id
            WHERE employees.public_id = @EmployeePublicId
            ORDER BY balances.year DESC, leave_types.display_order, leave_types.public_id
            """;
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync<LeaveBalanceRow>(
            new CommandDefinition(sql, new { EmployeePublicId = employeePublicId },
                cancellationToken: cancellationToken));
        return rows.Select(row => new LeaveBalanceResponse(
            row.PublicId, row.EmployeePublicId, row.LeaveTypePublicId,
            row.LeaveTypeCode, english ? row.LeaveTypeNameEn : row.LeaveTypeNameSr,
            row.Year, row.EntitlementDays, row.CarryOverDays, row.AdjustmentDays,
            row.UsedDays, row.EntitlementDays + row.CarryOverDays +
                          row.AdjustmentDays - row.UsedDays)).ToArray();
    }

    public async Task<LeaveBalanceEntity?> GetBalanceForUpdateAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        long employeeId, long leaveTypeId, int year,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT id, public_id AS PublicId, entitlement_days AS EntitlementDays,
                   carry_over_days AS CarryOverDays,
                   adjustment_days AS AdjustmentDays, used_days AS UsedDays
            FROM vacation.leave_balances
            WHERE employee_id = @EmployeeId AND leave_type_id = @LeaveTypeId
              AND year = @Year
            FOR UPDATE
            """;
        return await connection.QuerySingleOrDefaultAsync<LeaveBalanceEntity>(
            new CommandDefinition(sql, new
            {
                EmployeeId = employeeId,
                LeaveTypeId = leaveTypeId,
                Year = year
            }, transaction, cancellationToken: cancellationToken));
    }

    public Task UpdateUsedDaysAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        long balanceId, int usedDays, CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE vacation.leave_balances
            SET used_days = @UsedDays, updated_at = now()
            WHERE id = @BalanceId
            """;
        return connection.ExecuteAsync(new CommandDefinition(sql,
            new { BalanceId = balanceId, UsedDays = usedDays }, transaction,
            cancellationToken: cancellationToken));
    }

    private static LeaveRequestResponse Map(LeaveRequestRow row, bool english) =>
        new(row.PublicId, row.EmployeePublicId, row.EmployeeNumber, row.EmployeeName,
            row.DepartmentPublicId, row.DepartmentName, row.LeaveTypePublicId,
            row.LeaveTypeCode, english ? row.LeaveTypeNameEn : row.LeaveTypeNameSr,
            row.LeaveTypeColor, row.DateFrom, row.DateTo, row.WorkingDays, row.Status, row.Source,
            row.EmployeeNote, row.DecisionNote, row.SubmittedAt, row.DecidedAt,
            row.CancelledAt, row.CreatedAt, row.UpdatedAt);

    private sealed class LeaveTypeOptionRow
    {
        public Guid PublicId { get; set; }
        public string Code { get; set; } = "";
        public string NameSr { get; set; } = "";
        public string NameEn { get; set; } = "";
        public string? DescriptionSr { get; set; }
        public string? DescriptionEn { get; set; }
        public string? Color { get; set; }
        public bool CountsAgainstBalance { get; set; }
        public bool RequiresBalance { get; set; }
    }

    private sealed class LeaveRequestRow
    {
        public Guid PublicId { get; set; }
        public Guid EmployeePublicId { get; set; }
        public string EmployeeNumber { get; set; } = "";
        public string EmployeeName { get; set; } = "";
        public Guid DepartmentPublicId { get; set; }
        public string DepartmentName { get; set; } = "";
        public Guid LeaveTypePublicId { get; set; }
        public string LeaveTypeCode { get; set; } = "";
        public string LeaveTypeNameSr { get; set; } = "";
        public string LeaveTypeNameEn { get; set; } = "";
        public string? LeaveTypeColor { get; set; }
        public DateOnly DateFrom { get; set; }
        public DateOnly DateTo { get; set; }
        public int WorkingDays { get; set; }
        public string Status { get; set; } = "";
        public string Source { get; set; } = "";
        public string? EmployeeNote { get; set; }
        public string? DecisionNote { get; set; }
        public DateTimeOffset SubmittedAt { get; set; }
        public DateTimeOffset? DecidedAt { get; set; }
        public DateTimeOffset? CancelledAt { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }

    private sealed class LeaveBalanceRow
    {
        public Guid PublicId { get; set; }
        public Guid EmployeePublicId { get; set; }
        public Guid LeaveTypePublicId { get; set; }
        public string LeaveTypeCode { get; set; } = "";
        public string LeaveTypeNameSr { get; set; } = "";
        public string LeaveTypeNameEn { get; set; } = "";
        public int Year { get; set; }
        public decimal EntitlementDays { get; set; }
        public decimal CarryOverDays { get; set; }
        public decimal AdjustmentDays { get; set; }
        public int UsedDays { get; set; }
    }

    private sealed class LeaveRequestHistoryRow
    {
        public Guid PublicId { get; set; }
        public string? PreviousStatus { get; set; }
        public string NewStatus { get; set; } = "";
        public Guid ChangedByUserPublicId { get; set; }
        public string ChangedByDisplayName { get; set; } = "";
        public string? Comment { get; set; }
        public DateTime ChangedAt { get; set; }
    }
}

internal sealed record EmployeeTargetEntity(long Id, Guid PublicId, string EmploymentStatus);

internal sealed class LeaveRequestOverlapException : Exception;
