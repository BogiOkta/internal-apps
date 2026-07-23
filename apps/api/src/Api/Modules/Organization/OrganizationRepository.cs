using Dapper;
using Npgsql;

namespace InternalApps.Api.Modules.Organization;

internal sealed class OrganizationRepository(NpgsqlDataSource dataSource)
{
    public async Task<IReadOnlyList<DepartmentResponse>> ListDepartmentsAsync(
        string? search,
        string? sort,
        CancellationToken cancellationToken)
    {
        const string query = """
            SELECT
                departments.public_id AS PublicId,
                departments.code AS Code,
                departments.name AS Name
            FROM organization.departments AS departments
            WHERE departments.is_active = true
              AND (
                  @SearchPattern IS NULL
                  OR departments.code ILIKE @SearchPattern
                  OR departments.name ILIKE @SearchPattern
              )
            """;

        var sql = query + GetDepartmentOrderBy(sort);
        var searchPattern = ToSearchPattern(search);

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync<DepartmentRow>(
            new CommandDefinition(
                sql,
                new { SearchPattern = searchPattern },
                cancellationToken: cancellationToken));

        return rows
            .Select(row => new DepartmentResponse(row.PublicId, row.Code, row.Name))
            .ToArray();
    }

    public async Task<IReadOnlyList<EmployeeResponse>> ListEmployeesAsync(
        string? search,
        Guid? departmentPublicId,
        string? sort,
        CancellationToken cancellationToken)
    {
        const string query = """
            SELECT
                employees.public_id AS PublicId,
                employees.employee_number AS EmployeeNumber,
                employees.first_name AS FirstName,
                employees.last_name AS LastName,
                employees.email AS Email,
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
                    @DepartmentPublicId IS NULL
                    OR departments.public_id = @DepartmentPublicId
                  )
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
                    DepartmentPublicId = departmentPublicId
                },
                cancellationToken: cancellationToken));

        return rows
            .Select(row => new EmployeeResponse(
                row.PublicId,
                row.EmployeeNumber,
                row.FirstName,
                row.LastName,
                row.Email,
                row.DepartmentPublicId,
                row.DepartmentCode,
                row.DepartmentName,
                row.EmploymentStatus))
            .ToArray();
    }

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
                " ORDER BY departments.name, employees.last_name, employees.first_name",
            "-department" =>
                " ORDER BY departments.name DESC, employees.last_name, employees.first_name",
            "email" =>
                " ORDER BY employees.email, employees.last_name, employees.first_name",
            "-email" =>
                " ORDER BY employees.email DESC, employees.last_name, employees.first_name",
            "status" =>
                " ORDER BY employees.employment_status, employees.last_name, employees.first_name",
            "-status" =>
                " ORDER BY employees.employment_status DESC, employees.last_name, employees.first_name",
            _ =>
                " ORDER BY employees.last_name, employees.first_name, employees.employee_number"
        };

    private sealed class DepartmentRow
    {
        public Guid PublicId { get; set; }

        public string Code { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;
    }

    private sealed class EmployeeRow
    {
        public Guid PublicId { get; set; }

        public string EmployeeNumber { get; set; } = string.Empty;

        public string FirstName { get; set; } = string.Empty;

        public string LastName { get; set; } = string.Empty;

        public string Email { get; set; } = string.Empty;

        public Guid DepartmentPublicId { get; set; }

        public string DepartmentCode { get; set; } = string.Empty;

        public string DepartmentName { get; set; } = string.Empty;

        public string EmploymentStatus { get; set; } = string.Empty;
    }
}
