using Dapper;
using Npgsql;

namespace InternalApps.Api.Applications;

internal sealed class ApplicationRepository(NpgsqlDataSource dataSource)
{
    public async Task<IReadOnlyList<ApplicationResponse>> ListForUserAsync(
        Guid userPublicId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                applications.public_id AS PublicId,
                applications.code AS Code,
                applications.name AS Name,
                applications.description AS Description,
                applications.route AS Route
            FROM core.applications AS applications
            INNER JOIN identity.user_applications AS user_applications
                ON user_applications.application_id = applications.id
            INNER JOIN identity.users AS users
                ON users.id = user_applications.user_id
            WHERE users.public_id = @UserPublicId
              AND users.is_active = true
              AND applications.is_active = true
            ORDER BY applications.sort_order, applications.name
            """;

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync<ApplicationRow>(
            new CommandDefinition(
                sql,
                new { UserPublicId = userPublicId },
                cancellationToken: cancellationToken));

        return rows
            .Select(row => new ApplicationResponse(
                row.PublicId,
                row.Code,
                row.Name,
                row.Description,
                row.Route))
            .ToArray();
    }

    private sealed class ApplicationRow
    {
        public Guid PublicId { get; set; }

        public string Code { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        public string Route { get; set; } = string.Empty;
    }
}
