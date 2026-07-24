namespace InternalApps.Api.Authentication;

internal static class CurrentEmployeeEndpoints
{
    public static IEndpointRouteBuilder MapCurrentEmployeeEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/v1/me/employee", GetAsync)
            .RequireAuthorization()
            .WithTags("Current user");
        return endpoints;
    }

    private static async Task<IResult> GetAsync(
        HttpContext context, CurrentEmployeeResolver resolver,
        CancellationToken cancellationToken)
    {
        var result = await resolver.ResolveAsync(context, cancellationToken);
        return result.Status switch
        {
            CurrentEmployeeResolutionStatus.Success => Results.Ok(result.Employee),
            CurrentEmployeeResolutionStatus.Unauthenticated => Results.Unauthorized(),
            _ => Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Employee link not found",
                detail: "The current user is not linked to an employee.",
                instance: context.Request.Path,
                extensions: new Dictionary<string, object?>
                {
                    ["code"] = "current_user_employee_not_linked",
                    ["traceId"] = context.TraceIdentifier
                })
        };
    }
}
