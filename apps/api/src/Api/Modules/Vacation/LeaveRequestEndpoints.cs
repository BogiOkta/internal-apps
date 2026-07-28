namespace InternalApps.Api.Modules.Vacation;

internal static class LeaveRequestEndpoints
{
    public static IEndpointRouteBuilder MapLeaveRequestEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/vacation")
            .RequireAuthorization()
            .WithTags("Vacation");

        group.MapGet("/me/leave-types", ListLeaveTypesAsync);
        group.MapGet("/me/requests", ListOwnAsync);
        group.MapGet("/me/requests/{requestId:guid}", GetOwnAsync);
        group.MapGet("/me/requests/{requestId:guid}/history", ListOwnHistoryAsync);
        group.MapPost("/me/requests", CreateAsync);
        group.MapPost("/me/requests/{requestId:guid}/cancel", CancelOwnAsync);
        group.MapGet("/me/balances", ListBalancesAsync);

        var admin = group.MapGroup("")
            .RequireAuthorization(VacationPermissions.ManageRequests);
        admin.MapGet("/requests", ListAdminAsync);
        admin.MapGet("/requests/{requestId:guid}", GetAdminAsync);
        admin.MapGet("/requests/{requestId:guid}/history", ListHistoryAsync);
        admin.MapPost("/requests/{requestId:guid}/approve", ApproveAsync);
        admin.MapPost("/requests/{requestId:guid}/reject", RejectAsync);
        admin.MapPost("/requests/{requestId:guid}/cancel", CancelAdminAsync);
        return endpoints;
    }

    private static async Task<IResult> ListLeaveTypesAsync(
        HttpContext context, LeaveRequestService service,
        CancellationToken cancellationToken)
    {
        var result = await service.ListLeaveTypesAsync(context,
            context.Request.Headers.AcceptLanguage, cancellationToken);
        return result.Status == LeaveRequestOperationStatus.Success
            ? Results.Ok(result.LeaveTypes)
            : Problem(context, result.Status);
    }

    private static async Task<IResult> ListOwnAsync(
        HttpContext context, LeaveRequestService service,
        CancellationToken cancellationToken)
    {
        var result = await service.ListOwnAsync(context,
            context.Request.Headers.AcceptLanguage, cancellationToken);
        return result.Status == LeaveRequestOperationStatus.Success
            ? Results.Ok(result.Requests)
            : Problem(context, result.Status);
    }

    private static async Task<IResult> GetOwnAsync(
        Guid requestId, HttpContext context, LeaveRequestService service,
        CancellationToken cancellationToken) =>
        ToResult(context, await service.GetOwnAsync(context, requestId,
            context.Request.Headers.AcceptLanguage, cancellationToken));

    private static async Task<IResult> ListOwnHistoryAsync(
        Guid requestId, HttpContext context, LeaveRequestService service,
        CancellationToken cancellationToken)
    {
        var result = await service.ListOwnHistoryAsync(
            context, requestId, cancellationToken);
        return result.Status == LeaveRequestOperationStatus.Success
            ? Results.Ok(result.History)
            : Problem(context, result.Status);
    }

    private static async Task<IResult> CreateAsync(
        CreateLeaveRequest request, HttpContext context, LeaveRequestService service,
        CancellationToken cancellationToken)
    {
        var result = await service.CreateAsync(context, request,
            context.Request.Headers.AcceptLanguage, cancellationToken);
        return result.Status == LeaveRequestOperationStatus.Success
            ? Results.Created($"/api/v1/vacation/me/requests/{result.Request!.PublicId}",
                result.Request)
            : ToResult(context, result);
    }

    private static async Task<IResult> CancelOwnAsync(
        Guid requestId, LeaveRequestComment? request, HttpContext context,
        LeaveRequestService service, CancellationToken cancellationToken) =>
        ToResult(context, await service.CancelOwnAsync(context, requestId,
            request ?? new(null), context.Request.Headers.AcceptLanguage,
            cancellationToken));

    private static async Task<IResult> ListBalancesAsync(
        HttpContext context, LeaveRequestService service,
        CancellationToken cancellationToken)
    {
        var result = await service.ListBalancesAsync(context,
            context.Request.Headers.AcceptLanguage, cancellationToken);
        return result.Status == LeaveRequestOperationStatus.Success
            ? Results.Ok(result.Balances)
            : Problem(context, result.Status);
    }

    private static async Task<IResult> ListAdminAsync(
        Guid? employeeId, Guid? departmentId, Guid? leaveTypeId, string? status,
        DateOnly? dateFrom, DateOnly? dateTo, string? search, int? page, int? pageSize,
        HttpContext context, LeaveRequestService service,
        CancellationToken cancellationToken)
    {
        if (!service.TryCreateAdminQuery(employeeId, departmentId, leaveTypeId,
                status, dateFrom, dateTo, search, page, pageSize,
                out var query, out var errors))
            return Results.ValidationProblem(errors, instance: context.Request.Path,
                extensions: Extensions(context, "validation_failed"));
        return Results.Ok(await service.ListAdminAsync(query,
            context.Request.Headers.AcceptLanguage, cancellationToken));
    }

    private static async Task<IResult> GetAdminAsync(
        Guid requestId, HttpContext context, LeaveRequestService service,
        CancellationToken cancellationToken)
    {
        var request = await service.GetAdminAsync(requestId,
            context.Request.Headers.AcceptLanguage, cancellationToken);
        return request is null
            ? Problem(context, LeaveRequestOperationStatus.RequestNotFound)
            : Results.Ok(request);
    }

    private static async Task<IResult> ListHistoryAsync(
        Guid requestId, HttpContext context, LeaveRequestService service,
        CancellationToken cancellationToken)
    {
        var request = await service.GetAdminAsync(requestId,
            context.Request.Headers.AcceptLanguage, cancellationToken);
        return request is null
            ? Problem(context, LeaveRequestOperationStatus.RequestNotFound)
            : Results.Ok(await service.ListHistoryAsync(requestId, cancellationToken));
    }

    private static Task<IResult> ApproveAsync(
        Guid requestId, LeaveRequestComment? request, HttpContext context,
        LeaveRequestService service, CancellationToken cancellationToken) =>
        TransitionResultAsync(context, service.ApproveAsync(context, requestId,
            request ?? new(null), context.Request.Headers.AcceptLanguage,
            cancellationToken));

    private static Task<IResult> RejectAsync(
        Guid requestId, LeaveRequestComment? request, HttpContext context,
        LeaveRequestService service, CancellationToken cancellationToken) =>
        TransitionResultAsync(context, service.RejectAsync(context, requestId,
            request ?? new(null), context.Request.Headers.AcceptLanguage,
            cancellationToken));

    private static Task<IResult> CancelAdminAsync(
        Guid requestId, LeaveRequestComment? request, HttpContext context,
        LeaveRequestService service, CancellationToken cancellationToken) =>
        TransitionResultAsync(context, service.CancelAdminAsync(context, requestId,
            request ?? new(null), context.Request.Headers.AcceptLanguage,
            cancellationToken));

    private static async Task<IResult> TransitionResultAsync(
        HttpContext context, Task<LeaveRequestOperationResult> operation) =>
        ToResult(context, await operation);

    private static IResult ToResult(
        HttpContext context, LeaveRequestOperationResult result) =>
        result.Status switch
        {
            LeaveRequestOperationStatus.Success => Results.Ok(result.Request),
            LeaveRequestOperationStatus.ValidationFailed =>
                Results.ValidationProblem(result.Errors!,
                    instance: context.Request.Path,
                    extensions: Extensions(context, "validation_failed")),
            _ => Problem(context, result.Status)
        };

    private static IResult Problem(
        HttpContext context, LeaveRequestOperationStatus status)
    {
        var (httpStatus, title, code, detail) = status switch
        {
            LeaveRequestOperationStatus.CurrentEmployeeNotLinked =>
                (404, "Employee link not found", "current_user_employee_not_linked",
                    "The current user is not linked to an employee."),
            LeaveRequestOperationStatus.CurrentEmployeeInactive =>
                (403, "Employee is inactive", "vacation_request_forbidden",
                    "An inactive employee cannot perform this operation."),
            LeaveRequestOperationStatus.LeaveTypeNotFound =>
                (404, "Leave type not found", "vacation_leave_type_not_found",
                    "The selected leave type does not exist."),
            LeaveRequestOperationStatus.LeaveTypeInactive =>
                (409, "Leave type is inactive", "vacation_leave_type_inactive",
                    "The selected leave type is inactive."),
            LeaveRequestOperationStatus.RequestNotFound =>
                (404, "Leave request not found", "vacation_request_not_found",
                    "The requested leave request does not exist."),
            LeaveRequestOperationStatus.InvalidDateRange =>
                (400, "Invalid date range", "vacation_request_invalid_date_range",
                    "The end date cannot precede the start date."),
            LeaveRequestOperationStatus.CrossYearNotAllowed =>
                (400, "Cross-year request not allowed",
                    "vacation_request_cross_year_not_allowed",
                    "A leave request cannot span calendar years."),
            LeaveRequestOperationStatus.NoWorkingDays =>
                (400, "No working days", "vacation_request_no_working_days",
                    "The selected range contains no working days."),
            LeaveRequestOperationStatus.Overlap =>
                (409, "Leave request overlaps", "vacation_request_overlap",
                    "The request overlaps an existing submitted or approved request."),
            LeaveRequestOperationStatus.InvalidTransition =>
                (409, "Invalid leave request transition",
                    "vacation_request_invalid_transition",
                    "The requested status transition is not allowed."),
            LeaveRequestOperationStatus.Forbidden =>
                (403, "Leave request forbidden", "vacation_request_forbidden",
                    "The operation is not permitted."),
            LeaveRequestOperationStatus.BalanceNotFound =>
                (409, "Leave balance not found", "vacation_balance_not_found",
                    "No applicable leave balance exists."),
            LeaveRequestOperationStatus.BalanceInsufficient =>
                (409, "Insufficient leave balance", "vacation_balance_insufficient",
                    "The available leave balance is insufficient."),
            LeaveRequestOperationStatus.BalanceInvalid =>
                (409, "Invalid leave balance", "vacation_balance_invalid",
                    "The leave balance cannot be updated safely."),
            _ => (500, "Vacation operation failed", "vacation_operation_failed",
                "The operation could not be completed.")
        };
        return Results.Problem(statusCode: httpStatus, title: title, detail: detail,
            instance: context.Request.Path, extensions: Extensions(context, code));
    }

    private static Dictionary<string, object?> Extensions(
        HttpContext context, string code) =>
        new()
        {
            ["code"] = code,
            ["traceId"] = context.TraceIdentifier
        };
}
