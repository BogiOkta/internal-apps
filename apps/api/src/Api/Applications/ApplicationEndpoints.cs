using System.IdentityModel.Tokens.Jwt;

namespace InternalApps.Api.Applications;

internal static class ApplicationEndpoints
{
    public static IEndpointRouteBuilder MapApplicationEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        endpoints
            .MapGet("/api/v1/me/applications", ListApplicationsAsync)
            .RequireAuthorization()
            .WithTags("Applications");

        return endpoints;
    }

    private static async Task<IResult> ListApplicationsAsync(
        HttpContext context,
        ApplicationRepository repository,
        CancellationToken cancellationToken)
    {
        var subject = context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        if (!Guid.TryParse(subject, out var userPublicId))
        {
            return Results.Unauthorized();
        }

        var applications = await repository.ListForUserAsync(
            userPublicId,
            cancellationToken);

        return Results.Ok(applications);
    }
}
