using Dapper;
using Npgsql;

namespace InternalApps.Api.Modules.Organization;

internal sealed class OrganizationRepository(NpgsqlDataSource dataSource)
{
    public async Task<IReadOnlyList<DepartmentResponse>> ListDepartmentsAsync(
        string? search,
        bool? isActiveFilter,
        string? sort,
        CancellationToken cancellationToken)
    {
        const string query = """
            SELECT
                departments.public_id AS PublicId,
                departments.code AS Code,
                departments.name AS Name,
                departments.is_active AS IsActive
            FROM organization.departments AS departments
            WHERE (
                    @SearchPattern IS NULL
                    OR departments.code ILIKE @SearchPattern
                    OR departments.name ILIKE @SearchPattern
                  )
              AND (@IsActiveFilter IS NULL OR departments.is_active = @IsActiveFilter)
            """;

        var sql = query + GetDepartmentOrderBy(sort);
        var searchPattern = ToSearchPattern(search);

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync<DepartmentRow>(
            new CommandDefinition(
                sql,
                new { SearchPattern = searchPattern, IsActiveFilter = isActiveFilter },
                cancellationToken: cancellationToken));

        return rows
            .Select(row => new DepartmentResponse(row.PublicId, row.Code, row.Name, row.IsActive))
            .ToArray();
    }

    public async Task<DepartmentResponse?> GetDepartmentForUpdateAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid publicId,
        CancellationToken cancellationToken) =>
        await connection.QuerySingleOrDefaultAsync<DepartmentResponse>(
            new CommandDefinition(
                DepartmentSelect + " WHERE departments.public_id = @PublicId FOR UPDATE OF departments",
                new { PublicId = publicId },
                transaction,
                cancellationToken: cancellationToken));

    public async Task<DepartmentResponse> CreateDepartmentAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        CreateDepartmentCommand command,
        CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO organization.departments (public_id, code, name, is_active)
            VALUES (gen_random_uuid(), @Code, @Name, @IsActive)
            RETURNING public_id
            """;
        var publicId = await connection.ExecuteScalarAsync<Guid>(
            new CommandDefinition(sql, command, transaction, cancellationToken: cancellationToken));
        return (await GetDepartmentForUpdateAsync(
            connection, transaction, publicId, cancellationToken))!;
    }

    public async Task<DepartmentResponse> UpdateDepartmentAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid publicId,
        DepartmentCommand command,
        CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE organization.departments
            SET name = @Name,
                updated_at = now()
            WHERE public_id = @PublicId
            """;
        await connection.ExecuteAsync(new CommandDefinition(
            sql, new { PublicId = publicId, command.Name },
            transaction, cancellationToken: cancellationToken));
        return (await GetDepartmentForUpdateAsync(
            connection, transaction, publicId, cancellationToken))!;
    }

    public async Task<DepartmentResponse> SetDepartmentActiveAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid publicId,
        bool isActive,
        CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE organization.departments
            SET is_active = @IsActive,
                updated_at = now()
            WHERE public_id = @PublicId
            """;
        await connection.ExecuteAsync(new CommandDefinition(
            sql, new { PublicId = publicId, IsActive = isActive },
            transaction, cancellationToken: cancellationToken));
        return (await GetDepartmentForUpdateAsync(
            connection, transaction, publicId, cancellationToken))!;
    }

    public Task<bool> DeleteUnreferencedDepartmentAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid publicId,
        CancellationToken cancellationToken) =>
        connection.ExecuteScalarAsync<bool>(new CommandDefinition(
            """
            SELECT organization.delete_unreferenced_department(@PublicId)
            """,
            new { PublicId = publicId },
            transaction,
            cancellationToken: cancellationToken));

    public async Task<IReadOnlyList<EmployeeResponse>> ListEmployeesAsync(
        string? search,
        string? employeeNumber,
        string? name,
        Guid? departmentPublicId,
        string? email,
        string? status,
        string? sort,
        CancellationToken cancellationToken)
    {
        const string query = """
            SELECT
                employees.public_id AS PublicId,
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
            FROM organization.employees AS employees
            INNER JOIN organization.departments AS departments
                ON departments.id = employees.department_id
            WHERE (
                    @SearchPattern IS NULL
                    OR employees.employee_number ILIKE @SearchPattern
                    OR employees.first_name ILIKE @SearchPattern
                    OR employees.last_name ILIKE @SearchPattern
                    OR concat_ws(' ', employees.first_name, employees.last_name)
                        ILIKE @SearchPattern
                    OR employees.email ILIKE @SearchPattern
                    OR departments.name ILIKE @SearchPattern
                  )
              AND (
                    @EmployeeNumberPattern IS NULL
                    OR employees.employee_number ILIKE @EmployeeNumberPattern
                  )
              AND (
                    @NamePattern IS NULL
                    OR concat_ws(' ', employees.first_name, employees.last_name)
                        ILIKE @NamePattern
                  )
              AND (
                    @DepartmentPublicId IS NULL
                    OR departments.public_id = @DepartmentPublicId
                  )
              AND (@EmailPattern IS NULL OR employees.email ILIKE @EmailPattern)
              AND (@Status IS NULL OR employees.employment_status = @Status)
            """;

        var sql = query + GetEmployeeOrderBy(sort);
        var searchPattern = ToSearchPattern(search);

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync<EmployeeRow>(
            new CommandDefinition(
                sql,
                new
                {
                    SearchPattern = searchPattern,
                    EmployeeNumberPattern = ToSearchPattern(employeeNumber),
                    NamePattern = ToSearchPattern(name),
                    DepartmentPublicId = departmentPublicId,
                    EmailPattern = ToSearchPattern(email),
                    Status = status
                },
                cancellationToken: cancellationToken));

        return rows
            .Select(row => new EmployeeResponse(
                row.PublicId,
                row.EmployeeNumber,
                row.FirstName,
                row.MiddleName,
                row.LastName,
                row.Email,
                row.EmploymentStartDate,
                row.EmploymentEndDate,
                row.DepartmentPublicId,
                row.DepartmentCode,
                row.DepartmentName,
                row.EmploymentStatus))
            .ToArray();
    }

    public async Task<bool> DepartmentExistsAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid publicId,
        CancellationToken cancellationToken) =>
        await connection.ExecuteScalarAsync<bool>(
            new CommandDefinition(
                """
                SELECT EXISTS (
                    SELECT 1 FROM organization.departments
                    WHERE public_id = @PublicId AND is_active = true
                )
                """,
                new { PublicId = publicId },
                transaction,
                cancellationToken: cancellationToken));

    public async Task<EmployeeResponse?> GetEmployeeForUpdateAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid publicId,
        CancellationToken cancellationToken) =>
        await connection.QuerySingleOrDefaultAsync<EmployeeResponse>(
            new CommandDefinition(
                EmployeeSelect + " WHERE employees.public_id = @PublicId FOR UPDATE OF employees",
                new { PublicId = publicId },
                transaction,
                cancellationToken: cancellationToken));

    public async Task<EmployeeResponse> CreateEmployeeAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        CreateEmployeeCommand command,
        CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO organization.employees (
                public_id, employee_number, first_name, middle_name, last_name, email,
                employment_start_date, employment_end_date, department_id, employment_status
            )
            SELECT gen_random_uuid(), @EmployeeNumber, @FirstName, @MiddleName, @LastName, @Email,
                   @EmploymentStartDate, @EmploymentEndDate, departments.id,
                   CASE WHEN @IsActive THEN 'Active' ELSE 'Inactive' END
            FROM organization.departments
            WHERE departments.public_id = @DepartmentPublicId
            RETURNING public_id
            """;
        var publicId = await connection.ExecuteScalarAsync<Guid>(
            new CommandDefinition(sql, command, transaction, cancellationToken: cancellationToken));
        return (await GetEmployeeForUpdateAsync(
            connection, transaction, publicId, cancellationToken))!;
    }

    public async Task<EmployeeResponse> UpdateEmployeeAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid publicId,
        EmployeeCommand command,
        CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE organization.employees
            SET first_name = @FirstName,
                middle_name = @MiddleName,
                last_name = @LastName,
                email = @Email,
                employment_start_date = @EmploymentStartDate,
                employment_end_date = @EmploymentEndDate,
                department_id = departments.id,
                updated_at = now()
            FROM organization.departments
            WHERE employees.public_id = @PublicId
              AND departments.public_id = @DepartmentPublicId
            """;
        await connection.ExecuteAsync(new CommandDefinition(
            sql, new { PublicId = publicId, command.FirstName, command.MiddleName,
                command.LastName, command.Email, command.EmploymentStartDate,
                command.EmploymentEndDate, command.DepartmentPublicId },
            transaction, cancellationToken: cancellationToken));
        return (await GetEmployeeForUpdateAsync(
            connection, transaction, publicId, cancellationToken))!;
    }

    public async Task<EmployeeResponse> SetEmployeeActiveAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid publicId,
        bool isActive,
        CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE organization.employees
            SET employment_status = CASE WHEN @IsActive THEN 'Active' ELSE 'Inactive' END,
                updated_at = now()
            WHERE public_id = @PublicId
            """;
        await connection.ExecuteAsync(new CommandDefinition(
            sql, new { PublicId = publicId, IsActive = isActive },
            transaction, cancellationToken: cancellationToken));
        return (await GetEmployeeForUpdateAsync(
            connection, transaction, publicId, cancellationToken))!;
    }

    public Task<bool> DeleteUnreferencedEmployeeAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid publicId,
        CancellationToken cancellationToken) =>
        connection.ExecuteScalarAsync<bool>(new CommandDefinition(
            """
            SELECT organization.delete_unreferenced_employee(@PublicId)
            """,
            new { PublicId = publicId },
            transaction,
            cancellationToken: cancellationToken));

    private const string DepartmentSelect = """
        SELECT
            departments.public_id AS PublicId,
            departments.code AS Code,
            departments.name AS Name,
            departments.is_active AS IsActive
        FROM organization.departments
        """;

    private const string EmployeeSelect = """
        SELECT
            employees.public_id AS PublicId,
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
        FROM organization.employees
        INNER JOIN organization.departments
            ON departments.id = employees.department_id
        """;

    private static string? ToSearchPattern(string? search) =>
        string.IsNullOrWhiteSpace(search)
            ? null
            : $"%{search.Trim()}%";

    private static string GetDepartmentOrderBy(string? sort) =>
        sort switch
        {
            "code" => " ORDER BY departments.code, departments.name",
            "-code" => " ORDER BY departments.code DESC, departments.name",
            "-name" => " ORDER BY departments.name DESC, departments.code",
            "status" => " ORDER BY departments.is_active, departments.name, departments.code",
            "-status" => " ORDER BY departments.is_active DESC, departments.name, departments.code",
            _ => " ORDER BY departments.name, departments.code"
        };

    private static string GetEmployeeOrderBy(string? sort) =>
        sort switch
        {
            "employeeNumber" =>
                " ORDER BY employees.employee_number, employees.last_name, employees.first_name",
            "-employeeNumber" =>
                " ORDER BY employees.employee_number DESC, employees.last_name, employees.first_name",
            "-name" =>
                " ORDER BY employees.last_name DESC, employees.first_name DESC, employees.employee_number",
            "department" =>
                " ORDER BY departments.name, employees.last_name, employees.first_name, employees.employee_number",
            "-department" =>
                " ORDER BY departments.name DESC, employees.last_name, employees.first_name, employees.employee_number",
            "email" =>
                " ORDER BY employees.email, employees.last_name, employees.first_name",
            "-email" =>
                " ORDER BY employees.email DESC, employees.last_name, employees.first_name",
            "status" =>
                " ORDER BY employees.employment_status, employees.last_name, employees.first_name, employees.employee_number",
            "-status" =>
                " ORDER BY employees.employment_status DESC, employees.last_name, employees.first_name, employees.employee_number",
            _ =>
                """
                 ORDER BY
                    CASE WHEN employees.employment_status = 'Active' THEN 0 ELSE 1 END,
                    lower(regexp_replace(employees.employee_number, '\d', '', 'g')),
                    length(regexp_replace(employees.employee_number, '\D', '', 'g')),
                    regexp_replace(employees.employee_number, '\D', '', 'g'),
                    employees.employee_number,
                    employees.public_id
                """
        };

    private sealed class DepartmentRow
    {
        public Guid PublicId { get; set; }

        public string Code { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;

        public bool IsActive { get; set; }
    }

    private sealed class EmployeeRow
    {
        public Guid PublicId { get; set; }

        public string EmployeeNumber { get; set; } = string.Empty;

        public string FirstName { get; set; } = string.Empty;

        public string? MiddleName { get; set; }

        public string LastName { get; set; } = string.Empty;

        public string? Email { get; set; }

        public DateOnly? EmploymentStartDate { get; set; }

        public DateOnly? EmploymentEndDate { get; set; }

        public Guid DepartmentPublicId { get; set; }

        public string DepartmentCode { get; set; } = string.Empty;

        public string DepartmentName { get; set; } = string.Empty;

        public string EmploymentStatus { get; set; } = string.Empty;
    }
}
