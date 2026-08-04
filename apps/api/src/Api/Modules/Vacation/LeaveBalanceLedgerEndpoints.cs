using System.IdentityModel.Tokens.Jwt;

namespace InternalApps.Api.Modules.Vacation;

internal static class LeaveBalanceLedgerEndpoints
{
    public static IEndpointRouteBuilder MapLeaveBalanceLedgerEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/vacation/leave-balances")
            .RequireAuthorization(VacationPermissions.ManageLeaveBalances)
            .WithTags("Vacation Leave Balance Ledger");
        group.MapGet("", GetBalanceAsync);
        group.MapGet("/history", ListHistoryAsync);
        group.MapPost("/entitlements", PostEntitlementAsync);
        group.MapPost("/carry-overs", PostCarryOverAsync);
        group.MapPost("/manual-adjustments", PostManualAdjustmentAsync);
        return endpoints;
    }

    private static async Task<IResult> GetBalanceAsync(Guid? employeeId, Guid? leaveTypeId, int? year,
        HttpContext context, LeaveBalanceLedgerService service, CancellationToken token)
    {
        if (!TryScope(employeeId, leaveTypeId, year, out var scope, out var errors)) return Validation(context, errors);
        var balance = await service.GetBalanceAsync(scope.EmployeeId, scope.LeaveTypeId, scope.Year, token);
        return balance is null ? NotFound(context, "leave_balance_not_found", "Leave balance not found", "No ledger entries exist for the requested balance scope.") : Results.Ok(balance);
    }

    private static async Task<IResult> ListHistoryAsync(Guid? employeeId, Guid? leaveTypeId, int? year,
        HttpContext context, LeaveBalanceLedgerService service, CancellationToken token)
    {
        if (!TryScope(employeeId, leaveTypeId, year, out var scope, out var errors)) return Validation(context, errors);
        return Results.Ok(await service.ListHistoryAsync(scope.EmployeeId, scope.LeaveTypeId, scope.Year, token));
    }

    private static Task<IResult> PostEntitlementAsync(PostLeaveBalanceEntryRequest request, HttpContext context,
        LeaveBalanceLedgerService service, CancellationToken token) => PostAsync(request, context, service.PostEntitlementAsync, token);
    private static Task<IResult> PostCarryOverAsync(PostLeaveBalanceEntryRequest request, HttpContext context,
        LeaveBalanceLedgerService service, CancellationToken token) => PostAsync(request, context, service.PostCarryOverAsync, token);
    private static Task<IResult> PostManualAdjustmentAsync(PostLeaveBalanceEntryRequest request, HttpContext context,
        LeaveBalanceLedgerService service, CancellationToken token) => PostAsync(request, context, service.PostManualAdjustmentAsync, token);

    private static async Task<IResult> PostAsync(PostLeaveBalanceEntryRequest request, HttpContext context,
        Func<PostLeaveBalanceEntryRequest, Guid, string, CancellationToken, Task<LeaveBalanceLedgerWriteResult>> action, CancellationToken token)
    {
        if (!Guid.TryParse(context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var actor)) return Results.Unauthorized();
        var result = await action(request, actor, context.TraceIdentifier, token);
        return result.Status switch
        {
            LeaveBalanceLedgerWriteStatus.Success => Results.Created($"/api/v1/vacation/leave-balances/history?employeeId={result.Entry!.EmployeeId}&leaveTypeId={result.Entry.LeaveTypeId}&year={result.Entry.LeaveYear}", result.Entry),
            LeaveBalanceLedgerWriteStatus.ValidationFailed => Validation(context, result.Errors!),
            LeaveBalanceLedgerWriteStatus.EmployeeNotFound => NotFound(context, "employee_not_found", "Employee not found", "The requested employee does not exist."),
            LeaveBalanceLedgerWriteStatus.LeaveTypeNotFound => NotFound(context, "leave_type_not_found", "Leave type not found", "The requested leave type does not exist."),
            LeaveBalanceLedgerWriteStatus.LeaveTypeDoesNotRequireBalance => Validation(context, new() { ["leaveTypeId"] = ["The leave type must require a balance."] }),
            LeaveBalanceLedgerWriteStatus.DuplicateSource => Conflict(context, "leave_balance_entry_source_conflict", "Ledger source already posted", "An entry with this kind and source reference already exists."),
            LeaveBalanceLedgerWriteStatus.InsufficientBalance => Conflict(context, "leave_balance_insufficient", "Insufficient leave balance", "The entry would make the leave balance negative."),
            _ => Results.Problem(statusCode: 500)
        };
    }

    private static bool TryScope(Guid? employeeId, Guid? leaveTypeId, int? year, out (Guid EmployeeId, Guid LeaveTypeId, int Year) scope, out Dictionary<string, string[]> errors)
    {
        errors = []; if (employeeId is null || employeeId == Guid.Empty) errors["employeeId"] = ["The field is required."];
        if (leaveTypeId is null || leaveTypeId == Guid.Empty) errors["leaveTypeId"] = ["The field is required."];
        if (year is null) errors["year"] = ["The field is required."]; else if (year is < 1900 or > 9999) errors["year"] = ["Year must be between 1900 and 9999."];
        scope = (employeeId.GetValueOrDefault(), leaveTypeId.GetValueOrDefault(), year.GetValueOrDefault()); return errors.Count == 0;
    }
    private static IResult Validation(HttpContext context, Dictionary<string, string[]> errors) => Results.ValidationProblem(errors, detail: "One or more fields are invalid.", instance: context.Request.Path, title: "Validation failed", extensions: Extensions(context, "validation_failed"));
    private static IResult NotFound(HttpContext context, string code, string title, string detail) => Results.Problem(statusCode: 404, title: title, detail: detail, instance: context.Request.Path, extensions: Extensions(context, code));
    private static IResult Conflict(HttpContext context, string code, string title, string detail) => Results.Problem(statusCode: 409, title: title, detail: detail, instance: context.Request.Path, extensions: Extensions(context, code));
    private static Dictionary<string, object?> Extensions(HttpContext context, string code) => new() { ["code"] = code, ["traceId"] = context.TraceIdentifier };
}
