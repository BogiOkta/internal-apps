namespace InternalApps.Api.Modules.Organization;

internal sealed record DepartmentResponse(
    Guid PublicId,
    string Code,
    string Name);

internal sealed record EmployeeResponse(
    Guid PublicId,
    string EmployeeNumber,
    string FirstName,
    string LastName,
    string Email,
    Guid DepartmentPublicId,
    string DepartmentCode,
    string DepartmentName,
    string EmploymentStatus);

internal sealed record CreateEmployeeRequest(
    string? EmployeeNumber,
    string? FirstName,
    string? LastName,
    string? Email,
    Guid? DepartmentPublicId,
    bool? IsActive);

internal sealed record UpdateEmployeeRequest(
    string? FirstName,
    string? LastName,
    string? Email,
    Guid? DepartmentPublicId);

internal sealed record EmployeeCommand(
    string FirstName,
    string LastName,
    string Email,
    Guid DepartmentPublicId);

internal sealed record CreateEmployeeCommand(
    string EmployeeNumber,
    string FirstName,
    string LastName,
    string Email,
    Guid DepartmentPublicId,
    bool IsActive);

internal enum EmployeeWriteStatus
{
    Success,
    ValidationFailed,
    NotFound,
    InvalidDepartment,
    DuplicateEmployeeNumber,
    DuplicateEmail
}

internal sealed record EmployeeWriteResult(
    EmployeeWriteStatus Status,
    EmployeeResponse? Employee = null,
    Dictionary<string, string[]>? Errors = null);
