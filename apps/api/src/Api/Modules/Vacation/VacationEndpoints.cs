using System.IdentityModel.Tokens.Jwt;

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
        vacation
            .MapPost("/leave-types", CreateLeaveTypeAsync)
            .RequireAuthorization(VacationPermissions.ManageLeaveTypes);
        vacation
            .MapPut("/leave-types/{publicId:guid}", UpdateLeaveTypeAsync)
            .RequireAuthorization(VacationPermissions.ManageLeaveTypes);
        vacation
            .MapPost("/leave-types/{publicId:guid}/activate", ActivateLeaveTypeAsync)
            .RequireAuthorization(VacationPermissions.ManageLeaveTypes);
        vacation
            .MapPost("/leave-types/{publicId:guid}/deactivate", DeactivateLeaveTypeAsync)
            .RequireAuthorization(VacationPermissions.ManageLeaveTypes);

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

    private static async Task<IResult> CreateLeaveTypeAsync(
        CreateLeaveTypeRequest request,
        HttpContext context,
        LeaveTypesService service,
        CancellationToken cancellationToken)
    {
        if (!TryGetActorPublicId(context, out var actorPublicId))
        {
            return Results.Unauthorized();
        }

        var result = await service.CreateAsync(
            request,
            actorPublicId,
            context.TraceIdentifier,
            context.Request.Headers["Accept-Language"].ToString(),
            cancellationToken);

        return result.Status switch
        {
            LeaveTypeWriteStatus.Success => Results.Created(
                $"/api/v1/vacation/leave-types/{result.LeaveType!.PublicId}",
                result.LeaveType),
            LeaveTypeWriteStatus.ValidationFailed =>
                ValidationProblem(context, result.Errors!),
            LeaveTypeWriteStatus.DuplicateCode => DuplicateCodeProblem(context),
            _ => Results.Problem(statusCode: StatusCodes.Status500InternalServerError)
        };
    }

    private static async Task<IResult> UpdateLeaveTypeAsync(
        Guid publicId,
        UpdateLeaveTypeRequest request,
        HttpContext context,
        LeaveTypesService service,
        CancellationToken cancellationToken)
    {
        if (!TryGetActorPublicId(context, out var actorPublicId))
        {
            return Results.Unauthorized();
        }

        var result = await service.UpdateAsync(
            publicId,
            request,
            actorPublicId,
            context.TraceIdentifier,
            context.Request.Headers["Accept-Language"].ToString(),
            cancellationToken);

        return WriteResult(context, result);
    }

    private static Task<IResult> ActivateLeaveTypeAsync(
        Guid publicId,
        HttpContext context,
        LeaveTypesService service,
        CancellationToken cancellationToken) =>
        SetActiveAsync(
            publicId,
            true,
            context,
            service,
            cancellationToken);

    private static Task<IResult> DeactivateLeaveTypeAsync(
        Guid publicId,
        HttpContext context,
        LeaveTypesService service,
        CancellationToken cancellationToken) =>
        SetActiveAsync(
            publicId,
            false,
            context,
            service,
            cancellationToken);

    private static async Task<IResult> SetActiveAsync(
        Guid publicId,
        bool isActive,
        HttpContext context,
        LeaveTypesService service,
        CancellationToken cancellationToken)
    {
        if (!TryGetActorPublicId(context, out var actorPublicId))
        {
            return Results.Unauthorized();
        }

        var result = await service.SetActiveAsync(
            publicId,
            isActive,
            actorPublicId,
            context.TraceIdentifier,
            context.Request.Headers["Accept-Language"].ToString(),
            cancellationToken);

        return WriteResult(context, result);
    }

    private static IResult WriteResult(
        HttpContext context,
        LeaveTypeWriteResult result) =>
        result.Status switch
        {
            LeaveTypeWriteStatus.Success => Results.Ok(result.LeaveType),
            LeaveTypeWriteStatus.ValidationFailed =>
                ValidationProblem(context, result.Errors!),
            LeaveTypeWriteStatus.NotFound => NotFoundProblem(context),
            LeaveTypeWriteStatus.DuplicateCode => DuplicateCodeProblem(context),
            _ => Results.Problem(statusCode: StatusCodes.Status500InternalServerError)
        };

    private static IResult ValidationProblem(
        HttpContext context,
        Dictionary<string, string[]> errors) =>
        Results.ValidationProblem(
            errors,
            detail: "One or more fields are invalid.",
            instance: context.Request.Path,
            title: "Validation failed",
            extensions: new Dictionary<string, object?>
            {
                ["code"] = "validation_failed",
                ["traceId"] = context.TraceIdentifier
            });

    private static IResult DuplicateCodeProblem(HttpContext context) =>
        Results.Problem(
            statusCode: StatusCodes.Status409Conflict,
            title: "Leave type code already exists",
            detail: "A leave type with the requested code already exists.",
            instance: context.Request.Path,
            extensions: new Dictionary<string, object?>
            {
                ["code"] = "leave_type_code_conflict",
                ["traceId"] = context.TraceIdentifier
            });

    private static IResult NotFoundProblem(HttpContext context) =>
        Results.Problem(
            statusCode: StatusCodes.Status404NotFound,
            title: "Leave type not found",
            detail: "The requested leave type does not exist.",
            instance: context.Request.Path,
            extensions: new Dictionary<string, object?>
            {
                ["code"] = "leave_type_not_found",
                ["traceId"] = context.TraceIdentifier
            });

    private static bool TryGetActorPublicId(
        HttpContext context,
        out Guid actorPublicId) =>
        Guid.TryParse(
            context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value,
            out actorPublicId);
}
