using System.IdentityModel.Tokens.Jwt;
using InternalApps.Api.Modules.Identity;

namespace InternalApps.Api.Modules.Vacation;

internal static class LeavePolicyEndpoints
{
    public static IEndpointRouteBuilder MapLeavePolicyEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/vacation/leave-policies")
            .RequireAuthorization(IdentityPermissions.ManageUsers)
            .WithTags("Vacation Leave Policies");
        group.MapGet("", ListAsync);
        group.MapGet("/{policyId:guid}", GetAsync);
        group.MapPost("", CreateAsync);
        group.MapPut("/{policyId:guid}", UpdateAsync);
        group.MapDelete("/{policyId:guid}", DeleteAsync);
        return endpoints;
    }

    private static async Task<IResult> ListAsync(
        int? year, Guid? employee, HttpContext context,
        LeavePoliciesService service, CancellationToken token)
    {
        if (year is < 1900 or > 9999)
            return Validation(context, new() { ["year"] = ["Year must be between 1900 and 9999."] });
        return Results.Ok(await service.ListAsync(year, employee, token));
    }

    private static async Task<IResult> GetAsync(
        Guid policyId, HttpContext context, LeavePoliciesService service,
        CancellationToken token) =>
        await service.GetAsync(policyId, token) is { } policy
            ? Results.Ok(policy) : NotFound(context);

    private static async Task<IResult> CreateAsync(
        SaveLeavePolicyRequest request, HttpContext context,
        LeavePoliciesService service, CancellationToken token)
    {
        if (!Actor(context, out var actor)) return Results.Unauthorized();
        var result = await service.CreateAsync(request, actor, context.TraceIdentifier, token);
        return result.Status == LeavePolicyWriteStatus.Success
            ? Results.Created($"/api/v1/vacation/leave-policies/{result.Policy!.PolicyId}",
                result.Policy)
            : Problem(context, result);
    }

    private static async Task<IResult> UpdateAsync(
        Guid policyId, SaveLeavePolicyRequest request, HttpContext context,
        LeavePoliciesService service, CancellationToken token)
    {
        if (!Actor(context, out var actor)) return Results.Unauthorized();
        var result = await service.UpdateAsync(
            policyId, request, actor, context.TraceIdentifier, token);
        return result.Status == LeavePolicyWriteStatus.Success
            ? Results.Ok(result.Policy) : Problem(context, result);
    }

    private static async Task<IResult> DeleteAsync(
        Guid policyId, HttpContext context, LeavePoliciesService service,
        CancellationToken token)
    {
        if (!Actor(context, out var actor)) return Results.Unauthorized();
        var result = await service.DeleteAsync(
            policyId, actor, context.TraceIdentifier, token);
        return result.Status == LeavePolicyWriteStatus.Success
            ? Results.NoContent() : Problem(context, result);
    }

    private static IResult Problem(HttpContext context, LeavePolicyWriteResult result) =>
        result.Status switch
        {
            LeavePolicyWriteStatus.ValidationFailed =>
                Validation(context, result.Errors!),
            LeavePolicyWriteStatus.NotFound => NotFound(context),
            LeavePolicyWriteStatus.EmployeeNotFound => Results.Problem(
                statusCode: 400, title: "Employee not found",
                detail: "The selected employee does not exist.",
                instance: context.Request.Path,
                extensions: Extensions(context, "leave_policy_employee_not_found")),
            LeavePolicyWriteStatus.DuplicateEmployeeYear => Results.Problem(
                statusCode: 409, title: "Leave policy already exists",
                detail: "The employee already has a policy for the selected leave year.",
                instance: context.Request.Path,
                extensions: Extensions(context, "leave_policy_employee_year_conflict")),
            _ => Results.Problem(statusCode: 500, title: "Leave policy operation failed",
                detail: "The operation could not be completed.",
                instance: context.Request.Path,
                extensions: Extensions(context, "leave_policy_operation_failed"))
        };

    private static IResult Validation(HttpContext context, Dictionary<string, string[]> errors) =>
        Results.ValidationProblem(errors, title: "Validation failed",
            detail: "One or more fields are invalid.", instance: context.Request.Path,
            extensions: Extensions(context, "validation_failed"));

    private static IResult NotFound(HttpContext context) =>
        Results.Problem(statusCode: 404, title: "Leave policy not found",
            detail: "The requested leave policy does not exist.",
            instance: context.Request.Path,
            extensions: Extensions(context, "leave_policy_not_found"));

    private static Dictionary<string, object?> Extensions(HttpContext context, string code) =>
        new() { ["code"] = code, ["traceId"] = context.TraceIdentifier };

    private static bool Actor(HttpContext context, out Guid actor) =>
        Guid.TryParse(context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out actor);
}
