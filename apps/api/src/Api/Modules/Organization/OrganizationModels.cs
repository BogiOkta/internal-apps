namespace InternalApps.Api.Modules.Organization;

internal sealed record DepartmentResponse(
    Guid PublicId,
    string Code,
    string Name,
    bool IsActive);

internal sealed record CreateDepartmentRequest(
    string? Code,
    string? Name,
    bool? IsActive);

internal sealed record UpdateDepartmentRequest(
    string? Name);

internal sealed record DepartmentCommand(
    string Name);

internal sealed record CreateDepartmentCommand(
    string Code,
    string Name,
    bool IsActive);

internal enum DepartmentWriteStatus
{
    Success,
    ValidationFailed,
    NotFound,
    DuplicateCode,
    HasDependencies
}

internal sealed record DepartmentWriteResult(
    DepartmentWriteStatus Status,
    DepartmentResponse? Department = null,
    Dictionary<string, string[]>? Errors = null);

internal sealed record DepartmentDeleteResult(
    DepartmentWriteStatus Status,
    IReadOnlyList<string>? Dependencies = null);

internal sealed record EmployeeResponse(
    Guid PublicId,
    string EmployeeNumber,
    string FirstName,
    string? MiddleName,
    string LastName,
    string? Email,
    DateOnly? EmploymentStartDate,
    DateOnly? EmploymentEndDate,
    Guid DepartmentPublicId,
    string DepartmentCode,
    string DepartmentName,
    string EmploymentStatus);

internal sealed record CreateEmployeeRequest(
    string? EmployeeNumber,
    string? FirstName,
    string? MiddleName,
    string? LastName,
    string? Email,
    DateOnly? EmploymentStartDate,
    DateOnly? EmploymentEndDate,
    Guid? DepartmentPublicId,
    bool? IsActive);

internal sealed record UpdateEmployeeRequest(
    string? FirstName,
    string? MiddleName,
    string? LastName,
    string? Email,
    DateOnly? EmploymentStartDate,
    DateOnly? EmploymentEndDate,
    Guid? DepartmentPublicId);

internal sealed record EmployeeCommand(
    string FirstName,
    string? MiddleName,
    string LastName,
    string? Email,
    DateOnly? EmploymentStartDate,
    DateOnly? EmploymentEndDate,
    Guid DepartmentPublicId);

internal sealed record CreateEmployeeCommand(
    string EmployeeNumber,
    string FirstName,
    string? MiddleName,
    string LastName,
    string? Email,
    DateOnly? EmploymentStartDate,
    DateOnly? EmploymentEndDate,
    Guid DepartmentPublicId,
    bool IsActive);

internal enum EmployeeWriteStatus
{
    Success,
    ValidationFailed,
    NotFound,
    InvalidDepartment,
    DuplicateEmployeeNumber,
    DuplicateEmail,
    HasDependencies
}

internal sealed record EmployeeWriteResult(
    EmployeeWriteStatus Status,
    EmployeeResponse? Employee = null,
    Dictionary<string, string[]>? Errors = null);

internal sealed record EmployeeDeleteResult(
    EmployeeWriteStatus Status,
    IReadOnlyList<string>? Dependencies = null);
