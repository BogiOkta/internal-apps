using System.IdentityModel.Tokens.Jwt;

namespace InternalApps.Api.Authentication;

internal static class AuthEndpoints
{
    private const string RefreshCookieName = "internal_apps_refresh";

    public static IEndpointRouteBuilder MapAuthenticationEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        var auth = endpoints.MapGroup("/api/v1/auth").WithTags("Authentication");

        auth.MapPost("/login", LoginAsync).AllowAnonymous();
        auth.MapPost("/refresh", RefreshAsync).AllowAnonymous();
        auth.MapPost("/logout", LogoutAsync).AllowAnonymous();
        auth.MapGet("/me", MeAsync).RequireAuthorization();

        return endpoints;
    }

    private static async Task<IResult> LoginAsync(
        LoginRequest request,
        HttpContext context,
        AuthRepository repository,
        TokenService tokenService,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Username) ||
            string.IsNullOrWhiteSpace(request.Password))
        {
            var errors = new Dictionary<string, string[]>();
            if (string.IsNullOrWhiteSpace(request.Username))
            {
                errors["username"] = ["Username is required."];
            }

            if (string.IsNullOrWhiteSpace(request.Password))
            {
                errors["password"] = ["Password is required."];
            }

            return Results.ValidationProblem(
                errors,
                detail: "One or more fields are invalid.",
                instance: context.Request.Path,
                title: "Validation failed",
                extensions: new Dictionary<string, object?>
                {
                    ["code"] = "validation_failed",
                    ["traceId"] = context.TraceIdentifier
                });
        }

        var user = await repository.FindByUsernameAsync(
            request.Username.Trim(),
            cancellationToken);

        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            loggerFactory.CreateLogger("Security").LogWarning(
                "Authentication failed for username {Username}.",
                request.Username.Trim());
            return AuthenticationFailed(context);
        }

        var now = DateTimeOffset.UtcNow;
        var tokens = tokenService.Issue(user, now);
        await repository.InsertRefreshTokenAsync(
            user.Id,
            TokenService.HashRefreshToken(tokens.RefreshToken),
            tokens.RefreshTokenExpiresAt,
            cancellationToken);

        SetRefreshCookie(context, tokens);
        loggerFactory.CreateLogger("Security").LogInformation(
            "User {UserPublicId} logged in.",
            user.PublicId);

        return Results.Ok(ToResponse(user, tokens));
    }

    private static async Task<IResult> RefreshAsync(
        HttpContext context,
        AuthRepository repository,
        TokenService tokenService,
        CancellationToken cancellationToken)
    {
        if (!context.Request.Cookies.TryGetValue(
                RefreshCookieName,
                out var refreshToken) ||
            string.IsNullOrWhiteSpace(refreshToken))
        {
            return AuthenticationFailed(context);
        }

        var user = await repository.FindByRefreshTokenAsync(
            TokenService.HashRefreshToken(refreshToken),
            DateTimeOffset.UtcNow,
            cancellationToken);

        if (user is null)
        {
            DeleteRefreshCookie(context);
            return AuthenticationFailed(context);
        }

        var tokens = tokenService.Issue(user, DateTimeOffset.UtcNow);
        var rotated = await repository.RotateRefreshTokenAsync(
            TokenService.HashRefreshToken(refreshToken),
            TokenService.HashRefreshToken(tokens.RefreshToken),
            tokens.RefreshTokenExpiresAt,
            DateTimeOffset.UtcNow,
            cancellationToken);

        if (!rotated)
        {
            DeleteRefreshCookie(context);
            return AuthenticationFailed(context);
        }

        SetRefreshCookie(context, tokens);
        return Results.Ok(ToResponse(user, tokens));
    }

    private static async Task<IResult> LogoutAsync(
        HttpContext context,
        AuthRepository repository,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        if (context.Request.Cookies.TryGetValue(
                RefreshCookieName,
                out var refreshToken) &&
            !string.IsNullOrWhiteSpace(refreshToken))
        {
            await repository.RevokeRefreshTokenAsync(
                TokenService.HashRefreshToken(refreshToken),
                DateTimeOffset.UtcNow,
                cancellationToken);
        }

        DeleteRefreshCookie(context);
        loggerFactory.CreateLogger("Security").LogInformation("User session logged out.");
        return Results.NoContent();
    }

    private static async Task<IResult> MeAsync(
        HttpContext context,
        AuthRepository repository,
        CancellationToken cancellationToken)
    {
        var subject = context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        if (!Guid.TryParse(subject, out var publicId))
        {
            return Results.Unauthorized();
        }

        var user = await repository.FindByPublicIdAsync(publicId, cancellationToken);
        return user is null
            ? Results.Unauthorized()
            : Results.Ok(ToCurrentUser(user));
    }

    private static AuthResponse ToResponse(AuthUser user, IssuedTokens tokens) =>
        new(tokens.AccessToken, tokens.AccessTokenExpiresAt, ToCurrentUser(user));

    private static CurrentUserResponse ToCurrentUser(AuthUser user) =>
        new(user.PublicId, user.Username, user.DisplayName, user.Roles, user.Permissions);

    private static IResult AuthenticationFailed(HttpContext context) =>
        Results.Problem(
            statusCode: StatusCodes.Status401Unauthorized,
            title: "Authentication failed",
            detail: "Invalid or expired credentials.",
            extensions: new Dictionary<string, object?>
            {
                ["code"] = "authentication_failed",
                ["traceId"] = context.TraceIdentifier
            });

    private static void SetRefreshCookie(HttpContext context, IssuedTokens tokens)
    {
        context.Response.Cookies.Append(
            RefreshCookieName,
            tokens.RefreshToken,
            new CookieOptions
            {
                HttpOnly = true,
                Secure = context.Request.IsHttps,
                SameSite = SameSiteMode.Lax,
                Path = "/api/v1/auth",
                Expires = tokens.RefreshTokenExpiresAt
            });
    }

    private static void DeleteRefreshCookie(HttpContext context)
    {
        context.Response.Cookies.Delete(
            RefreshCookieName,
            new CookieOptions
            {
                HttpOnly = true,
                Secure = context.Request.IsHttps,
                SameSite = SameSiteMode.Lax,
                Path = "/api/v1/auth"
            });
    }
}
