using Dapper;
using Npgsql;

namespace InternalApps.Api.Infrastructure.Auditing;

internal sealed record AuditChange(
    string FieldName,
    string? PreviousValue,
    string? NewValue);

internal sealed record AuditEntry(
    Guid ActorUserPublicId,
    string Module,
    string Action,
    string TargetType,
    Guid TargetPublicId,
    string TraceId,
    IReadOnlyCollection<AuditChange> Changes);

internal sealed class AuditWriter
{
    public async Task WriteAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        AuditEntry entry,
        CancellationToken cancellationToken)
    {
        const string eventSql = """
            INSERT INTO audit.audit_events (
                public_id,
                actor_user_public_id,
                module,
                action,
                target_type,
                target_public_id,
                outcome,
                trace_id
            )
            VALUES (
                @PublicId,
                @ActorUserPublicId,
                @Module,
                @Action,
                @TargetType,
                @TargetPublicId,
                'success',
                @TraceId
            )
            """;
        const string detailSql = """
            INSERT INTO audit.audit_details (
                public_id,
                audit_event_public_id,
                field_name,
                previous_value,
                new_value
            )
            VALUES (
                @PublicId,
                @AuditEventPublicId,
                @FieldName,
                @PreviousValue,
                @NewValue
            )
            """;

        var eventPublicId = Guid.NewGuid();
        await connection.ExecuteAsync(
            new CommandDefinition(
                eventSql,
                new
                {
                    PublicId = eventPublicId,
                    entry.ActorUserPublicId,
                    entry.Module,
                    entry.Action,
                    entry.TargetType,
                    entry.TargetPublicId,
                    entry.TraceId
                },
                transaction,
                cancellationToken: cancellationToken));

        foreach (var change in entry.Changes)
        {
            await connection.ExecuteAsync(
                new CommandDefinition(
                    detailSql,
                    new
                    {
                        PublicId = Guid.NewGuid(),
                        AuditEventPublicId = eventPublicId,
                        change.FieldName,
                        change.PreviousValue,
                        change.NewValue
                    },
                    transaction,
                    cancellationToken: cancellationToken));
        }
    }
}
