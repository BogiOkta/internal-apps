using Dapper;
using Npgsql;

namespace InternalApps.Api.Modules.Identity;

internal sealed class UsersRepository(NpgsqlDataSource dataSource)
{
    private sealed class UserPersistenceRow
    {
        public Guid PublicId { get; init; }
        public string Username { get; init; } = "";
        public string DisplayName { get; init; } = "";
        public bool IsActive { get; init; }
        public Array? Roles { get; init; }
        public DateTimeOffset CreatedAt { get; init; }
        public DateTimeOffset UpdatedAt { get; init; }
    }

    private const string Projection = """
        SELECT users.public_id AS PublicId, users.username AS Username,
               users.display_name AS DisplayName, users.is_active AS IsActive,
               COALESCE(array_agg(DISTINCT roles.name ORDER BY roles.name)
                   FILTER (WHERE roles.name IS NOT NULL), ARRAY[]::text[])::text[] AS Roles,
               users.created_at AS CreatedAt, users.updated_at AS UpdatedAt
        FROM identity.users
        LEFT JOIN identity.user_roles ON user_roles.user_id = users.id
        LEFT JOIN identity.roles ON roles.id = user_roles.role_id
        """;

    public async Task<IReadOnlyList<UserResponse>> ListAsync(
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync<UserPersistenceRow>(new CommandDefinition(
            Projection + " GROUP BY users.id ORDER BY users.username, users.public_id",
            cancellationToken: cancellationToken));
        return rows.Select(ToResponse).ToArray();
    }

    public async Task<long?> ResolveActorIdAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, Guid publicId,
        CancellationToken cancellationToken) =>
        await connection.QuerySingleOrDefaultAsync<long?>(new CommandDefinition(
            "SELECT id FROM identity.users WHERE public_id = @PublicId",
            new { PublicId = publicId }, transaction,
            cancellationToken: cancellationToken));

    public async Task<Guid> CreateAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        CreateUserCommand command, long actorId, CancellationToken cancellationToken) =>
        await connection.ExecuteScalarAsync<Guid>(new CommandDefinition(
            """
            INSERT INTO identity.users
                (public_id, username, display_name, password_hash, is_active,
                 created_by, updated_by)
            VALUES
                (gen_random_uuid(), @Username, @DisplayName, @PasswordHash, @IsActive,
                 @ActorId, @ActorId)
            RETURNING public_id
            """,
            new { command.Username, command.DisplayName, command.PasswordHash,
                command.IsActive, ActorId = actorId },
            transaction, cancellationToken: cancellationToken));

    public async Task AssignRoleAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, Guid userPublicId,
        long actorId, CancellationToken cancellationToken) =>
        await connection.ExecuteAsync(new CommandDefinition(
            "SELECT identity.assign_base_user_role(@UserPublicId, @ActorId)",
            new { UserPublicId = userPublicId, ActorId = actorId },
            transaction, cancellationToken: cancellationToken));

    public async Task<UserResponse?> GetForUpdateAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, Guid publicId,
        CancellationToken cancellationToken)
    {
        var exists = await connection.QuerySingleOrDefaultAsync<long?>(
            new CommandDefinition(
                "SELECT id FROM identity.users WHERE public_id = @PublicId FOR UPDATE",
                new { PublicId = publicId }, transaction,
                cancellationToken: cancellationToken));
        if (exists is null) return null;
        var row = await connection.QuerySingleAsync<UserPersistenceRow>(new CommandDefinition(
            Projection + " WHERE users.public_id = @PublicId GROUP BY users.id",
            new { PublicId = publicId }, transaction,
            cancellationToken: cancellationToken));
        return ToResponse(row);
    }

    public async Task SetActiveAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, Guid publicId,
        bool isActive, long actorId, CancellationToken cancellationToken) =>
        await connection.ExecuteAsync(new CommandDefinition(
            """
            UPDATE identity.users
            SET is_active = @IsActive, updated_at = now(), updated_by = @ActorId
            WHERE public_id = @PublicId
            """,
            new { PublicId = publicId, IsActive = isActive, ActorId = actorId },
            transaction, cancellationToken: cancellationToken));

    private static UserResponse ToResponse(UserPersistenceRow row) =>
        new(row.PublicId, row.Username, row.DisplayName, row.IsActive,
            row.Roles?.Cast<string>().ToArray() ?? [], row.CreatedAt, row.UpdatedAt);
}
