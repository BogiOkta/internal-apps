namespace InternalApps.Api.Modules.Organization;

using System.IdentityModel.Tokens.Jwt;

internal static class OrganizationEndpoints
{
    private static readonly HashSet<string> DepartmentSorts =
    [
        "name",
        "-name",
        "code",
        "-code",
        "status",
        "-status"
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
        organization.MapPost("/departments", CreateDepartmentAsync)
            .RequireAuthorization(OrganizationPermissions.ManageDepartments);
        organization.MapPut("/departments/{publicId:guid}", UpdateDepartmentAsync)
            .RequireAuthorization(OrganizationPermissions.ManageDepartments);
        organization.MapDelete("/departments/{publicId:guid}", DeleteDepartmentAsync)
            .RequireAuthorization(OrganizationPermissions.ManageDepartments);
        organization.MapPost("/departments/{publicId:guid}/activate",
                (Guid publicId, HttpContext context, DepartmentsService service,
                    CancellationToken token) =>
                    SetDepartmentActiveAsync(publicId, true, context, service, token))
            .RequireAuthorization(OrganizationPermissions.ManageDepartments);
        organization.MapPost("/departments/{publicId:guid}/deactivate",
                (Guid publicId, HttpContext context, DepartmentsService service,
                    CancellationToken token) =>
                    SetDepartmentActiveAsync(publicId, false, context, service, token))
            .RequireAuthorization(OrganizationPermissions.ManageDepartments);
        organization.MapGet("/employees", ListEmployeesAsync);
        organization.MapPost("/employees", CreateEmployeeAsync)
            .RequireAuthorization(OrganizationPermissions.ManageEmployees);
        organization.MapPut("/employees/{publicId:guid}", UpdateEmployeeAsync)
            .RequireAuthorization(OrganizationPermissions.ManageEmployees);
        organization.MapDelete("/employees/{publicId:guid}", DeleteEmployeeAsync)
            .RequireAuthorization(OrganizationPermissions.ManageEmployees);
        organization.MapPost("/employees/{publicId:guid}/activate",
                (Guid publicId, HttpContext context, EmployeesService service,
                    CancellationToken token) =>
                    SetActiveAsync(publicId, true, context, service, token))
            .RequireAuthorization(OrganizationPermissions.ManageEmployees);
        organization.MapPost("/employees/{publicId:guid}/deactivate",
                (Guid publicId, HttpContext context, EmployeesService service,
                    CancellationToken token) =>
                    SetActiveAsync(publicId, false, context, service, token))
            .RequireAuthorization(OrganizationPermissions.ManageEmployees);
        organization.MapGet("/user-employee-links", ListUserEmployeeLinksAsync)
            .RequireAuthorization(OrganizationPermissions.ManageUserEmployeeLinks);
        organization.MapGet("/user-employee-links/options", GetUserEmployeeLinkOptionsAsync)
            .RequireAuthorization(OrganizationPermissions.ManageUserEmployeeLinks);
        organization.MapPost("/user-employee-links", CreateUserEmployeeLinkAsync)
            .RequireAuthorization(OrganizationPermissions.ManageUserEmployeeLinks);
        organization.MapPut("/user-employee-links/{publicId:guid}", UpdateUserEmployeeLinkAsync)
            .RequireAuthorization(OrganizationPermissions.ManageUserEmployeeLinks);
        organization.MapPost("/user-employee-links/{publicId:guid}/unlink", UnlinkUserEmployeeAsync)
            .RequireAuthorization(OrganizationPermissions.ManageUserEmployeeLinks);

        return endpoints;
    }

    private static async Task<IResult> ListUserEmployeeLinksAsync(
        UserEmployeeLinksService service, CancellationToken cancellationToken) =>
        Results.Ok(await service.ListAsync(cancellationToken));

    private static async Task<IResult> GetUserEmployeeLinkOptionsAsync(
        UserEmployeeLinksService service, CancellationToken cancellationToken) =>
        Results.Ok(await service.GetOptionsAsync(cancellationToken));

    private static async Task<IResult> CreateUserEmployeeLinkAsync(
        CreateUserEmployeeLinkRequest request, HttpContext context,
        UserEmployeeLinksService service, CancellationToken cancellationToken)
    {
        if (!TryGetActor(context, out var actor)) return Results.Unauthorized();
        var result = await service.CreateAsync(
            request, actor, context.TraceIdentifier, cancellationToken);
        return result.Status == UserEmployeeLinkWriteStatus.Success
            ? Results.Created(
                $"/api/v1/organization/user-employee-links/{result.Link!.PublicId}",
                result.Link)
            : LinkProblem(context, result);
    }

    private static async Task<IResult> UpdateUserEmployeeLinkAsync(
        Guid publicId, UpdateUserEmployeeLinkRequest request, HttpContext context,
        UserEmployeeLinksService service, CancellationToken cancellationToken)
    {
        if (!TryGetActor(context, out var actor)) return Results.Unauthorized();
        var result = await service.UpdateAsync(publicId, request, actor,
            context.TraceIdentifier, cancellationToken);
        return result.Status == UserEmployeeLinkWriteStatus.Success
            ? Results.Ok(result.Link)
            : LinkProblem(context, result);
    }

    private static async Task<IResult> UnlinkUserEmployeeAsync(
        Guid publicId, HttpContext context, UserEmployeeLinksService service,
        CancellationToken cancellationToken)
    {
        if (!TryGetActor(context, out var actor)) return Results.Unauthorized();
        var result = await service.UnlinkAsync(
            publicId, actor, context.TraceIdentifier, cancellationToken);
        return result.Status == UserEmployeeLinkWriteStatus.Success
            ? Results.Ok(result.Link)
            : LinkProblem(context, result);
    }

    private static IResult LinkProblem(
        HttpContext context, UserEmployeeLinkWriteResult result)
    {
        if (result.Status == UserEmployeeLinkWriteStatus.ValidationFailed)
            return ValidationProblem(context, result.Errors!);
        var (status, title, code, detail) = result.Status switch
        {
            UserEmployeeLinkWriteStatus.NotFound =>
                (404, "Link not found", "user_employee_link_not_found",
                    "The requested user-employee link does not exist."),
            UserEmployeeLinkWriteStatus.UnknownUser =>
                (400, "Invalid user", "user_employee_link_user_not_found",
                    "The requested user does not exist."),
            UserEmployeeLinkWriteStatus.InactiveUser =>
                (409, "Inactive user", "user_employee_link_user_inactive",
                    "An inactive user cannot receive a new employee link."),
            UserEmployeeLinkWriteStatus.UnknownEmployee =>
                (400, "Invalid employee", "user_employee_link_employee_not_found",
                    "The requested employee does not exist."),
            UserEmployeeLinkWriteStatus.InactiveEmployee =>
                (409, "Inactive employee", "user_employee_link_employee_inactive",
                    "An inactive employee cannot receive a new user link."),
            UserEmployeeLinkWriteStatus.UserAlreadyLinked =>
                (409, "User already linked", "user_employee_link_user_conflict",
                    "The requested user is already linked to an employee."),
            UserEmployeeLinkWriteStatus.EmployeeAlreadyLinked =>
                (409, "Employee already linked", "user_employee_link_employee_conflict",
                    "The requested employee is already linked to a user."),
            _ => (500, "Unexpected error", "unexpected_error",
                "The request could not be completed.")
        };
        return Problem(context, status, title, code, detail);
    }

    private static async Task<IResult> ListDepartmentsAsync(
        string? search,
        string? status,
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

        if (status is not null and not "" and not "all" and not "active" and not "inactive")
        {
            return ValidationProblem(context, new Dictionary<string, string[]>
            {
                ["status"] = ["Status must be active, inactive, or all."]
            });
        }

        // Preserves the pre-administration contract: an omitted status returns only
        // active departments, matching existing employee-form and directory consumers.
        var isActiveFilter = status switch
        {
            "inactive" => false,
            "all" => (bool?)null,
            _ => true
        };

        var departments = await repository.ListDepartmentsAsync(
            search,
            isActiveFilter,
            sort,
            cancellationToken);

        return Results.Ok(departments);
    }

    private static async Task<IResult> CreateDepartmentAsync(
        CreateDepartmentRequest request, HttpContext context, DepartmentsService service,
        CancellationToken cancellationToken)
    {
        if (!TryGetActor(context, out var actor)) return Results.Unauthorized();
        var result = await service.CreateAsync(
            request, actor, context.TraceIdentifier, cancellationToken);
        return result.Status == DepartmentWriteStatus.Success
            ? Results.Created($"/api/v1/organization/departments/{result.Department!.PublicId}",
                result.Department)
            : DepartmentWriteProblem(context, result);
    }

    private static async Task<IResult> UpdateDepartmentAsync(
        Guid publicId, UpdateDepartmentRequest request, HttpContext context,
        DepartmentsService service, CancellationToken cancellationToken)
    {
        if (!TryGetActor(context, out var actor)) return Results.Unauthorized();
        return DepartmentWriteProblem(context, await service.UpdateAsync(
            publicId, request, actor, context.TraceIdentifier, cancellationToken));
    }

    private static async Task<IResult> SetDepartmentActiveAsync(
        Guid publicId, bool active, HttpContext context, DepartmentsService service,
        CancellationToken cancellationToken)
    {
        if (!TryGetActor(context, out var actor)) return Results.Unauthorized();
        return DepartmentWriteProblem(context, await service.SetActiveAsync(
            publicId, active, actor, context.TraceIdentifier, cancellationToken));
    }

    private static async Task<IResult> DeleteDepartmentAsync(Guid publicId,
        HttpContext context, DepartmentsService service, CancellationToken cancellationToken)
    {
        if (!TryGetActor(context, out var actor)) return Results.Unauthorized();
        var result = await service.DeleteAsync(publicId, actor, context.TraceIdentifier, cancellationToken);
        return result.Status switch
        {
            DepartmentWriteStatus.Success => Results.NoContent(),
            DepartmentWriteStatus.NotFound => Problem(context, 404, "Department not found",
                "department_not_found", "The requested department does not exist."),
            DepartmentWriteStatus.HasDependencies => Results.Problem(statusCode: 409,
                title: "Department is referenced",
                detail: "Referenced departments cannot be deleted and must be deactivated instead.",
                instance: context.Request.Path,
                extensions: new Dictionary<string, object?>
                {
                    ["code"] = "department_delete_conflict",
                    ["traceId"] = context.TraceIdentifier,
                    ["dependencies"] = result.Dependencies ?? []
                }),
            _ => Results.Problem(statusCode: 500)
        };
    }

    private static IResult DepartmentWriteProblem(HttpContext context, DepartmentWriteResult result) =>
        result.Status switch
        {
            DepartmentWriteStatus.Success => Results.Ok(result.Department),
            DepartmentWriteStatus.ValidationFailed => ValidationProblem(context, result.Errors!),
            DepartmentWriteStatus.NotFound => Problem(context, 404, "Department not found",
                "department_not_found", "The requested department does not exist."),
            DepartmentWriteStatus.DuplicateCode => Problem(context, 409,
                "Department code already exists", "department_code_conflict",
                "A department with the requested code already exists."),
            _ => Results.Problem(statusCode: 500)
        };

    private static async Task<IResult> ListEmployeesAsync(
        string? search,
        string? employeeNumber,
        string? name,
        Guid? departmentPublicId,
        string? email,
        string? status,
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

        var filterErrors = new Dictionary<string, string[]>();
        ValidateOptionalLength(employeeNumber, "employeeNumber", 30, filterErrors);
        ValidateOptionalLength(name, "name", 201, filterErrors);
        ValidateOptionalLength(email, "email", 254, filterErrors);
        if (status is not null and not "" and not "all" and not "active" and not "inactive")
            filterErrors["status"] = ["Status must be active, inactive, or all."];
        if (filterErrors.Count > 0) return ValidationProblem(context, filterErrors);

        var employees = await repository.ListEmployeesAsync(
            search,
            employeeNumber,
            name,
            departmentPublicId,
            email,
            status switch { "active" => "Active", "inactive" => "Inactive", _ => null },
            sort,
            cancellationToken);

        return Results.Ok(employees);
    }

    private static async Task<IResult> CreateEmployeeAsync(
        CreateEmployeeRequest request, HttpContext context, EmployeesService service,
        CancellationToken cancellationToken)
    {
        if (!TryGetActor(context, out var actor)) return Results.Unauthorized();
        var result = await service.CreateAsync(
            request, actor, context.TraceIdentifier, cancellationToken);
        return result.Status == EmployeeWriteStatus.Success
            ? Results.Created($"/api/v1/organization/employees/{result.Employee!.PublicId}",
                result.Employee)
            : WriteProblem(context, result);
    }

    private static async Task<IResult> UpdateEmployeeAsync(
        Guid publicId, UpdateEmployeeRequest request, HttpContext context,
        EmployeesService service, CancellationToken cancellationToken)
    {
        if (!TryGetActor(context, out var actor)) return Results.Unauthorized();
        return WriteProblem(context, await service.UpdateAsync(
            publicId, request, actor, context.TraceIdentifier, cancellationToken));
    }

    private static async Task<IResult> SetActiveAsync(
        Guid publicId, bool active, HttpContext context, EmployeesService service,
        CancellationToken cancellationToken)
    {
        if (!TryGetActor(context, out var actor)) return Results.Unauthorized();
        return WriteProblem(context, await service.SetActiveAsync(
            publicId, active, actor, context.TraceIdentifier, cancellationToken));
    }

    private static async Task<IResult> DeleteEmployeeAsync(Guid publicId,
        HttpContext context, EmployeesService service, CancellationToken cancellationToken)
    {
        if (!TryGetActor(context, out var actor)) return Results.Unauthorized();
        var result = await service.DeleteAsync(publicId, actor, context.TraceIdentifier, cancellationToken);
        return result.Status switch
        {
            EmployeeWriteStatus.Success => Results.NoContent(),
            EmployeeWriteStatus.NotFound => Problem(context, 404, "Employee not found", "employee_not_found", "The requested employee does not exist."),
            EmployeeWriteStatus.HasDependencies => Results.Problem(statusCode: 409, title: "Employee is referenced", detail: "Referenced employees cannot be deleted and must be deactivated instead.", instance: context.Request.Path, extensions: new Dictionary<string, object?> { ["code"] = "employee_delete_conflict", ["traceId"] = context.TraceIdentifier, ["dependencies"] = result.Dependencies ?? [] }),
            _ => Results.Problem(statusCode: 500)
        };
    }

    private static IResult WriteProblem(HttpContext context, EmployeeWriteResult result) =>
        result.Status switch
        {
            EmployeeWriteStatus.Success => Results.Ok(result.Employee),
            EmployeeWriteStatus.ValidationFailed => ValidationProblem(context, result.Errors!),
            EmployeeWriteStatus.NotFound => Problem(context, 404, "Employee not found",
                "employee_not_found", "The requested employee does not exist."),
            EmployeeWriteStatus.InvalidDepartment => Results.ValidationProblem(
                new Dictionary<string, string[]>
                {
                    ["departmentPublicId"] = ["The requested department does not exist."]
                },
                title: "Invalid department",
                detail: "One or more fields are invalid.",
                instance: context.Request.Path,
                extensions: new Dictionary<string, object?>
                {
                    ["code"] = "invalid_department",
                    ["traceId"] = context.TraceIdentifier
                }),
            EmployeeWriteStatus.DuplicateEmployeeNumber => Problem(context, 409,
                "Employee number already exists", "employee_number_conflict",
                "An employee with the requested employee number already exists."),
            EmployeeWriteStatus.DuplicateEmail => Problem(context, 409,
                "Employee email already exists", "employee_email_conflict",
                "An employee with the requested email already exists."),
            _ => Results.Problem(statusCode: 500)
        };

    private static IResult ValidationProblem(HttpContext context,
        Dictionary<string, string[]> errors) =>
        Results.ValidationProblem(errors, title: "Validation failed",
            detail: "One or more fields are invalid.", instance: context.Request.Path,
            extensions: new Dictionary<string, object?> {
                ["code"] = "validation_failed", ["traceId"] = context.TraceIdentifier });

    private static IResult Problem(HttpContext context, int status, string title,
        string code, string detail) =>
        Results.Problem(statusCode: status, title: title, detail: detail,
            instance: context.Request.Path,
            extensions: new Dictionary<string, object?> {
                ["code"] = code, ["traceId"] = context.TraceIdentifier });

    private static bool TryGetActor(HttpContext context, out Guid actor) =>
        Guid.TryParse(context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out actor);

    private static void ValidateOptionalLength(string? value, string field, int max,
        Dictionary<string, string[]> errors)
    {
        if (value?.Trim().Length > max)
            errors[field] = [$"The field must not exceed {max} characters."];
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
