using InternalApps.Api.Infrastructure.Auditing;
using Npgsql;

namespace InternalApps.Api.Modules.Organization;

internal sealed class UserEmployeeLinksService(
    NpgsqlDataSource dataSource,
    UserEmployeeLinksRepository repository,
    AuditWriter auditWriter)
{
    public Task<IReadOnlyList<UserEmployeeLinkResponse>> ListAsync(
        CancellationToken cancellationToken) => repository.ListAsync(cancellationToken);

    public Task<UserEmployeeLinkOptionsResponse> GetOptionsAsync(
        CancellationToken cancellationToken) => repository.GetOptionsAsync(cancellationToken);

    public Task<EmployeeResponse?> GetEmployeeForUserAsync(
        Guid userPublicId, CancellationToken cancellationToken) =>
        repository.GetEmployeeForUserAsync(userPublicId, cancellationToken);

    public Task<UserEmployeeLinkWriteResult> CreateAsync(
        CreateUserEmployeeLinkRequest request, Guid actorPublicId, string traceId,
        CancellationToken cancellationToken) =>
        WriteAsync(null, request.UserPublicId, request.EmployeePublicId,
            actorPublicId, traceId, cancellationToken);

    public Task<UserEmployeeLinkWriteResult> UpdateAsync(
        Guid publicId, UpdateUserEmployeeLinkRequest request, Guid actorPublicId,
        string traceId, CancellationToken cancellationToken) =>
        WriteAsync(publicId, request.UserPublicId, request.EmployeePublicId,
            actorPublicId, traceId, cancellationToken);

    public async Task<UserEmployeeLinkWriteResult> UnlinkAsync(
        Guid publicId, Guid actorPublicId, string traceId,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        var current = await repository.GetForUpdateAsync(
            connection, transaction, publicId, cancellationToken);
        if (current is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(UserEmployeeLinkWriteStatus.NotFound);
        }

        await repository.DeleteAsync(connection, transaction, publicId, cancellationToken);
        await auditWriter.WriteAsync(connection, transaction,
            Audit(actorPublicId, "organization.user-employee-links.removed",
                publicId, traceId,
                [
                    new("user_public_id", current.UserPublicId.ToString(), null),
                    new("employee_public_id", current.Employee.PublicId.ToString(), null)
                ]),
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new(UserEmployeeLinkWriteStatus.Success, current);
    }

    private async Task<UserEmployeeLinkWriteResult> WriteAsync(
        Guid? linkPublicId, Guid? userPublicId, Guid? employeePublicId,
        Guid actorPublicId, string traceId, CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        if (userPublicId is null || userPublicId == Guid.Empty)
            errors["userPublicId"] = ["User is required."];
        if (employeePublicId is null || employeePublicId == Guid.Empty)
            errors["employeePublicId"] = ["Employee is required."];
        if (errors.Count > 0)
            return new(UserEmployeeLinkWriteStatus.ValidationFailed, Errors: errors);

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        UserEmployeeLinkResponse? previous = null;
        if (linkPublicId is not null)
        {
            previous = await repository.GetForUpdateAsync(
                connection, transaction, linkPublicId.Value, cancellationToken);
            if (previous is null)
            {
                await transaction.RollbackAsync(cancellationToken);
                return new(UserEmployeeLinkWriteStatus.NotFound);
            }
        }

        var requestedUserPublicId = userPublicId.GetValueOrDefault();
        var requestedEmployeePublicId = employeePublicId.GetValueOrDefault();
        var user = await repository.ResolveUserAsync(
            connection, transaction, requestedUserPublicId, cancellationToken);
        if (user is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(UserEmployeeLinkWriteStatus.UnknownUser);
        }
        if (!user.IsActive)
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(UserEmployeeLinkWriteStatus.InactiveUser);
        }
        var employee = await repository.ResolveEmployeeAsync(
            connection, transaction, requestedEmployeePublicId, cancellationToken);
        if (employee is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(UserEmployeeLinkWriteStatus.UnknownEmployee);
        }
        if (!employee.IsActive)
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(UserEmployeeLinkWriteStatus.InactiveEmployee);
        }
        var actorId = await repository.ResolveActorIdAsync(
            connection, transaction, actorPublicId, cancellationToken);
        if (actorId is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(UserEmployeeLinkWriteStatus.UnknownUser);
        }

        try
        {
            if (previous is not null &&
                previous.UserPublicId == requestedUserPublicId &&
                previous.Employee.PublicId == requestedEmployeePublicId)
            {
                await transaction.RollbackAsync(cancellationToken);
                return new(UserEmployeeLinkWriteStatus.Success, previous);
            }
            var publicId = linkPublicId ?? await repository.CreateAsync(
                connection, transaction, user.Id, employee.Id,
                actorId.Value, cancellationToken);
            if (linkPublicId is not null)
                await repository.UpdateAsync(connection, transaction, publicId,
                    user.Id, employee.Id, actorId.Value, cancellationToken);

            var current = await repository.GetForUpdateAsync(
                connection, transaction, publicId, cancellationToken);
            var changes = new List<AuditChange>();
            if (previous is null || previous.UserPublicId != current!.UserPublicId)
                changes.Add(new("user_public_id", previous?.UserPublicId.ToString(),
                    current!.UserPublicId.ToString()));
            if (previous is null ||
                previous.Employee.PublicId != current!.Employee.PublicId)
                changes.Add(new("employee_public_id",
                    previous?.Employee.PublicId.ToString(),
                    current!.Employee.PublicId.ToString()));
            await auditWriter.WriteAsync(connection, transaction,
                Audit(actorPublicId,
                    previous is null
                        ? "organization.user-employee-links.created"
                        : "organization.user-employee-links.changed",
                    publicId, traceId, changes),
                cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return new(UserEmployeeLinkWriteStatus.Success, current);
        }
        catch (PostgresException exception) when (
            exception.ConstraintName == "uq_user_employee_links_user_id")
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(UserEmployeeLinkWriteStatus.UserAlreadyLinked);
        }
        catch (PostgresException exception) when (
            exception.ConstraintName == "uq_user_employee_links_employee_id")
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(UserEmployeeLinkWriteStatus.EmployeeAlreadyLinked);
        }
    }

    private static AuditEntry Audit(Guid actor, string action, Guid target,
        string trace, IReadOnlyCollection<AuditChange> changes) =>
        new(actor, "organization", action, "user_employee_link", target, trace, changes);
}
