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
