namespace InternalApps.Api.Modules.Identity;

internal sealed record UserResponse(
    Guid PublicId,
    string Username,
    string DisplayName,
    bool IsActive,
    string[] Roles,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

internal sealed record CreateUserRequest(
    string? Username,
    string? DisplayName,
    string? InitialPassword,
    bool? IsActive);

internal sealed record CreateUserCommand(
    string Username,
    string DisplayName,
    string PasswordHash,
    bool IsActive);

internal enum UserWriteStatus
{
    Success,
    ValidationFailed,
    NotFound,
    DuplicateUsername,
    SelfDeactivationForbidden,
    ActorMissing
}

internal sealed record UserWriteResult(
    UserWriteStatus Status,
    UserResponse? User = null,
    Dictionary<string, string[]>? Errors = null);
