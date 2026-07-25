using InternalApps.Api.Infrastructure.Auditing;
using Npgsql;

namespace InternalApps.Api.Modules.Vacation;

internal sealed class LeavePoliciesService(
    NpgsqlDataSource dataSource,
    LeavePoliciesRepository repository,
    AuditWriter auditWriter)
{
    private const int NotesMaxLength = 1000;

    public async Task<IReadOnlyList<LeavePolicyResponse>> ListAsync(
        int? year, Guid? employee, CancellationToken token) =>
        (await repository.ListAsync(year, employee, token)).Select(ToResponse).ToArray();

    public async Task<LeavePolicyResponse?> GetAsync(Guid id, CancellationToken token)
    {
        var record = await repository.GetAsync(id, token);
        return record is null ? null : ToResponse(record);
    }

    public Task<LeavePolicyWriteResult> CreateAsync(
        SaveLeavePolicyRequest request, Guid actor, string traceId, CancellationToken token) =>
        SaveAsync(null, request, actor, traceId, token);

    public Task<LeavePolicyWriteResult> UpdateAsync(
        Guid id, SaveLeavePolicyRequest request, Guid actor, string traceId,
        CancellationToken token) => SaveAsync(id, request, actor, traceId, token);

    public async Task<LeavePolicyWriteResult> DeleteAsync(
        Guid id, Guid actor, string traceId, CancellationToken token)
    {
        await using var connection = await dataSource.OpenConnectionAsync(token);
        await using var transaction = await connection.BeginTransactionAsync(token);
        var previous = await repository.GetForUpdateAsync(connection, transaction, id, token);
        if (previous is null)
        {
            await transaction.RollbackAsync(token);
            return new(LeavePolicyWriteStatus.NotFound);
        }
        await repository.DeleteAsync(connection, transaction, id, token);
        await auditWriter.WriteAsync(connection, transaction,
            Audit(actor, "vacation.leave-policies.deleted", id, traceId), token);
        await transaction.CommitAsync(token);
        return new(LeavePolicyWriteStatus.Success);
    }

    private async Task<LeavePolicyWriteResult> SaveAsync(
        Guid? id, SaveLeavePolicyRequest request, Guid actor, string traceId,
        CancellationToken token)
    {
        if (!TryNormalize(request, out var command, out var errors))
            return new(LeavePolicyWriteStatus.ValidationFailed, Errors: errors);
        await using var connection = await dataSource.OpenConnectionAsync(token);
        await using var transaction = await connection.BeginTransactionAsync(token);
        if (id is not null &&
            await repository.GetForUpdateAsync(connection, transaction, id.Value, token) is null)
        {
            await transaction.RollbackAsync(token);
            return new(LeavePolicyWriteStatus.NotFound);
        }
        var employeeId = await repository.ResolveEmployeeIdAsync(
            connection, transaction, command.EmployeeId, token);
        if (employeeId is null)
        {
            await transaction.RollbackAsync(token);
            return new(LeavePolicyWriteStatus.EmployeeNotFound);
        }
        try
        {
            var saved = id is null
                ? await repository.CreateAsync(connection, transaction, command,
                    employeeId.Value, token)
                : await repository.UpdateAsync(connection, transaction, id.Value, command,
                    employeeId.Value, token);
            await auditWriter.WriteAsync(connection, transaction,
                Audit(actor, id is null ? "vacation.leave-policies.created"
                    : "vacation.leave-policies.updated", saved.PublicId, traceId), token);
            await transaction.CommitAsync(token);
            return new(LeavePolicyWriteStatus.Success, ToResponse(saved));
        }
        catch (PostgresException exception) when (
            exception.SqlState == PostgresErrorCodes.UniqueViolation &&
            exception.ConstraintName == "uq_vacation_leave_policies_employee_year")
        {
            await transaction.RollbackAsync(token);
            return new(LeavePolicyWriteStatus.DuplicateEmployeeYear);
        }
    }

    internal static bool TryNormalize(SaveLeavePolicyRequest request,
        out SaveLeavePolicyCommand command, out Dictionary<string, string[]> errors)
    {
        errors = [];
        if (request.EmployeeId is null || request.EmployeeId == Guid.Empty)
            errors["employeeId"] = ["The field is required."];
        if (request.LeaveYear is null)
            errors["leaveYear"] = ["The field is required."];
        else if (request.LeaveYear is < 1900 or > 9999)
            errors["leaveYear"] = ["Year must be between 1900 and 9999."];
        if (request.AnnualEntitlementDays is null)
            errors["annualEntitlementDays"] = ["The field is required."];
        else if (request.AnnualEntitlementDays < 0)
            errors["annualEntitlementDays"] = ["The value must be zero or greater."];
        if (request.CarryOverDays is null)
            errors["carryOverDays"] = ["The field is required."];
        else if (request.CarryOverDays < 0)
            errors["carryOverDays"] = ["The value must be zero or greater."];
        if (request.ManualAdjustmentDays is null)
            errors["manualAdjustmentDays"] = ["The field is required."];
        var notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        if (notes?.Length > NotesMaxLength)
            errors["notes"] = [$"The field must not exceed {NotesMaxLength} characters."];
        command = new(request.EmployeeId.GetValueOrDefault(),
            request.LeaveYear.GetValueOrDefault(),
            request.AnnualEntitlementDays.GetValueOrDefault(),
            request.CarryOverDays.GetValueOrDefault(),
            request.CarryOverExpirationDate,
            request.ManualAdjustmentDays.GetValueOrDefault(), notes);
        return errors.Count == 0;
    }

    private static LeavePolicyResponse ToResponse(LeavePolicyRecord record) =>
        new(record.PublicId, record.EmployeeId, record.EmployeeNumber,
            record.EmployeeName, record.LeaveYear, record.AnnualEntitlementDays,
            record.CarryOverDays, record.CarryOverExpirationDate,
            record.ManualAdjustmentDays, record.Notes,
            new DateTimeOffset(record.CreatedAt), new DateTimeOffset(record.UpdatedAt));

    private static AuditEntry Audit(
        Guid actor, string action, Guid target, string traceId) =>
        new(actor, "vacation", action, "leave_policy", target, traceId, []);
}
