using Dapper;
using Npgsql;

namespace InternalApps.Api.Core.BusinessCalendar;

internal interface INonWorkingDayStore
{
    Task<bool> ExistsAsync(DateOnly date, CancellationToken cancellationToken);
    Task<IReadOnlySet<DateOnly>> GetDatesAsync(
        DateOnly from, DateOnly to, CancellationToken cancellationToken);
}

internal sealed class BusinessCalendarRepository(NpgsqlDataSource dataSource)
    : INonWorkingDayStore
{
    private const string Projection = """
        days.public_id AS PublicId,
        days.date AS Date,
        days.name AS Name,
        days.description AS Description,
        days.created_at AS CreatedAt,
        creators.public_id AS CreatedBy,
        days.updated_at AS UpdatedAt,
        updaters.public_id AS UpdatedBy
        """;

    public async Task<IReadOnlyList<NonWorkingDayRecord>> ListAsync(
        int? year, CancellationToken cancellationToken)
    {
        var sql = $"""
            SELECT {Projection}
            FROM core.non_working_days AS days
            INNER JOIN identity.users AS creators ON creators.id = days.created_by
            INNER JOIN identity.users AS updaters ON updaters.id = days.updated_by
            WHERE @Year IS NULL OR EXTRACT(YEAR FROM days.date) = @Year
            ORDER BY days.date, days.public_id
            """;
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync<NonWorkingDayRecord>(
            new CommandDefinition(sql, new { Year = year },
                cancellationToken: cancellationToken));
        return rows.AsList();
    }

    public async Task<NonWorkingDayRecord?> GetAsync(
        Guid publicId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        return await GetAsync(connection, null, publicId, false, cancellationToken);
    }

    public async Task<bool> ExistsAsync(
        DateOnly date, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        return await connection.ExecuteScalarAsync<bool>(new CommandDefinition(
            "SELECT EXISTS (SELECT 1 FROM core.non_working_days WHERE date = @Date)",
            new { Date = date }, cancellationToken: cancellationToken));
    }

    public async Task<IReadOnlySet<DateOnly>> GetDatesAsync(
        DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var dates = await connection.QueryAsync<DateOnly>(new CommandDefinition(
            """
            SELECT date
            FROM core.non_working_days
            WHERE date BETWEEN @From AND @To
            """,
            new { From = from, To = to }, cancellationToken: cancellationToken));
        return dates.ToHashSet();
    }

    public Task<long?> ResolveActorIdAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        Guid actorPublicId, CancellationToken cancellationToken) =>
        connection.QuerySingleOrDefaultAsync<long?>(new CommandDefinition(
            "SELECT id FROM identity.users WHERE public_id = @ActorPublicId",
            new { ActorPublicId = actorPublicId }, transaction,
            cancellationToken: cancellationToken));

    public Task<NonWorkingDayRecord?> GetForUpdateAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        Guid publicId, CancellationToken cancellationToken) =>
        GetAsync(connection, transaction, publicId, true, cancellationToken);

    public async Task<NonWorkingDayRecord> CreateAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        SaveNonWorkingDayCommand command, long actorId,
        CancellationToken cancellationToken)
    {
        var publicId = await connection.ExecuteScalarAsync<Guid>(new CommandDefinition(
            """
            INSERT INTO core.non_working_days
                (public_id, date, name, description, created_by, updated_by)
            VALUES
                (gen_random_uuid(), @Date, @Name, @Description, @ActorId, @ActorId)
            RETURNING public_id
            """,
            new { command.Date, command.Name, command.Description, ActorId = actorId },
            transaction, cancellationToken: cancellationToken));
        return (await GetAsync(connection, transaction, publicId, false, cancellationToken))!;
    }

    public async Task<NonWorkingDayRecord> UpdateAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        Guid publicId, SaveNonWorkingDayCommand command, long actorId,
        CancellationToken cancellationToken)
    {
        await connection.ExecuteAsync(new CommandDefinition(
            """
            UPDATE core.non_working_days
            SET date = @Date, name = @Name, description = @Description,
                updated_at = now(), updated_by = @ActorId
            WHERE public_id = @PublicId
            """,
            new { PublicId = publicId, command.Date, command.Name,
                command.Description, ActorId = actorId },
            transaction, cancellationToken: cancellationToken));
        return (await GetAsync(connection, transaction, publicId, false, cancellationToken))!;
    }

    public Task DeleteAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        Guid publicId, CancellationToken cancellationToken) =>
        connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM core.non_working_days WHERE public_id = @PublicId",
            new { PublicId = publicId }, transaction,
            cancellationToken: cancellationToken));

    private static Task<NonWorkingDayRecord?> GetAsync(
        NpgsqlConnection connection, NpgsqlTransaction? transaction,
        Guid publicId, bool forUpdate, CancellationToken cancellationToken)
    {
        var sql = $"""
            SELECT {Projection}
            FROM core.non_working_days AS days
            INNER JOIN identity.users AS creators ON creators.id = days.created_by
            INNER JOIN identity.users AS updaters ON updaters.id = days.updated_by
            WHERE days.public_id = @PublicId
            {(forUpdate ? "FOR UPDATE OF days" : "")}
            """;
        return connection.QuerySingleOrDefaultAsync<NonWorkingDayRecord>(
            new CommandDefinition(sql, new { PublicId = publicId }, transaction,
                cancellationToken: cancellationToken));
    }
}
