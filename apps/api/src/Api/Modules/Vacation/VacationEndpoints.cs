namespace InternalApps.Api.Modules.Vacation;

internal static class VacationEndpoints
{
    public static IEndpointRouteBuilder MapVacationEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        var vacation = endpoints
            .MapGroup("/api/v1/vacation")
            .RequireAuthorization()
            .WithTags("Vacation");

        vacation.MapGet("/leave-types", ListLeaveTypesAsync);
        vacation.MapGet("/leave-types/{publicId:guid}", GetLeaveTypeAsync);

        return endpoints;
    }

    private static async Task<IResult> ListLeaveTypesAsync(
        string? search,
        string? status,
        string? sortBy,
        string? sortDirection,
        HttpContext context,
        LeaveTypesService service,
        CancellationToken cancellationToken)
    {
        if (!service.TryCreateListQuery(
                search,
                status,
                sortBy,
                sortDirection,
                out var query,
                out var errors))
        {
            return Results.ValidationProblem(
                errors,
                detail: "One or more query parameters are invalid.",
                instance: context.Request.Path,
                title: "Validation failed",
                extensions: new Dictionary<string, object?>
                {
                    ["code"] = "validation_failed",
                    ["traceId"] = context.TraceIdentifier
                });
        }

        var leaveTypes = await service.ListAsync(
            query,
            context.Request.Headers["Accept-Language"].ToString(),
            cancellationToken);

        return Results.Ok(leaveTypes);
    }

    private static async Task<IResult> GetLeaveTypeAsync(
        Guid publicId,
        HttpContext context,
        LeaveTypesService service,
        CancellationToken cancellationToken)
    {
        var leaveType = await service.GetByPublicIdAsync(
            publicId,
            context.Request.Headers["Accept-Language"].ToString(),
            cancellationToken);

        return leaveType is null
            ? Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Leave type not found",
                detail: "The requested leave type does not exist.",
                instance: context.Request.Path,
                extensions: new Dictionary<string, object?>
                {
                    ["code"] = "leave_type_not_found",
                    ["traceId"] = context.TraceIdentifier
                })
            : Results.Ok(leaveType);
    }
}
