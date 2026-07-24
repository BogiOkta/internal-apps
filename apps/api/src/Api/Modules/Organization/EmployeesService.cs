using System.Net.Mail;
using InternalApps.Api.Infrastructure.Auditing;
using Npgsql;

namespace InternalApps.Api.Modules.Organization;

internal sealed class EmployeesService(
    NpgsqlDataSource dataSource,
    OrganizationRepository repository,
    AuditWriter auditWriter)
{
    public async Task<EmployeeWriteResult> CreateAsync(
        CreateEmployeeRequest request,
        Guid actorUserPublicId,
        string traceId,
        CancellationToken cancellationToken)
    {
        var errors = Validate(request, out var command);
        if (errors.Count > 0)
        {
            return new(EmployeeWriteStatus.ValidationFailed, Errors: errors);
        }

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        if (!await repository.DepartmentExistsAsync(
                connection, transaction, command.DepartmentPublicId, cancellationToken))
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(EmployeeWriteStatus.InvalidDepartment);
        }

        try
        {
            var employee = await repository.CreateEmployeeAsync(
                connection, transaction, command, cancellationToken);
            await auditWriter.WriteAsync(
                connection,
                transaction,
                Audit(actorUserPublicId, "organization.employees.created",
                    employee.PublicId, traceId,
                    [new AuditChange("record", null, "created")]),
                cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return new(EmployeeWriteStatus.Success, employee);
        }
        catch (PostgresException exception) when (
            exception.ConstraintName is "uq_vacation_employees_employee_number")
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(EmployeeWriteStatus.DuplicateEmployeeNumber);
        }
        catch (PostgresException exception) when (
            exception.ConstraintName is "uq_vacation_employees_email_ci")
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(EmployeeWriteStatus.DuplicateEmail);
        }
    }

    public async Task<EmployeeWriteResult> UpdateAsync(
        Guid publicId,
        UpdateEmployeeRequest request,
        Guid actorUserPublicId,
        string traceId,
        CancellationToken cancellationToken)
    {
        var errors = Validate(request, out var command);
        if (errors.Count > 0)
        {
            return new(EmployeeWriteStatus.ValidationFailed, Errors: errors);
        }

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        var previous = await repository.GetEmployeeForUpdateAsync(
            connection, transaction, publicId, cancellationToken);
        if (previous is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(EmployeeWriteStatus.NotFound);
        }
        if (!await repository.DepartmentExistsAsync(
                connection, transaction, command.DepartmentPublicId, cancellationToken))
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(EmployeeWriteStatus.InvalidDepartment);
        }

        try
        {
            var employee = await repository.UpdateEmployeeAsync(
                connection, transaction, publicId, command, cancellationToken);
            var changes = Changes(previous, employee);
            await auditWriter.WriteAsync(
                connection,
                transaction,
                Audit(actorUserPublicId, "organization.employees.updated",
                    publicId, traceId,
                    changes.Count == 0
                        ? [new AuditChange("record", null, "updated")]
                        : changes),
                cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return new(EmployeeWriteStatus.Success, employee);
        }
        catch (PostgresException exception) when (
            exception.ConstraintName is "uq_vacation_employees_email_ci")
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(EmployeeWriteStatus.DuplicateEmail);
        }
    }

    public async Task<EmployeeWriteResult> SetActiveAsync(
        Guid publicId,
        bool isActive,
        Guid actorUserPublicId,
        string traceId,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        var previous = await repository.GetEmployeeForUpdateAsync(
            connection, transaction, publicId, cancellationToken);
        if (previous is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(EmployeeWriteStatus.NotFound);
        }
        var expectedStatus = isActive ? "Active" : "Inactive";
        if (previous.EmploymentStatus == expectedStatus)
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(EmployeeWriteStatus.Success, previous);
        }

        var employee = await repository.SetEmployeeActiveAsync(
            connection, transaction, publicId, isActive, cancellationToken);
        await auditWriter.WriteAsync(
            connection,
            transaction,
            Audit(actorUserPublicId,
                isActive
                    ? "organization.employees.activated"
                    : "organization.employees.deactivated",
                publicId,
                traceId,
                [new AuditChange("employment_status",
                    previous.EmploymentStatus, employee.EmploymentStatus)]),
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new(EmployeeWriteStatus.Success, employee);
    }

    private static Dictionary<string, string[]> Validate(
        CreateEmployeeRequest request,
        out CreateEmployeeCommand command)
    {
        var errors = new Dictionary<string, string[]>();
        var employeeNumber = Required(request.EmployeeNumber, "employeeNumber", 30, errors);
        var firstName = Required(request.FirstName, "firstName", 100, errors);
        var lastName = Required(request.LastName, "lastName", 100, errors);
        var email = Email(request.Email, errors);
        ValidateDepartment(request.DepartmentPublicId, errors);
        if (request.IsActive is null) errors["isActive"] = ["The field is required."];
        command = new(employeeNumber, firstName, lastName, email,
            request.DepartmentPublicId.GetValueOrDefault(), request.IsActive.GetValueOrDefault());
        return errors;
    }

    private static Dictionary<string, string[]> Validate(
        UpdateEmployeeRequest request,
        out EmployeeCommand command)
    {
        var errors = new Dictionary<string, string[]>();
        var firstName = Required(request.FirstName, "firstName", 100, errors);
        var lastName = Required(request.LastName, "lastName", 100, errors);
        var email = Email(request.Email, errors);
        ValidateDepartment(request.DepartmentPublicId, errors);
        command = new(firstName, lastName, email,
            request.DepartmentPublicId.GetValueOrDefault());
        return errors;
    }

    private static string Required(string? value, string field, int max,
        Dictionary<string, string[]> errors)
    {
        var result = value?.Trim() ?? "";
        if (result.Length == 0) errors[field] = ["The field is required."];
        else if (result.Length > max) errors[field] = [$"The field must not exceed {max} characters."];
        return result;
    }

    private static string Email(string? value, Dictionary<string, string[]> errors)
    {
        var result = Required(value, "email", 254, errors);
        if (result.Length > 0 &&
            (!MailAddress.TryCreate(result, out var parsed) ||
             !string.Equals(parsed.Address, result, StringComparison.OrdinalIgnoreCase)))
        {
            errors["email"] = ["Email must be a valid address."];
        }
        return result;
    }

    private static void ValidateDepartment(Guid? value, Dictionary<string, string[]> errors)
    {
        if (value is null || value == Guid.Empty)
            errors["departmentPublicId"] = ["Department is required."];
    }

    private static List<AuditChange> Changes(EmployeeResponse before, EmployeeResponse after)
    {
        var changes = new List<AuditChange>();
        Add(changes, "first_name", before.FirstName, after.FirstName);
        Add(changes, "last_name", before.LastName, after.LastName);
        Add(changes, "email", before.Email, after.Email);
        Add(changes, "department_public_id",
            before.DepartmentPublicId.ToString(), after.DepartmentPublicId.ToString());
        return changes;
    }

    private static void Add(List<AuditChange> changes, string field, string before, string after)
    {
        if (!string.Equals(before, after, StringComparison.Ordinal))
            changes.Add(new(field, before, after));
    }

    private static AuditEntry Audit(Guid actor, string action, Guid target, string trace,
        IReadOnlyCollection<AuditChange> changes) =>
        new(actor, "organization", action, "employee", target, trace, changes);
}
