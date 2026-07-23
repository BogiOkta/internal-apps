using Dapper;
using Npgsql;

namespace InternalApps.Api.Authentication;

internal sealed class AuthRepository(NpgsqlDataSource dataSource)
{
    private const string UserProjection = """
        SELECT
            users.id AS Id,
            users.public_id AS PublicId,
            users.username AS Username,
            users.display_name AS DisplayName,
            users.password_hash AS PasswordHash,
            COALESCE(
                array_agg(DISTINCT roles.name) FILTER (WHERE roles.name IS NOT NULL),
                ARRAY[]::text[]
            ) AS Roles,
            COALESCE(
                array_agg(DISTINCT permissions.code) FILTER (WHERE permissions.code IS NOT NULL),
                ARRAY[]::text[]
            ) AS Permissions
        FROM identity.users AS users
        LEFT JOIN identity.user_roles AS user_roles
            ON user_roles.user_id = users.id
        LEFT JOIN identity.roles AS roles
            ON roles.id = user_roles.role_id
        LEFT JOIN identity.role_permissions AS role_permissions
            ON role_permissions.role_id = roles.id
        LEFT JOIN identity.permissions AS permissions
            ON permissions.id = role_permissions.permission_id
        """;

    public async Task<AuthUser?> FindByUsernameAsync(
        string username,
        CancellationToken cancellationToken)
    {
        var sql = UserProjection + """

            WHERE lower(users.username) = lower(@Username)
              AND users.is_active = true
            GROUP BY users.id
            """;

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync<AuthUserRow>(
            new CommandDefinition(sql, new { Username = username }, cancellationToken: cancellationToken));

        return MapAuthUser(row);
    }

    public async Task<AuthUser?> FindByPublicIdAsync(
        Guid publicId,
        CancellationToken cancellationToken)
    {
        var sql = UserProjection + """

            WHERE users.public_id = @PublicId
              AND users.is_active = true
            GROUP BY users.id
            """;

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync<AuthUserRow>(
            new CommandDefinition(sql, new { PublicId = publicId }, cancellationToken: cancellationToken));

        return MapAuthUser(row);
    }

    public async Task<AuthUser?> FindByRefreshTokenAsync(
        string refreshTokenHash,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var sql = UserProjection + """

            INNER JOIN identity.refresh_tokens AS refresh_tokens
                ON refresh_tokens.user_id = users.id
            WHERE refresh_tokens.token_hash = @RefreshTokenHash
              AND refresh_tokens.expires_at > @Now
              AND refresh_tokens.revoked_at IS NULL
              AND users.is_active = true
            GROUP BY users.id
            """;

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync<AuthUserRow>(
            new CommandDefinition(
                sql,
                new { RefreshTokenHash = refreshTokenHash, Now = now },
                cancellationToken: cancellationToken));

        return MapAuthUser(row);
    }

    public async Task InsertRefreshTokenAsync(
        long userId,
        string refreshTokenHash,
        DateTimeOffset expiresAt,
        CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO identity.refresh_tokens (
                user_id,
                token_hash,
                expires_at,
                created_by,
                updated_by
            )
            VALUES (
                @UserId,
                @RefreshTokenHash,
                @ExpiresAt,
                @UserId,
                @UserId
            )
            """;

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await connection.ExecuteAsync(
            new CommandDefinition(
                sql,
                new { UserId = userId, RefreshTokenHash = refreshTokenHash, ExpiresAt = expiresAt },
                cancellationToken: cancellationToken));
    }

    public async Task<bool> RotateRefreshTokenAsync(
        string currentTokenHash,
        string replacementTokenHash,
        DateTimeOffset replacementExpiresAt,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        const string revokeSql = """
            UPDATE identity.refresh_tokens
            SET revoked_at = @Now,
                replaced_by_token_hash = @ReplacementTokenHash,
                updated_at = @Now,
                updated_by = user_id
            WHERE token_hash = @CurrentTokenHash
              AND revoked_at IS NULL
              AND expires_at > @Now
            RETURNING user_id
            """;
        const string insertSql = """
            INSERT INTO identity.refresh_tokens (
                user_id,
                token_hash,
                expires_at,
                created_by,
                updated_by
            )
            VALUES (
                @UserId,
                @ReplacementTokenHash,
                @ReplacementExpiresAt,
                @UserId,
                @UserId
            )
            """;

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        var userId = await connection.QuerySingleOrDefaultAsync<long?>(
            new CommandDefinition(
                revokeSql,
                new
                {
                    CurrentTokenHash = currentTokenHash,
                    ReplacementTokenHash = replacementTokenHash,
                    Now = now
                },
                transaction,
                cancellationToken: cancellationToken));

        if (userId is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return false;
        }

        await connection.ExecuteAsync(
            new CommandDefinition(
                insertSql,
                new
                {
                    UserId = userId.Value,
                    ReplacementTokenHash = replacementTokenHash,
                    ReplacementExpiresAt = replacementExpiresAt
                },
                transaction,
                cancellationToken: cancellationToken));

        await transaction.CommitAsync(cancellationToken);
        return true;
    }

    public async Task RevokeRefreshTokenAsync(
        string refreshTokenHash,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE identity.refresh_tokens
            SET revoked_at = @Now,
                updated_at = @Now,
                updated_by = user_id
            WHERE token_hash = @RefreshTokenHash
              AND revoked_at IS NULL
            """;

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await connection.ExecuteAsync(
            new CommandDefinition(
                sql,
                new { RefreshTokenHash = refreshTokenHash, Now = now },
                cancellationToken: cancellationToken));
    }

    private static AuthUser? MapAuthUser(AuthUserRow? row)
    {
        if (row is null)
        {
            return null;
        }

        return new AuthUser(
            row.Id,
            row.PublicId,
            row.Username,
            row.DisplayName,
            row.PasswordHash,
            row.Roles ?? Array.Empty<string>(),
            row.Permissions ?? Array.Empty<string>());
    }

    private sealed class AuthUserRow
    {
        public long Id { get; set; }

        public Guid PublicId { get; set; }

        public string Username { get; set; } = string.Empty;

        public string DisplayName { get; set; } = string.Empty;

        public string PasswordHash { get; set; } = string.Empty;

        public string[]? Roles { get; set; }

        public string[]? Permissions { get; set; }
    }
}
