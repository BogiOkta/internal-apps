namespace InternalApps.Api.Modules.Organization;

internal static class OrganizationEndpoints
{
    private static readonly HashSet<string> DepartmentSorts =
    [
        "name",
        "-name",
        "code",
        "-code"
    ];

    private static readonly HashSet<string> EmployeeSorts =
    [
        "name",
        "-name",
        "employeeNumber",
        "-employeeNumber",
        "department",
        "-department",
        "email",
        "-email",
        "status",
        "-status"
    ];

    public static IEndpointRouteBuilder MapOrganizationEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        var organization = endpoints
            .MapGroup("/api/v1/organization")
            .RequireAuthorization()
            .WithTags("Organization");

        organization.MapGet("/departments", ListDepartmentsAsync);
        organization.MapGet("/employees", ListEmployeesAsync);

        return endpoints;
    }

    private static async Task<IResult> ListDepartmentsAsync(
        string? search,
        string? sort,
        HttpContext context,
        OrganizationRepository repository,
        CancellationToken cancellationToken)
    {
        var validationResult = ValidateQuery(search, sort, DepartmentSorts, context);
        if (validationResult is not null)
        {
            return validationResult;
        }

        var departments = await repository.ListDepartmentsAsync(
            search,
            sort,
            cancellationToken);

        return Results.Ok(departments);
    }

    private static async Task<IResult> ListEmployeesAsync(
        string? search,
        Guid? departmentPublicId,
        string? sort,
        HttpContext context,
        OrganizationRepository repository,
        CancellationToken cancellationToken)
    {
        var validationResult = ValidateQuery(search, sort, EmployeeSorts, context);
        if (validationResult is not null)
        {
            return validationResult;
        }

        var employees = await repository.ListEmployeesAsync(
            search,
            departmentPublicId,
            sort,
            cancellationToken);

        return Results.Ok(employees);
    }

    private static IResult? ValidateQuery(
        string? search,
        string? sort,
        IReadOnlySet<string> allowedSorts,
        HttpContext context)
    {
        var errors = new Dictionary<string, string[]>();

        if (search?.Length > 100)
        {
            errors["search"] = ["Search must not exceed 100 characters."];
        }

        if (!string.IsNullOrWhiteSpace(sort) && !allowedSorts.Contains(sort))
        {
            errors["sort"] = ["The requested sort is not supported."];
        }

        return errors.Count == 0
            ? null
            : Results.ValidationProblem(
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
}
