using Dapper;
using Npgsql;

namespace InternalApps.Api.Modules.Vacation;

internal sealed class LeaveTypesRepository(NpgsqlDataSource dataSource)
{
    /// <summary>
    /// A leave type is "in use" once any Vacation request, yearly balance, or
    /// append-only balance entry has referenced it. That state permanently locks the
    /// balance-behaviour fields and blocks physical deletion.
    /// </summary>
    private const string UsageProjection = """
        (
            EXISTS (
                SELECT 1 FROM vacation.leave_requests AS used_requests
                WHERE used_requests.leave_type_id = leave_types.id
            )
            OR EXISTS (
                SELECT 1 FROM vacation.leave_balances AS used_balances
                WHERE used_balances.leave_type_id = leave_types.id
            )
            OR EXISTS (
                SELECT 1 FROM vacation.leave_balance_entries AS used_entries
                WHERE used_entries.leave_type_id = leave_types.id
            )
        )
        """;

    private const string Projection = $"""
        leave_types.public_id AS PublicId,
        leave_types.code AS Code,
        leave_types.name_sr AS NameSr,
        leave_types.name_en AS NameEn,
        leave_types.description_sr AS DescriptionSr,
        leave_types.description_en AS DescriptionEn,
        leave_types.calendar_color AS CalendarColor,
        leave_types.counts_against_vacation_balance AS CountsAgainstVacationBalance,
        leave_types.requires_balance AS RequiresBalance,
        leave_types.requires_approval AS RequiresApproval,
        leave_types.is_active AS IsActive,
        leave_types.is_system AS IsSystem,
        leave_types.display_order AS DisplayOrder,
        {UsageProjection} AS IsInUse
        """;

    public async Task<IReadOnlyList<LeaveTypeRecord>> ListAsync(
        LeaveTypeListQuery query,
        LeaveTypeLocale locale,
        CancellationToken cancellationToken)
    {
        var select = $"""
            SELECT
                {Projection}
            FROM vacation.leave_types AS leave_types
            WHERE (
                    @IsActive IS NULL
                    OR leave_types.is_active = @IsActive
                  )
              AND (
                    @SearchPattern IS NULL
                    OR leave_types.code ILIKE @SearchPattern
                    OR leave_types.name_sr ILIKE @SearchPattern
                    OR leave_types.name_en ILIKE @SearchPattern
                    OR leave_types.description_sr ILIKE @SearchPattern
                    OR leave_types.description_en ILIKE @SearchPattern
                  )
            """;

        var sql = select + GetOrderBy(query.SortBy, query.SortDirection, locale);
        var parameters = new
        {
            IsActive = ToIsActive(query.Status),
            SearchPattern = ToSearchPattern(query.Search)
        };

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync<LeaveTypeRow>(
            new CommandDefinition(
                sql,
                parameters,
                cancellationToken: cancellationToken));

        return rows.Select(ToRecord).ToArray();
    }

    public async Task<LeaveTypeRecord?> GetByPublicIdAsync(
        Guid publicId,
        CancellationToken cancellationToken)
    {
        var sql = $"""
            SELECT
                {Projection}
            FROM vacation.leave_types AS leave_types
            WHERE leave_types.public_id = @PublicId
            """;

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync<LeaveTypeRow>(
            new CommandDefinition(
                sql,
                new { PublicId = publicId },
                cancellationToken: cancellationToken));

        return row is null ? null : ToRecord(row);
    }

    public async Task<LeaveTypeCreatePersistenceResult> CreateAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        CreateLeaveTypeCommand command,
        CancellationToken cancellationToken)
    {
        var sql = $"""
            INSERT INTO vacation.leave_types AS leave_types (
                code,
                name_sr,
                name_en,
                description_sr,
                description_en,
                calendar_color,
                counts_against_vacation_balance,
                requires_balance,
                requires_approval,
                is_active,
                display_order
            )
            VALUES (
                @Code,
                @NameSr,
                @NameEn,
                @DescriptionSr,
                @DescriptionEn,
                @CalendarColor,
                @CountsAgainstVacationBalance,
                @RequiresBalance,
                @RequiresApproval,
                @IsActive,
                @DisplayOrder
            )
            RETURNING
                {Projection}
            """;

        try
        {
            var row = await connection.QuerySingleAsync<LeaveTypeRow>(
                new CommandDefinition(
                    sql,
                    command,
                    transaction,
                    cancellationToken: cancellationToken));

            return new LeaveTypeCreatePersistenceResult(ToRecord(row), false);
        }
        catch (PostgresException exception)
            when (exception.SqlState == PostgresErrorCodes.UniqueViolation &&
                  exception.ConstraintName == "uq_vacation_leave_types_code_ci")
        {
            return new LeaveTypeCreatePersistenceResult(null, true);
        }
    }

    public async Task<LeaveTypeRecord?> GetByPublicIdForUpdateAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid publicId,
        CancellationToken cancellationToken)
    {
        var sql = $"""
            SELECT
                {Projection}
            FROM vacation.leave_types AS leave_types
            WHERE leave_types.public_id = @PublicId
            FOR UPDATE
            """;

        var row = await connection.QuerySingleOrDefaultAsync<LeaveTypeRow>(
            new CommandDefinition(
                sql,
                new { PublicId = publicId },
                transaction,
                cancellationToken: cancellationToken));

        return row is null ? null : ToRecord(row);
    }

    public async Task<LeaveTypeRecord> UpdateAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid publicId,
        UpdateLeaveTypeCommand command,
        CancellationToken cancellationToken)
    {
        var sql = $"""
            UPDATE vacation.leave_types AS leave_types
            SET name_sr = @NameSr,
                name_en = @NameEn,
                description_sr = @DescriptionSr,
                description_en = @DescriptionEn,
                calendar_color = @CalendarColor,
                counts_against_vacation_balance = @CountsAgainstVacationBalance,
                requires_balance = @RequiresBalance,
                requires_approval = @RequiresApproval,
                display_order = @DisplayOrder,
                updated_at = now()
            WHERE leave_types.public_id = @PublicId
            RETURNING
                {Projection}
            """;

        var row = await connection.QuerySingleAsync<LeaveTypeRow>(
            new CommandDefinition(
                sql,
                new
                {
                    PublicId = publicId,
                    command.NameSr,
                    command.NameEn,
                    command.DescriptionSr,
                    command.DescriptionEn,
                    command.CalendarColor,
                    command.CountsAgainstVacationBalance,
                    command.RequiresBalance,
                    command.RequiresApproval,
                    command.DisplayOrder
                },
                transaction,
                cancellationToken: cancellationToken));

        return ToRecord(row);
    }

    public async Task<LeaveTypeRecord> SetActiveAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid publicId,
        bool isActive,
        CancellationToken cancellationToken)
    {
        var sql = $"""
            UPDATE vacation.leave_types AS leave_types
            SET is_active = @IsActive,
                updated_at = now()
            WHERE leave_types.public_id = @PublicId
            RETURNING
                {Projection}
            """;

        var row = await connection.QuerySingleAsync<LeaveTypeRow>(
            new CommandDefinition(
                sql,
                new { PublicId = publicId, IsActive = isActive },
                transaction,
                cancellationToken: cancellationToken));

        return ToRecord(row);
    }

    /// <summary>
    /// Live dependency snapshot for the Dependency Inspector. Permanent
    /// protection still governs deletion inside the owner-controlled delete
    /// function, but this query only reads live operational and ledger
    /// references the app role can SELECT.
    /// Live references imply markers exist (owner triggers write them); the
    /// marker-only case after live rows are gone remains enforced at delete time.
    /// </summary>
    public async Task<LeaveTypeDependencySnapshot?> GetDependencySnapshotAsync(
        Guid publicId,
        CancellationToken cancellationToken)
    {
        const string headerSql = $"""
            SELECT
                leave_types.public_id AS PublicId,
                leave_types.is_system AS IsSystem,
                {UsageProjection} AS HasPermanentProtection,
                (
                    SELECT count(*)::int
                    FROM vacation.leave_requests AS used_requests
                    WHERE used_requests.leave_type_id = leave_types.id
                ) AS RequestCount,
                (
                    SELECT count(DISTINCT used_balances.employee_id)::int
                    FROM vacation.leave_balances AS used_balances
                    WHERE used_balances.leave_type_id = leave_types.id
                ) AS BalanceEmployeeCount,
                (
                    SELECT count(*)::int
                    FROM vacation.leave_balance_entries AS used_entries
                    WHERE used_entries.leave_type_id = leave_types.id
                ) AS LedgerEntryCount
            FROM vacation.leave_types AS leave_types
            WHERE leave_types.public_id = @PublicId
            """;

        const string statusSql = """
            SELECT
                used_requests.status AS Status,
                count(*)::int AS Count
            FROM vacation.leave_requests AS used_requests
            INNER JOIN vacation.leave_types AS leave_types
                ON leave_types.id = used_requests.leave_type_id
            WHERE leave_types.public_id = @PublicId
            GROUP BY used_requests.status
            ORDER BY used_requests.status
            """;

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var header = await connection.QuerySingleOrDefaultAsync<LeaveTypeDependencyHeaderRow>(
            new CommandDefinition(
                headerSql,
                new { PublicId = publicId },
                cancellationToken: cancellationToken));

        if (header is null)
        {
            return null;
        }

        var statusRows = await connection.QueryAsync<LeaveTypeRequestStatusCountRow>(
            new CommandDefinition(
                statusSql,
                new { PublicId = publicId },
                cancellationToken: cancellationToken));

        return new LeaveTypeDependencySnapshot(
            header.PublicId,
            header.IsSystem,
            header.HasPermanentProtection,
            header.RequestCount,
            statusRows
                .Select(row => new LeaveTypeRequestStatusCount(row.Status, row.Count))
                .ToArray(),
            header.BalanceEmployeeCount,
            header.LedgerEntryCount);
    }

    /// <summary>
    /// Physical deletion runs only through the owner-controlled SECURITY DEFINER
    /// function; the runtime role holds no DELETE privilege on vacation.leave_types.
    /// </summary>
    public Task<bool> DeleteUnreferencedLeaveTypeAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid publicId,
        CancellationToken cancellationToken) =>
        connection.ExecuteScalarAsync<bool>(
            new CommandDefinition(
                """
                SELECT vacation.delete_unreferenced_leave_type(@PublicId)
                """,
                new { PublicId = publicId },
                transaction,
                cancellationToken: cancellationToken));

    private static bool? ToIsActive(LeaveTypeStatusFilter status) =>
        status switch
        {
            LeaveTypeStatusFilter.Active => true,
            LeaveTypeStatusFilter.Inactive => false,
            _ => null
        };

    private static string? ToSearchPattern(string? search) =>
        string.IsNullOrWhiteSpace(search)
            ? null
            : $"%{search.Trim()}%";

    private static string GetOrderBy(
        LeaveTypeSortField sortBy,
        LeaveTypeSortDirection sortDirection,
        LeaveTypeLocale locale)
    {
        var direction = sortDirection == LeaveTypeSortDirection.Descending
            ? "DESC"
            : "ASC";

        return sortBy switch
        {
            LeaveTypeSortField.Code =>
                $" ORDER BY lower(leave_types.code) {direction}, leave_types.public_id",
            LeaveTypeSortField.Name when locale == LeaveTypeLocale.English =>
                $" ORDER BY lower(leave_types.name_en) {direction}, lower(leave_types.code), leave_types.public_id",
            LeaveTypeSortField.Name =>
                $" ORDER BY lower(leave_types.name_sr) {direction}, lower(leave_types.code), leave_types.public_id",
            LeaveTypeSortField.Status =>
                $" ORDER BY leave_types.is_active {direction}, leave_types.display_order, leave_types.public_id",
            _ =>
                $" ORDER BY leave_types.display_order {direction}, lower(leave_types.code), leave_types.public_id"
        };
    }

    private static LeaveTypeRecord ToRecord(LeaveTypeRow row) =>
        new(
            row.PublicId,
            row.Code,
            row.NameSr,
            row.NameEn,
            row.DescriptionSr,
            row.DescriptionEn,
            row.CalendarColor,
            row.CountsAgainstVacationBalance,
            row.RequiresBalance,
            row.RequiresApproval,
            row.IsActive,
            row.IsSystem,
            row.DisplayOrder,
            row.IsInUse);

    private sealed class LeaveTypeRow
    {
        public Guid PublicId { get; set; }

        public string Code { get; set; } = string.Empty;

        public string NameSr { get; set; } = string.Empty;

        public string NameEn { get; set; } = string.Empty;

        public string? DescriptionSr { get; set; }

        public string? DescriptionEn { get; set; }

        public string? CalendarColor { get; set; }

        public bool CountsAgainstVacationBalance { get; set; }

        public bool RequiresBalance { get; set; }

        public bool RequiresApproval { get; set; }

        public bool IsActive { get; set; }

        public bool IsSystem { get; set; }

        public int DisplayOrder { get; set; }

        public bool IsInUse { get; set; }
    }

    private sealed class LeaveTypeDependencyHeaderRow
    {
        public Guid PublicId { get; set; }

        public bool IsSystem { get; set; }

        public bool HasPermanentProtection { get; set; }

        public int RequestCount { get; set; }

        public int BalanceEmployeeCount { get; set; }

        public int LedgerEntryCount { get; set; }
    }

    private sealed class LeaveTypeRequestStatusCountRow
    {
        public string Status { get; set; } = string.Empty;

        public int Count { get; set; }
    }
}
