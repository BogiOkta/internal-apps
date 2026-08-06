using InternalApps.Api.Infrastructure.Auditing;
using Npgsql;

namespace InternalApps.Api.Modules.Vacation;

internal sealed class LeaveBalanceLedgerService(NpgsqlDataSource dataSource,
    LeaveBalanceLedgerRepository repository, AuditWriter auditWriter)
{
    private const int ReasonMaxLength = 200;
    private const int ExplanationMaxLength = 1000;
    private const int SourceMaxLength = 100;

    public Task<LeaveBalanceLedgerWriteResult> PostEntitlementAsync(PostLeaveBalanceEntryRequest request, Guid actor, string traceId, CancellationToken token) => PostAsync(request, "annual_entitlement", true, actor, traceId, token);
    public Task<LeaveBalanceLedgerWriteResult> PostCarryOverAsync(PostLeaveBalanceEntryRequest request, Guid actor, string traceId, CancellationToken token) => PostAsync(request, "carry_over", true, actor, traceId, token);
    public Task<LeaveBalanceLedgerWriteResult> PostManualAdjustmentAsync(PostLeaveBalanceEntryRequest request, Guid actor, string traceId, CancellationToken token) => PostAsync(request, "manual_adjustment", false, actor, traceId, token);
    public async Task<LeaveBalanceLedgerResponse?> GetBalanceAsync(Guid employeeId, Guid leaveTypeId, int year, CancellationToken token) => await repository.GetBalanceAsync(employeeId, leaveTypeId, year, token);
    public async Task<IReadOnlyList<LeaveBalanceEntryResponse>> ListHistoryAsync(Guid employeeId, Guid leaveTypeId, int year, CancellationToken token) => (await repository.ListHistoryAsync(employeeId, leaveTypeId, year, token)).Select(ToResponse).ToArray();

    public async Task<IReadOnlyList<LeaveBalanceScopeResponse>> ListScopesAsync(
        Guid? employeeId, Guid? leaveTypeId, int? year, string? search,
        string? acceptLanguage, CancellationToken token)
    {
        var englishNames = ResolveEnglishNames(acceptLanguage);
        var records = await repository.ListScopesAsync(
            employeeId, leaveTypeId, year, search, englishNames, token);
        return records.Select(ToScopeResponse).ToArray();
    }

    internal static bool TryNormalize(PostLeaveBalanceEntryRequest request, bool mustBePositive, out PostLeaveBalanceEntryCommand command, out Dictionary<string, string[]> errors)
    {
        errors = [];
        if (request.EmployeeId is null || request.EmployeeId == Guid.Empty) errors["employeeId"] = ["The field is required."];
        if (request.LeaveTypeId is null || request.LeaveTypeId == Guid.Empty) errors["leaveTypeId"] = ["The field is required."];
        if (request.LeaveYear is null) errors["leaveYear"] = ["The field is required."];
        else if (request.LeaveYear is < 1900 or > 9999) errors["leaveYear"] = ["Year must be between 1900 and 9999."];
        if (request.QuantityDays is null) errors["quantityDays"] = ["The field is required."];
        else if (request.QuantityDays == 0 || request.QuantityDays * 2 != decimal.Truncate(request.QuantityDays.Value * 2)) errors["quantityDays"] = ["The value must be non-zero and in half-day increments."];
        else if (mustBePositive && request.QuantityDays < 0) errors["quantityDays"] = ["The value must be greater than zero."];
        if (request.EffectiveDate is null) errors["effectiveDate"] = ["The field is required."];
        else if (request.LeaveYear is not null && request.EffectiveDate.Value.Year != request.LeaveYear) errors["effectiveDate"] = ["The effective date must be in the leave year."];
        var reason = request.Reason?.Trim(); var explanation = string.IsNullOrWhiteSpace(request.Explanation) ? null : request.Explanation.Trim(); var source = request.SourceReference?.Trim();
        if (string.IsNullOrEmpty(reason)) errors["reason"] = ["The field is required."]; else if (reason.Length > ReasonMaxLength) errors["reason"] = [$"The field must not exceed {ReasonMaxLength} characters."];
        if (explanation?.Length > ExplanationMaxLength) errors["explanation"] = [$"The field must not exceed {ExplanationMaxLength} characters."];
        if (string.IsNullOrEmpty(source)) errors["sourceReference"] = ["The field is required."]; else if (source.Length > SourceMaxLength) errors["sourceReference"] = [$"The field must not exceed {SourceMaxLength} characters."];
        command = new(request.EmployeeId.GetValueOrDefault(), request.LeaveTypeId.GetValueOrDefault(), request.LeaveYear.GetValueOrDefault(), request.QuantityDays.GetValueOrDefault(), request.EffectiveDate.GetValueOrDefault(), reason ?? "", explanation, source ?? "");
        return errors.Count == 0;
    }

    private async Task<LeaveBalanceLedgerWriteResult> PostAsync(PostLeaveBalanceEntryRequest request, string kind, bool positive, Guid actor, string traceId, CancellationToken token)
    {
        if (!TryNormalize(request, positive, out var command, out var errors)) return new(LeaveBalanceLedgerWriteStatus.ValidationFailed, Errors: errors);
        await using var connection = await dataSource.OpenConnectionAsync(token); await using var transaction = await connection.BeginTransactionAsync(token);
        if (!await repository.EmployeeExistsAsync(connection, transaction, command.EmployeeId, token)) return new(LeaveBalanceLedgerWriteStatus.EmployeeNotFound);
        if (!await repository.LeaveTypeExistsAsync(connection, transaction, command.LeaveTypeId, token)) return new(LeaveBalanceLedgerWriteStatus.LeaveTypeNotFound);
        if (!await repository.LeaveTypeRequiresBalanceAsync(connection, transaction, command.LeaveTypeId, token)) return new(LeaveBalanceLedgerWriteStatus.LeaveTypeDoesNotRequireBalance);
        try { var entry = await repository.InsertAsync(connection, transaction, command, kind, actor, token); if (entry is null) throw new InvalidOperationException("The authenticated actor could not be resolved."); await repository.UpsertCompatibilityBalanceAsync(connection, transaction, command, token); await auditWriter.WriteAsync(connection, transaction, new(actor, "vacation", $"vacation.leave-balance-entries.{kind}.posted", "leave_balance_entry", entry.PublicId, traceId, []), token); await transaction.CommitAsync(token); return new(LeaveBalanceLedgerWriteStatus.Success, ToResponse(entry)); }
        catch (PostgresException exception) when (exception.SqlState == PostgresErrorCodes.UniqueViolation) { await transaction.RollbackAsync(token); return new(LeaveBalanceLedgerWriteStatus.DuplicateSource); }
        catch (PostgresException exception) when (exception.SqlState == PostgresErrorCodes.RaiseException && exception.MessageText.Contains("negative", StringComparison.OrdinalIgnoreCase)) { await transaction.RollbackAsync(token); return new(LeaveBalanceLedgerWriteStatus.InsufficientBalance); }
    }

    private static LeaveBalanceEntryResponse ToResponse(LeaveBalanceEntryRecord entry) => new(entry.PublicId, entry.EmployeeId, entry.LeaveTypeId, entry.LeaveYear, entry.EntryKind, entry.QuantityDays, entry.EffectiveDate, new DateTimeOffset(entry.AcceptedAt), entry.Reason, entry.Explanation, entry.SourceReference);

    private static LeaveBalanceScopeResponse ToScopeResponse(LeaveBalanceScopeRecord scope) => new(
        scope.EmployeeId, scope.EmployeeName, scope.EmployeeNumber, scope.LeaveTypeId,
        scope.LeaveTypeName, scope.LeaveYear, scope.BalanceDays, scope.EntryCount,
        new DateTimeOffset(scope.LastActivityAt));

    private static bool ResolveEnglishNames(string? acceptLanguage)
    {
        if (string.IsNullOrWhiteSpace(acceptLanguage)) return false;
        foreach (var segment in acceptLanguage.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var tag = segment.Split(';', 2)[0].Trim();
            if (tag.StartsWith("en", StringComparison.OrdinalIgnoreCase)) return true;
            if (tag.StartsWith("sr", StringComparison.OrdinalIgnoreCase)) return false;
        }
        return false;
    }
}
