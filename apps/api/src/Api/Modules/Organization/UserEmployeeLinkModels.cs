namespace InternalApps.Api.Modules.Organization;

internal sealed record UserEmployeeLinkResponse(
    Guid PublicId,
    Guid UserPublicId,
    string Username,
    string UserDisplayName,
    bool UserIsActive,
    EmployeeResponse Employee);

internal sealed record UserLinkOption(
    Guid PublicId,
    string Username,
    string DisplayName,
    bool IsActive);

internal sealed record EmployeeLinkOption(
    Guid PublicId,
    string EmployeeNumber,
    string FirstName,
    string LastName,
    string DepartmentName,
    bool IsActive);

internal sealed record UserEmployeeLinkOptionsResponse(
    IReadOnlyList<UserLinkOption> Users,
    IReadOnlyList<EmployeeLinkOption> Employees);

internal sealed record CreateUserEmployeeLinkRequest(
    Guid? UserPublicId,
    Guid? EmployeePublicId);

internal sealed record UpdateUserEmployeeLinkRequest(
    Guid? UserPublicId,
    Guid? EmployeePublicId);

internal enum UserEmployeeLinkWriteStatus
{
    Success,
    ValidationFailed,
    NotFound,
    UnknownUser,
    InactiveUser,
    UnknownEmployee,
    InactiveEmployee,
    UserAlreadyLinked,
    EmployeeAlreadyLinked
}

internal sealed record UserEmployeeLinkWriteResult(
    UserEmployeeLinkWriteStatus Status,
    UserEmployeeLinkResponse? Link = null,
    Dictionary<string, string[]>? Errors = null);
