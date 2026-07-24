using System.IdentityModel.Tokens.Jwt;

namespace InternalApps.Api.Modules.Identity;

internal static class IdentityEndpoints
{
    public static IEndpointRouteBuilder MapIdentityEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var users = endpoints.MapGroup("/api/v1/identity/users")
            .RequireAuthorization(IdentityPermissions.ManageUsers)
            .WithTags("Identity");
        users.MapGet("", ListAsync);
        users.MapPost("", CreateAsync);
        users.MapPost("/{publicId:guid}/activate",
            (Guid publicId, HttpContext context, UsersService service, CancellationToken token) =>
                SetActiveAsync(publicId, true, context, service, token));
        users.MapPost("/{publicId:guid}/deactivate",
            (Guid publicId, HttpContext context, UsersService service, CancellationToken token) =>
                SetActiveAsync(publicId, false, context, service, token));
        return endpoints;
    }

    private static async Task<IResult> ListAsync(
        UsersService service, CancellationToken token) =>
        Results.Ok(await service.ListAsync(token));

    private static async Task<IResult> CreateAsync(
        CreateUserRequest request, HttpContext context, UsersService service,
        CancellationToken token)
    {
        if (!Actor(context, out var actor)) return Results.Unauthorized();
        var result = await service.CreateAsync(request, actor, context.TraceIdentifier, token);
        return result.Status == UserWriteStatus.Success
            ? Results.Created($"/api/v1/identity/users/{result.User!.PublicId}", result.User)
            : Problem(context, result);
    }

    private static async Task<IResult> SetActiveAsync(
        Guid publicId, bool active, HttpContext context, UsersService service,
        CancellationToken token)
    {
        if (!Actor(context, out var actor)) return Results.Unauthorized();
        var result = await service.SetActiveAsync(
            publicId, active, actor, context.TraceIdentifier, token);
        return result.Status == UserWriteStatus.Success
            ? Results.Ok(result.User)
            : Problem(context, result);
    }

    private static IResult Problem(HttpContext context, UserWriteResult result) =>
        result.Status switch
        {
            UserWriteStatus.ValidationFailed => Results.ValidationProblem(
                result.Errors!, title: "Validation failed",
                detail: "One or more fields are invalid.", instance: context.Request.Path,
                extensions: Ext(context, "validation_failed")),
            UserWriteStatus.NotFound => Results.Problem(statusCode: 404, title: "User not found",
                detail: "The requested user does not exist.", instance: context.Request.Path,
                extensions: Ext(context, "identity_user_not_found")),
            UserWriteStatus.DuplicateUsername => Results.Problem(statusCode: 409,
                title: "Username already exists",
                detail: "A user with the requested username already exists.",
                instance: context.Request.Path,
                extensions: Ext(context, "identity_username_conflict")),
            UserWriteStatus.SelfDeactivationForbidden => Results.Problem(statusCode: 403,
                title: "Self-deactivation is forbidden",
                detail: "You cannot deactivate your own authenticated account.",
                instance: context.Request.Path,
                extensions: Ext(context, "identity_user_self_deactivation_forbidden")),
            _ => Results.Problem(statusCode: 500, title: "User operation failed",
                detail: "The user operation could not be completed.",
                instance: context.Request.Path,
                extensions: Ext(context, "identity_user_operation_failed"))
        };

    private static Dictionary<string, object?> Ext(HttpContext context, string code) =>
        new() { ["code"] = code, ["traceId"] = context.TraceIdentifier };

    private static bool Actor(HttpContext context, out Guid actor) =>
        Guid.TryParse(context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out actor);
}
