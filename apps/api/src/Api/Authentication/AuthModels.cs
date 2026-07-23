namespace InternalApps.Api.Authentication;

internal sealed record LoginRequest(string Username, string Password);

internal sealed record AuthUser(
    long Id,
    Guid PublicId,
    string Username,
    string DisplayName,
    string PasswordHash,
    string[] Roles,
    string[] Permissions);

internal sealed record CurrentUserResponse(
    Guid PublicId,
    string Username,
    string DisplayName,
    string[] Roles,
    string[] Permissions);

internal sealed record AuthResponse(
    string AccessToken,
    DateTimeOffset ExpiresAt,
    CurrentUserResponse User);

internal sealed record IssuedTokens(
    string AccessToken,
    DateTimeOffset AccessTokenExpiresAt,
    string RefreshToken,
    DateTimeOffset RefreshTokenExpiresAt);
