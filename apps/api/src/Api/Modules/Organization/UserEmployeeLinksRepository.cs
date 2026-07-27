using Dapper;
using Npgsql;

namespace InternalApps.Api.Modules.Organization;

internal sealed class UserEmployeeLinksRepository(NpgsqlDataSource dataSource)
{
    private const string Projection = """
        SELECT
            links.public_id AS PublicId,
            users.public_id AS UserPublicId,
            users.username AS Username,
            users.display_name AS UserDisplayName,
            users.is_active AS UserIsActive,
            employees.public_id AS EmployeePublicId,
            employees.employee_number AS EmployeeNumber,
            employees.first_name AS FirstName,
            employees.middle_name AS MiddleName,
            employees.last_name AS LastName,
            employees.email AS Email,
            employees.employment_start_date AS EmploymentStartDate,
            employees.employment_end_date AS EmploymentEndDate,
            departments.public_id AS DepartmentPublicId,
            departments.code AS DepartmentCode,
            departments.name AS DepartmentName,
            employees.employment_status AS EmploymentStatus
        FROM core.user_employee_links AS links
        INNER JOIN identity.users AS users ON users.id = links.user_id
        INNER JOIN organization.employees AS employees ON employees.id = links.employee_id
        INNER JOIN organization.departments AS departments ON departments.id = employees.department_id
        """;

    public async Task<IReadOnlyList<UserEmployeeLinkResponse>> ListAsync(
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync<LinkRow>(new CommandDefinition(
            Projection + " ORDER BY users.username, links.public_id",
            cancellationToken: cancellationToken));
        return rows.Select(Map).ToArray();
    }

    public async Task<UserEmployeeLinkOptionsResponse> GetOptionsAsync(
        CancellationToken cancellationToken)
    {
        const string usersSql = """
            SELECT public_id AS PublicId, username AS Username,
                   display_name AS DisplayName, is_active AS IsActive
            FROM identity.users
            ORDER BY username, public_id
            """;
        const string employeesSql = """
            SELECT employees.public_id AS PublicId,
                   employees.employee_number AS EmployeeNumber,
                   employees.first_name AS FirstName,
                   employees.last_name AS LastName,
                   departments.name AS DepartmentName,
                   employees.employment_status = 'Active' AS IsActive
            FROM organization.employees
            INNER JOIN organization.departments ON departments.id = employees.department_id
            ORDER BY employees.last_name, employees.first_name, employees.employee_number
            """;
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var users = await connection.QueryAsync<UserLinkOption>(
            new CommandDefinition(usersSql, cancellationToken: cancellationToken));
        var employees = await connection.QueryAsync<EmployeeLinkOption>(
            new CommandDefinition(employeesSql, cancellationToken: cancellationToken));
        return new(users.ToArray(), employees.ToArray());
    }

    public async Task<UserEmployeeLinkResponse?> GetForUpdateAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, Guid publicId,
        CancellationToken cancellationToken)
    {
        var row = await connection.QuerySingleOrDefaultAsync<LinkRow>(
            new CommandDefinition(
                Projection + " WHERE links.public_id = @PublicId FOR UPDATE OF links",
                new { PublicId = publicId }, transaction,
                cancellationToken: cancellationToken));
        return row is null ? null : Map(row);
    }

    public async Task<LinkEntityState?> ResolveUserAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, Guid publicId,
        CancellationToken cancellationToken) =>
        await connection.QuerySingleOrDefaultAsync<LinkEntityState>(
            new CommandDefinition(
                """
                SELECT id AS Id, is_active AS IsActive
                FROM identity.users WHERE public_id = @PublicId
                """,
                new { PublicId = publicId }, transaction,
                cancellationToken: cancellationToken));

    public async Task<LinkEntityState?> ResolveEmployeeAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, Guid publicId,
        CancellationToken cancellationToken) =>
        await connection.QuerySingleOrDefaultAsync<LinkEntityState>(
            new CommandDefinition(
                """
                SELECT id AS Id, employment_status = 'Active' AS IsActive
                FROM organization.employees WHERE public_id = @PublicId
                """,
                new { PublicId = publicId }, transaction,
                cancellationToken: cancellationToken));

    public async Task<long?> ResolveActorIdAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, Guid publicId,
        CancellationToken cancellationToken) =>
        await connection.QuerySingleOrDefaultAsync<long?>(
            new CommandDefinition(
                "SELECT id FROM identity.users WHERE public_id = @PublicId",
                new { PublicId = publicId }, transaction,
                cancellationToken: cancellationToken));

    public async Task<Guid> CreateAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, long userId,
        long employeeId, long actorId, CancellationToken cancellationToken) =>
        await connection.ExecuteScalarAsync<Guid>(new CommandDefinition(
            """
            INSERT INTO core.user_employee_links
                (public_id, user_id, employee_id, created_by, updated_by)
            VALUES (gen_random_uuid(), @UserId, @EmployeeId, @ActorId, @ActorId)
            RETURNING public_id
            """,
            new { UserId = userId, EmployeeId = employeeId, ActorId = actorId },
            transaction, cancellationToken: cancellationToken));

    public async Task UpdateAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, Guid publicId,
        long userId, long employeeId, long actorId, CancellationToken cancellationToken) =>
        await connection.ExecuteAsync(new CommandDefinition(
            """
            UPDATE core.user_employee_links
            SET user_id = @UserId, employee_id = @EmployeeId,
                updated_at = now(), updated_by = @ActorId
            WHERE public_id = @PublicId
            """,
            new { PublicId = publicId, UserId = userId, EmployeeId = employeeId, ActorId = actorId },
            transaction, cancellationToken: cancellationToken));

    public async Task DeleteAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, Guid publicId,
        CancellationToken cancellationToken) =>
        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM core.user_employee_links WHERE public_id = @PublicId",
            new { PublicId = publicId }, transaction,
            cancellationToken: cancellationToken));

    public async Task<EmployeeResponse?> GetEmployeeForUserAsync(
        Guid userPublicId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT employees.public_id AS PublicId,
                   employees.employee_number AS EmployeeNumber,
                   employees.first_name AS FirstName,
                   employees.middle_name AS MiddleName,
                   employees.last_name AS LastName,
                   employees.email AS Email,
                   employees.employment_start_date AS EmploymentStartDate,
                   employees.employment_end_date AS EmploymentEndDate,
                   departments.public_id AS DepartmentPublicId,
                   departments.code AS DepartmentCode,
                   departments.name AS DepartmentName,
                   employees.employment_status AS EmploymentStatus
            FROM core.user_employee_links AS links
            INNER JOIN identity.users AS users ON users.id = links.user_id
            INNER JOIN organization.employees AS employees ON employees.id = links.employee_id
            INNER JOIN organization.departments AS departments ON departments.id = employees.department_id
            WHERE users.public_id = @UserPublicId
            """;
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        return await connection.QuerySingleOrDefaultAsync<EmployeeResponse>(
            new CommandDefinition(sql, new { UserPublicId = userPublicId },
                cancellationToken: cancellationToken));
    }

    private static UserEmployeeLinkResponse Map(LinkRow row) =>
        new(row.PublicId, row.UserPublicId, row.Username, row.UserDisplayName,
            row.UserIsActive, new(row.EmployeePublicId, row.EmployeeNumber,
                row.FirstName, row.MiddleName, row.LastName, row.Email,
                row.EmploymentStartDate, row.EmploymentEndDate, row.DepartmentPublicId,
                row.DepartmentCode, row.DepartmentName, row.EmploymentStatus));

    internal sealed record LinkEntityState(long Id, bool IsActive);

    private sealed class LinkRow
    {
        public Guid PublicId { get; set; }
        public Guid UserPublicId { get; set; }
        public string Username { get; set; } = "";
        public string UserDisplayName { get; set; } = "";
        public bool UserIsActive { get; set; }
        public Guid EmployeePublicId { get; set; }
        public string EmployeeNumber { get; set; } = "";
        public string FirstName { get; set; } = "";
        public string? MiddleName { get; set; }
        public string LastName { get; set; } = "";
        public string? Email { get; set; }
        public DateOnly? EmploymentStartDate { get; set; }
        public DateOnly? EmploymentEndDate { get; set; }
        public Guid DepartmentPublicId { get; set; }
        public string DepartmentCode { get; set; } = "";
        public string DepartmentName { get; set; } = "";
        public string EmploymentStatus { get; set; } = "";
    }
}
