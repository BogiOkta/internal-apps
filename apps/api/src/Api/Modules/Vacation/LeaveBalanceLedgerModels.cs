namespace InternalApps.Api.Modules.Vacation;

internal sealed record PostLeaveBalanceEntryRequest(
    Guid? EmployeeId, Guid? LeaveTypeId, int? LeaveYear, decimal? QuantityDays,
    DateOnly? EffectiveDate, string? Reason, string? Explanation,
    string? SourceReference);

internal sealed record PostLeaveBalanceEntryCommand(
    Guid EmployeeId, Guid LeaveTypeId, int LeaveYear, decimal QuantityDays,
    DateOnly EffectiveDate, string Reason, string? Explanation, string SourceReference);

internal sealed record LeaveBalanceEntryRecord(
    Guid PublicId, Guid EmployeeId, Guid LeaveTypeId, int LeaveYear,
    string EntryKind, decimal QuantityDays, DateOnly EffectiveDate,
    DateTime AcceptedAt, Guid? ActorUserId, string? SystemOrigin,
    string Reason, string? Explanation, string SourceReference);

internal sealed record LeaveBalanceEntryResponse(
    Guid PublicId, Guid EmployeeId, Guid LeaveTypeId, int LeaveYear,
    string EntryKind, decimal QuantityDays, DateOnly EffectiveDate,
    DateTimeOffset AcceptedAt, string Reason, string? Explanation, string SourceReference);

internal sealed record LeaveBalanceLedgerResponse(
    Guid EmployeeId, Guid LeaveTypeId, int LeaveYear, decimal BalanceDays);

internal sealed record LeaveBalanceScopeRecord(
    Guid EmployeeId, string EmployeeName, string EmployeeNumber,
    Guid LeaveTypeId, string LeaveTypeName, string LeaveTypeCode,
    int LeaveYear, decimal BalanceDays, int EntryCount, DateTime LastActivityAt);

internal sealed record LeaveBalanceScopeResponse(
    Guid EmployeeId, string EmployeeName, string EmployeeNumber,
    Guid LeaveTypeId, string LeaveTypeName, int LeaveYear,
    decimal BalanceDays, int EntryCount, DateTimeOffset LastActivityAt);

internal enum LeaveBalanceLedgerWriteStatus
{
    Success, ValidationFailed, EmployeeNotFound, LeaveTypeNotFound, LeaveTypeDoesNotRequireBalance,
    DuplicateSource, InsufficientBalance
}

internal sealed record LeaveBalanceLedgerWriteResult(
    LeaveBalanceLedgerWriteStatus Status,
    LeaveBalanceEntryResponse? Entry = null,
    Dictionary<string, string[]>? Errors = null);
