using InternalApps.Api.Infrastructure.Auditing;
using Npgsql;

namespace InternalApps.Api.Modules.Organization;

internal sealed class DepartmentsService(
    NpgsqlDataSource dataSource,
    OrganizationRepository repository,
    AuditWriter auditWriter)
{
    private const string DeleteConflictPrefix = "department_delete_conflict:v1:";
    private static readonly HashSet<string> ControlledDependencyNames =
    [
        "Organization employee"
    ];

    public async Task<DepartmentWriteResult> CreateAsync(
        CreateDepartmentRequest request,
        Guid actorUserPublicId,
        string traceId,
        CancellationToken cancellationToken)
    {
        var errors = Validate(request, out var command);
        if (errors.Count > 0)
        {
            return new(DepartmentWriteStatus.ValidationFailed, Errors: errors);
        }

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            var department = await repository.CreateDepartmentAsync(
                connection, transaction, command, cancellationToken);
            await auditWriter.WriteAsync(
                connection,
                transaction,
                Audit(actorUserPublicId, "organization.departments.created",
                    department.PublicId, traceId,
                    [new AuditChange("record", null, "created")]),
                cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return new(DepartmentWriteStatus.Success, department);
        }
        catch (PostgresException exception) when (
            exception.ConstraintName is "uq_vacation_departments_code")
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(DepartmentWriteStatus.DuplicateCode);
        }
    }

    public async Task<DepartmentWriteResult> UpdateAsync(
        Guid publicId,
        UpdateDepartmentRequest request,
        Guid actorUserPublicId,
        string traceId,
        CancellationToken cancellationToken)
    {
        var errors = Validate(request, out var command);
        if (errors.Count > 0)
        {
            return new(DepartmentWriteStatus.ValidationFailed, Errors: errors);
        }

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        var previous = await repository.GetDepartmentForUpdateAsync(
            connection, transaction, publicId, cancellationToken);
        if (previous is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(DepartmentWriteStatus.NotFound);
        }

        var department = await repository.UpdateDepartmentAsync(
            connection, transaction, publicId, command, cancellationToken);
        var changes = Changes(previous, department);
        await auditWriter.WriteAsync(
            connection,
            transaction,
            Audit(actorUserPublicId, "organization.departments.updated",
                publicId, traceId,
                changes.Count == 0
                    ? [new AuditChange("record", null, "updated")]
                    : changes),
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new(DepartmentWriteStatus.Success, department);
    }

    public async Task<DepartmentWriteResult> SetActiveAsync(
        Guid publicId,
        bool isActive,
        Guid actorUserPublicId,
        string traceId,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        var previous = await repository.GetDepartmentForUpdateAsync(
            connection, transaction, publicId, cancellationToken);
        if (previous is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(DepartmentWriteStatus.NotFound);
        }
        if (previous.IsActive == isActive)
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(DepartmentWriteStatus.Success, previous);
        }

        var department = await repository.SetDepartmentActiveAsync(
            connection, transaction, publicId, isActive, cancellationToken);
        await auditWriter.WriteAsync(
            connection,
            transaction,
            Audit(actorUserPublicId,
                isActive
                    ? "organization.departments.activated"
                    : "organization.departments.deactivated",
                publicId,
                traceId,
                [new AuditChange("is_active",
                    previous.IsActive.ToString(), department.IsActive.ToString())]),
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new(DepartmentWriteStatus.Success, department);
    }

    public async Task<DepartmentDeleteResult> DeleteAsync(Guid publicId, Guid actorUserPublicId,
        string traceId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            var deleted = await repository.DeleteUnreferencedDepartmentAsync(
                connection, transaction, publicId, cancellationToken);
            if (!deleted)
            {
                await transaction.RollbackAsync(cancellationToken);
                return new(DepartmentWriteStatus.NotFound);
            }

            await auditWriter.WriteAsync(connection, transaction,
                new AuditEntry(actorUserPublicId, "organization",
                    "organization.departments.deleted", "department",
                    publicId, traceId,
                    [new AuditChange("record", "present", "deleted")]),
                cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return new(DepartmentWriteStatus.Success);
        }
        catch (PostgresException exception) when (
            exception.SqlState == "P0001" &&
            (exception.MessageText == "department_delete_conflict" ||
             exception.MessageText.StartsWith(DeleteConflictPrefix, StringComparison.Ordinal)))
        {
            await transaction.RollbackAsync(cancellationToken);
            var dependencies = ParseDeleteConflictDependencies(exception.MessageText);
            return new(DepartmentWriteStatus.HasDependencies, dependencies);
        }
    }

    // Only labels emitted by the owner-controlled database function cross this boundary.
    private static string[] ParseDeleteConflictDependencies(string message)
    {
        if (!message.StartsWith(DeleteConflictPrefix, StringComparison.Ordinal)) return [];
        var dependencies = message[DeleteConflictPrefix.Length..].Split('|');
        return dependencies.Length > 0 &&
               dependencies.All(dependency =>
                   dependency.Length > 0 && ControlledDependencyNames.Contains(dependency))
            ? dependencies.Distinct(StringComparer.Ordinal).ToArray()
            : [];
    }

    private static Dictionary<string, string[]> Validate(
        CreateDepartmentRequest request,
        out CreateDepartmentCommand command)
    {
        var errors = new Dictionary<string, string[]>();
        var code = Required(request.Code, "code", 30, errors);
        var name = Required(request.Name, "name", 100, errors);
        if (request.IsActive is null) errors["isActive"] = ["The field is required."];
        command = new(code, name, request.IsActive.GetValueOrDefault());
        return errors;
    }

    private static Dictionary<string, string[]> Validate(
        UpdateDepartmentRequest request,
        out DepartmentCommand command)
    {
        var errors = new Dictionary<string, string[]>();
        var name = Required(request.Name, "name", 100, errors);
        command = new(name);
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

    private static List<AuditChange> Changes(DepartmentResponse before, DepartmentResponse after)
    {
        var changes = new List<AuditChange>();
        Add(changes, "name", before.Name, after.Name);
        return changes;
    }

    private static void Add(List<AuditChange> changes, string field, string? before, string? after)
    {
        if (!string.Equals(before, after, StringComparison.Ordinal))
            changes.Add(new(field, before, after));
    }

    private static AuditEntry Audit(Guid actor, string action, Guid target, string trace,
        IReadOnlyCollection<AuditChange> changes) =>
        new(actor, "organization", action, "department", target, trace, changes);
}
