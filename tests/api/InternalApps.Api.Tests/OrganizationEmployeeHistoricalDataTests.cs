using Xunit;

namespace InternalApps.Api.Tests;

public sealed class OrganizationEmployeeHistoricalDataTests
{
    [Fact]
    public void Migration_AddsNullableHistoricalFieldsAndPreservesEmailUniqueness()
    {
        var sql = ReadRepositoryFile("database", "migrations",
            "022_organization_employee_historical_employment.sql");
        var originalEmployeeSchema = ReadRepositoryFile("database", "migrations",
            "004_vacation_employees.sql");

        Assert.Contains("ADD COLUMN middle_name varchar(100) NULL", sql);
        Assert.Contains("ADD COLUMN employment_start_date date NULL", sql);
        Assert.Contains("ADD COLUMN employment_end_date date NULL", sql);
        Assert.Contains("ALTER COLUMN email DROP NOT NULL", sql);
        Assert.Contains("employment_end_date >= employment_start_date", sql);
        Assert.Contains("CREATE UNIQUE INDEX uq_vacation_employees_email_ci", originalEmployeeSchema);
        Assert.Contains("ON vacation.employees (lower(email))", originalEmployeeSchema);
        Assert.DoesNotContain("employment_status", sql, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void EmployeeContractsMapHistoricalFieldsAndKeepStatusExplicit()
    {
        var models = ReadRepositoryFile("apps", "api", "src", "Api", "Modules",
            "Organization", "OrganizationModels.cs");
        var service = ReadRepositoryFile("apps", "api", "src", "Api", "Modules",
            "Organization", "EmployeesService.cs");
        var repository = ReadRepositoryFile("apps", "api", "src", "Api", "Modules",
            "Organization", "OrganizationRepository.cs");

        Assert.Contains("string? MiddleName", models);
        Assert.Contains("DateOnly? EmploymentStartDate", models);
        Assert.Contains("DateOnly? EmploymentEndDate", models);
        Assert.Contains("string? Email", models);
        Assert.Contains("ValidateEmploymentDates", service);
        Assert.Contains("employment_start_date AS EmploymentStartDate", repository);
        Assert.Contains("employment_end_date AS EmploymentEndDate", repository);
        Assert.Contains("middle_name = @MiddleName", repository);
        Assert.Contains("employment_status = CASE WHEN @IsActive", repository);
        var statusUpdate = repository.Split("public async Task<EmployeeResponse> SetEmployeeActiveAsync")[1]
            .Split("private const")[0];
        Assert.DoesNotContain("employment_end_date", statusUpdate);
    }

    [Fact]
    public void PortalSendsNullableHistoricalValuesAndDisplaysThem()
    {
        var types = ReadRepositoryFile("apps", "portal", "src", "types",
            "organization.ts");
        var form = ReadRepositoryFile("apps", "portal", "src", "features",
            "vacation", "components", "employee-form.tsx");
        var page = ReadRepositoryFile("apps", "portal", "src", "app",
            "organization", "employees", "page.tsx");

        Assert.Contains("middleName: string | null", types);
        Assert.Contains("employmentStartDate: string | null", types);
        Assert.Contains("employmentEndDate: string | null", types);
        Assert.Contains("email: string | null", types);
        Assert.Contains("middleName: middleName.trim() || null", form);
        Assert.Contains("employmentStartDate: employmentStartDate || null", form);
        Assert.Contains("employmentEndDate: employmentEndDate || null", form);
        Assert.Contains("employmentStartDate", page);
        Assert.Contains("employmentEndDate", page);
    }

    [Fact]
    public void EmployeeListDefaultOrder_GroupsActiveEmployeesAndOrdersCodesNaturally()
    {
        var repository = ReadRepositoryFile("apps", "api", "src", "Api", "Modules",
            "Organization", "OrganizationRepository.cs");
        Assert.Contains("CASE WHEN employees.employment_status = 'Active' THEN 0 ELSE 1 END", repository);
        Assert.Contains("lower(regexp_replace(employees.employee_number, '\\d', '', 'g'))", repository);
        Assert.Contains("length(regexp_replace(employees.employee_number, '\\D', '', 'g'))", repository);
        Assert.Contains("employees.public_id", repository);
    }

    private static string ReadRepositoryFile(params string[] parts)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null &&
               !File.Exists(Path.Combine(directory.FullName, "internal.ps1")))
            directory = directory.Parent;
        Assert.NotNull(directory);
        return File.ReadAllText(Path.Combine([directory!.FullName, .. parts]));
    }
}
