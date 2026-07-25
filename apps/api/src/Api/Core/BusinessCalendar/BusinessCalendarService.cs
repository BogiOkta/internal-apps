using InternalApps.Api.Infrastructure.Auditing;
using Npgsql;

namespace InternalApps.Api.Core.BusinessCalendar;

internal sealed class BusinessCalendarService
{
    private const int NameMaxLength = 200;
    private const int DescriptionMaxLength = 1000;
    private readonly INonWorkingDayStore store;

    public BusinessCalendarService(INonWorkingDayStore store) => this.store = store;

    public async Task<bool> IsWorkingDay(
        DateOnly date, CancellationToken cancellationToken = default) =>
        !IsWeekend(date) && !await store.ExistsAsync(date, cancellationToken);

    public async Task<int> WorkingDaysBetween(
        DateOnly from, DateOnly to, CancellationToken cancellationToken = default)
    {
        if (from > to)
            throw new ArgumentOutOfRangeException(
                nameof(to), "The end date cannot precede the start date.");

        var holidays = await store.GetDatesAsync(from, to, cancellationToken);
        var count = 0;
        for (var date = from; date <= to; date = date.AddDays(1))
        {
            if (!IsWeekend(date) && !holidays.Contains(date)) count++;
        }
        return count;
    }

    private static bool IsWeekend(DateOnly date) =>
        date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;

    internal static bool TryNormalize(
        DateOnly? date, string? name, string? description,
        out SaveNonWorkingDayCommand command,
        out Dictionary<string, string[]> errors)
    {
        errors = [];
        if (date is null) errors["date"] = ["The field is required."];
        var normalizedName = name?.Trim() ?? "";
        if (normalizedName.Length == 0) errors["name"] = ["The field is required."];
        else if (normalizedName.Length > NameMaxLength)
            errors["name"] = [$"The field must not exceed {NameMaxLength} characters."];
        var normalizedDescription = string.IsNullOrWhiteSpace(description)
            ? null : description.Trim();
        if (normalizedDescription?.Length > DescriptionMaxLength)
            errors["description"] =
                [$"The field must not exceed {DescriptionMaxLength} characters."];
        command = new(date.GetValueOrDefault(), normalizedName, normalizedDescription);
        return errors.Count == 0;
    }
}

internal sealed class NonWorkingDaysService(
    NpgsqlDataSource dataSource,
    BusinessCalendarRepository repository,
    AuditWriter auditWriter)
{
    public async Task<IReadOnlyList<NonWorkingDayResponse>> ListAsync(
        int? year, CancellationToken token) =>
        (await repository.ListAsync(year, token)).Select(ToResponse).ToArray();

    public async Task<NonWorkingDayResponse?> GetAsync(
        Guid publicId, CancellationToken token)
    {
        var record = await repository.GetAsync(publicId, token);
        return record is null ? null : ToResponse(record);
    }

    public Task<NonWorkingDayWriteResult> CreateAsync(
        CreateNonWorkingDayRequest request, Guid actor, string traceId,
        CancellationToken token) =>
        SaveAsync(null, request.Date, request.Name, request.Description,
            actor, traceId, token);

    public Task<NonWorkingDayWriteResult> UpdateAsync(
        Guid publicId, UpdateNonWorkingDayRequest request, Guid actor,
        string traceId, CancellationToken token) =>
        SaveAsync(publicId, request.Date, request.Name, request.Description,
            actor, traceId, token);

    public async Task<NonWorkingDayWriteResult> DeleteAsync(
        Guid publicId, Guid actor, string traceId, CancellationToken token)
    {
        await using var connection = await dataSource.OpenConnectionAsync(token);
        await using var transaction = await connection.BeginTransactionAsync(token);
        var previous = await repository.GetForUpdateAsync(
            connection, transaction, publicId, token);
        if (previous is null)
            return await Rollback(transaction,
                new(NonWorkingDayWriteStatus.NotFound), token);
        if (await repository.ResolveActorIdAsync(connection, transaction, actor, token) is null)
            return await Rollback(transaction,
                new(NonWorkingDayWriteStatus.ActorMissing), token);
        await repository.DeleteAsync(connection, transaction, publicId, token);
        await auditWriter.WriteAsync(connection, transaction,
            Audit(actor, "core.business-calendar.non-working-days.deleted",
                publicId, traceId, [new("date", previous.Date.ToString("yyyy-MM-dd"), null)]),
            token);
        await transaction.CommitAsync(token);
        return new(NonWorkingDayWriteStatus.Success);
    }

    private async Task<NonWorkingDayWriteResult> SaveAsync(
        Guid? publicId, DateOnly? date, string? name, string? description,
        Guid actor, string traceId, CancellationToken token)
    {
        if (!BusinessCalendarService.TryNormalize(
                date, name, description, out var command, out var errors))
            return new(NonWorkingDayWriteStatus.ValidationFailed, Errors: errors);

        await using var connection = await dataSource.OpenConnectionAsync(token);
        await using var transaction = await connection.BeginTransactionAsync(token);
        NonWorkingDayRecord? previous = null;
        if (publicId is not null)
        {
            previous = await repository.GetForUpdateAsync(
                connection, transaction, publicId.Value, token);
            if (previous is null)
                return await Rollback(transaction,
                    new(NonWorkingDayWriteStatus.NotFound), token);
        }
        var actorId = await repository.ResolveActorIdAsync(
            connection, transaction, actor, token);
        if (actorId is null)
            return await Rollback(transaction,
                new(NonWorkingDayWriteStatus.ActorMissing), token);
        try
        {
            var saved = publicId is null
                ? await repository.CreateAsync(
                    connection, transaction, command, actorId.Value, token)
                : await repository.UpdateAsync(
                    connection, transaction, publicId.Value, command, actorId.Value, token);
            await auditWriter.WriteAsync(connection, transaction,
                Audit(actor,
                    publicId is null
                        ? "core.business-calendar.non-working-days.created"
                        : "core.business-calendar.non-working-days.updated",
                    saved.PublicId, traceId,
                    [new("date", previous?.Date.ToString("yyyy-MM-dd"),
                        saved.Date.ToString("yyyy-MM-dd")),
                     new("name", previous?.Name, saved.Name)]),
                token);
            await transaction.CommitAsync(token);
            return new(NonWorkingDayWriteStatus.Success, ToResponse(saved));
        }
        catch (PostgresException exception) when (
            exception.SqlState == PostgresErrorCodes.UniqueViolation &&
            exception.ConstraintName == "uq_non_working_days_date")
        {
            await transaction.RollbackAsync(token);
            return new(NonWorkingDayWriteStatus.DuplicateDate);
        }
    }

    private static NonWorkingDayResponse ToResponse(NonWorkingDayRecord record) =>
        new(record.PublicId, record.Date, record.Name, record.Description,
            record.CreatedAt, record.CreatedBy, record.UpdatedAt, record.UpdatedBy);

    private static AuditEntry Audit(
        Guid actor, string action, Guid target, string traceId,
        IReadOnlyCollection<AuditChange> changes) =>
        new(actor, "core", action, "non_working_day", target, traceId, changes);

    private static async Task<NonWorkingDayWriteResult> Rollback(
        NpgsqlTransaction transaction, NonWorkingDayWriteResult result,
        CancellationToken token)
    {
        await transaction.RollbackAsync(token);
        return result;
    }
}
