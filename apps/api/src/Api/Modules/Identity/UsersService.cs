using InternalApps.Api.Infrastructure.Auditing;
using Npgsql;

namespace InternalApps.Api.Modules.Identity;

internal sealed class UsersService(
    NpgsqlDataSource dataSource, UsersRepository repository, AuditWriter auditWriter)
{
    private const int MinimumPasswordLength = 12;

    public Task<IReadOnlyList<UserResponse>> ListAsync(CancellationToken token) =>
        repository.ListAsync(token);

    public async Task<UserWriteResult> CreateAsync(
        CreateUserRequest request, Guid actorPublicId, string traceId,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        var username = Required(request.Username, "username", 100, errors);
        var displayName = Required(request.DisplayName, "displayName", 200, errors);
        var password = request.InitialPassword ?? "";
        if (password.Length < MinimumPasswordLength)
            errors["initialPassword"] =
                [$"Password must contain at least {MinimumPasswordLength} characters."];
        if (request.IsActive is null) errors["isActive"] = ["The field is required."];
        if (errors.Count > 0) return new(UserWriteStatus.ValidationFailed, Errors: errors);

        var command = new CreateUserCommand(
            username, displayName,
            BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12),
            request.IsActive.GetValueOrDefault());
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        var actorId = await repository.ResolveActorIdAsync(
            connection, transaction, actorPublicId, cancellationToken);
        if (actorId is null) return await Rollback(
            transaction, new(UserWriteStatus.ActorMissing), cancellationToken);
        try
        {
            var publicId = await repository.CreateAsync(
                connection, transaction, command, actorId.Value, cancellationToken);
            await repository.AssignRoleAsync(connection, transaction, publicId,
                actorId.Value, cancellationToken);
            var user = await repository.GetForUpdateAsync(
                connection, transaction, publicId, cancellationToken);
            await auditWriter.WriteAsync(connection, transaction,
                Audit(actorPublicId, "identity.users.created", publicId, traceId,
                    [new("username", null, username), new("role", null, "User"),
                     new("is_active", null, command.IsActive.ToString())]),
                cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return new(UserWriteStatus.Success, user);
        }
        catch (PostgresException exception) when (
            exception.ConstraintName == "uq_users_username_ci")
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(UserWriteStatus.DuplicateUsername);
        }
    }

    public async Task<UserWriteResult> SetActiveAsync(
        Guid publicId, bool isActive, Guid actorPublicId, string traceId,
        CancellationToken cancellationToken)
    {
        if (!isActive && publicId == actorPublicId)
            return new(UserWriteStatus.SelfDeactivationForbidden);

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        var user = await repository.GetForUpdateAsync(
            connection, transaction, publicId, cancellationToken);
        if (user is null) return await Rollback(
            transaction, new(UserWriteStatus.NotFound), cancellationToken);
        if (user.IsActive == isActive) return await Rollback(
            transaction, new(UserWriteStatus.Success, user), cancellationToken);
        var actorId = await repository.ResolveActorIdAsync(
            connection, transaction, actorPublicId, cancellationToken);
        if (actorId is null) return await Rollback(
            transaction, new(UserWriteStatus.ActorMissing), cancellationToken);
        await repository.SetActiveAsync(connection, transaction, publicId,
            isActive, actorId.Value, cancellationToken);
        var updated = await repository.GetForUpdateAsync(
            connection, transaction, publicId, cancellationToken);
        await auditWriter.WriteAsync(connection, transaction,
            Audit(actorPublicId, isActive ? "identity.users.activated" : "identity.users.deactivated",
                publicId, traceId,
                [new("is_active", user.IsActive.ToString(), isActive.ToString())]),
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new(UserWriteStatus.Success, updated);
    }

    private static string Required(string? value, string field, int max,
        Dictionary<string, string[]> errors)
    {
        var normalized = value?.Trim() ?? "";
        if (normalized.Length == 0) errors[field] = ["The field is required."];
        else if (normalized.Length > max)
            errors[field] = [$"The field must not exceed {max} characters."];
        return normalized;
    }

    private static async Task<UserWriteResult> Rollback(
        NpgsqlTransaction transaction, UserWriteResult result, CancellationToken token)
    {
        await transaction.RollbackAsync(token);
        return result;
    }

    private static AuditEntry Audit(Guid actor, string action, Guid target,
        string trace, IReadOnlyCollection<AuditChange> changes) =>
        new(actor, "identity", action, "user", target, trace, changes);
}
