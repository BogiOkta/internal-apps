using System.IdentityModel.Tokens.Jwt;
using InternalApps.Api.Modules.Identity;

namespace InternalApps.Api.Core.BusinessCalendar;

internal static class BusinessCalendarEndpoints
{
    public static IEndpointRouteBuilder MapBusinessCalendarEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/business-calendar")
            .RequireAuthorization()
            .WithTags("Business Calendar");

        group.MapGet("/working-days/{date}", CheckAsync);
        group.MapGet("/working-days", CountAsync);

        var admin = group.MapGroup("/non-working-days")
            .RequireAuthorization(IdentityPermissions.ManageUsers);
        admin.MapGet("", ListAsync);
        admin.MapGet("/{publicId:guid}", GetAsync);
        admin.MapPost("", CreateAsync);
        admin.MapPut("/{publicId:guid}", UpdateAsync);
        admin.MapDelete("/{publicId:guid}", DeleteAsync);
        return endpoints;
    }

    private static async Task<IResult> CheckAsync(
        DateOnly date, BusinessCalendarService service, CancellationToken token) =>
        Results.Ok(new WorkingDayResponse(
            date, await service.IsWorkingDay(date, token)));

    private static async Task<IResult> CountAsync(
        DateOnly? from, DateOnly? to, HttpContext context,
        BusinessCalendarService service, CancellationToken token)
    {
        var errors = new Dictionary<string, string[]>();
        if (from is null) errors["from"] = ["The field is required."];
        if (to is null) errors["to"] = ["The field is required."];
        if (from is not null && to is not null && from > to)
            errors["to"] = ["The end date must not precede the start date."];
        if (errors.Count > 0) return Validation(context, errors);
        var count = await service.WorkingDaysBetween(from!.Value, to!.Value, token);
        return Results.Ok(new WorkingDaysBetweenResponse(from.Value, to.Value, count));
    }

    private static async Task<IResult> ListAsync(
        int? year, HttpContext context, NonWorkingDaysService service,
        CancellationToken token)
    {
        if (year is < 1 or > 9999)
            return Validation(context,
                new() { ["year"] = ["Year must be between 1 and 9999."] });
        return Results.Ok(await service.ListAsync(year, token));
    }

    private static async Task<IResult> GetAsync(
        Guid publicId, HttpContext context, NonWorkingDaysService service,
        CancellationToken token)
    {
        var result = await service.GetAsync(publicId, token);
        return result is null ? NotFound(context) : Results.Ok(result);
    }

    private static async Task<IResult> CreateAsync(
        CreateNonWorkingDayRequest request, HttpContext context,
        NonWorkingDaysService service, CancellationToken token)
    {
        if (!Actor(context, out var actor)) return Results.Unauthorized();
        var result = await service.CreateAsync(
            request, actor, context.TraceIdentifier, token);
        return result.Status == NonWorkingDayWriteStatus.Success
            ? Results.Created(
                $"/api/v1/business-calendar/non-working-days/{result.NonWorkingDay!.PublicId}",
                result.NonWorkingDay)
            : Problem(context, result);
    }

    private static async Task<IResult> UpdateAsync(
        Guid publicId, UpdateNonWorkingDayRequest request, HttpContext context,
        NonWorkingDaysService service, CancellationToken token)
    {
        if (!Actor(context, out var actor)) return Results.Unauthorized();
        var result = await service.UpdateAsync(
            publicId, request, actor, context.TraceIdentifier, token);
        return result.Status == NonWorkingDayWriteStatus.Success
            ? Results.Ok(result.NonWorkingDay)
            : Problem(context, result);
    }

    private static async Task<IResult> DeleteAsync(
        Guid publicId, HttpContext context, NonWorkingDaysService service,
        CancellationToken token)
    {
        if (!Actor(context, out var actor)) return Results.Unauthorized();
        var result = await service.DeleteAsync(
            publicId, actor, context.TraceIdentifier, token);
        return result.Status == NonWorkingDayWriteStatus.Success
            ? Results.NoContent()
            : Problem(context, result);
    }

    private static IResult Problem(HttpContext context, NonWorkingDayWriteResult result) =>
        result.Status switch
        {
            NonWorkingDayWriteStatus.ValidationFailed =>
                Validation(context, result.Errors!),
            NonWorkingDayWriteStatus.NotFound => NotFound(context),
            NonWorkingDayWriteStatus.DuplicateDate => Results.Problem(
                statusCode: 409, title: "Non-working date already exists",
                detail: "A non-working day with the requested date already exists.",
                instance: context.Request.Path,
                extensions: Extensions(context, "non_working_day_date_conflict")),
            _ => Results.Problem(
                statusCode: 500, title: "Business Calendar operation failed",
                detail: "The operation could not be completed.",
                instance: context.Request.Path,
                extensions: Extensions(context, "business_calendar_operation_failed"))
        };

    private static IResult Validation(
        HttpContext context, Dictionary<string, string[]> errors) =>
        Results.ValidationProblem(
            errors, title: "Validation failed",
            detail: "One or more fields are invalid.",
            instance: context.Request.Path,
            extensions: Extensions(context, "validation_failed"));

    private static IResult NotFound(HttpContext context) =>
        Results.Problem(
            statusCode: 404, title: "Non-working day not found",
            detail: "The requested non-working day does not exist.",
            instance: context.Request.Path,
            extensions: Extensions(context, "non_working_day_not_found"));

    private static Dictionary<string, object?> Extensions(
        HttpContext context, string code) =>
        new() { ["code"] = code, ["traceId"] = context.TraceIdentifier };

    private static bool Actor(HttpContext context, out Guid actor) =>
        Guid.TryParse(
            context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out actor);
}
