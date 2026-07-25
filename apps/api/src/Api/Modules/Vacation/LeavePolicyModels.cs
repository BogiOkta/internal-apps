namespace InternalApps.Api.Modules.Vacation;

internal sealed record LeavePolicyRecord(
    Guid PublicId,
    Guid EmployeeId,
    string EmployeeNumber,
    string EmployeeName,
    int LeaveYear,
    decimal AnnualEntitlementDays,
    decimal CarryOverDays,
    DateOnly? CarryOverExpirationDate,
    decimal ManualAdjustmentDays,
    string? Notes,
    DateTime CreatedAt,
    DateTime UpdatedAt);

internal sealed record LeavePolicyResponse(
    Guid PolicyId,
    Guid EmployeeId,
    string EmployeeNumber,
    string EmployeeName,
    int LeaveYear,
    decimal AnnualEntitlementDays,
    decimal CarryOverDays,
    DateOnly? CarryOverExpirationDate,
    decimal ManualAdjustmentDays,
    string? Notes,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

internal sealed record SaveLeavePolicyRequest(
    Guid? EmployeeId,
    int? LeaveYear,
    decimal? AnnualEntitlementDays,
    decimal? CarryOverDays,
    DateOnly? CarryOverExpirationDate,
    decimal? ManualAdjustmentDays,
    string? Notes);

internal sealed record SaveLeavePolicyCommand(
    Guid EmployeeId,
    int LeaveYear,
    decimal AnnualEntitlementDays,
    decimal CarryOverDays,
    DateOnly? CarryOverExpirationDate,
    decimal ManualAdjustmentDays,
    string? Notes);

internal enum LeavePolicyWriteStatus
{
    Success,
    ValidationFailed,
    NotFound,
    EmployeeNotFound,
    DuplicateEmployeeYear
}

internal sealed record LeavePolicyWriteResult(
    LeavePolicyWriteStatus Status,
    LeavePolicyResponse? Policy = null,
    Dictionary<string, string[]>? Errors = null);
