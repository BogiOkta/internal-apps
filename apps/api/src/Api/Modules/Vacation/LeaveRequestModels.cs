namespace InternalApps.Api.Modules.Vacation;

internal static class LeaveRequestStatuses
{
    public const string Submitted = "SUBMITTED";
    public const string Approved = "APPROVED";
    public const string Rejected = "REJECTED";
    public const string Cancelled = "CANCELLED";

    public static bool IsValid(string value) =>
        value is Submitted or Approved or Rejected or Cancelled;
}

internal sealed record CreateLeaveRequest(
    Guid? LeaveTypeId,
    DateOnly? DateFrom,
    DateOnly? DateTo,
    string? Note);

internal sealed record LeaveRequestComment(string? Comment);

internal sealed record LeaveTypeOptionResponse(
    Guid PublicId,
    string Code,
    string Name,
    string? Description,
    string? Color,
    bool CountsAgainstBalance,
    bool RequiresBalance);

internal sealed record LeaveRequestResponse(
    Guid PublicId,
    Guid EmployeePublicId,
    string EmployeeNumber,
    string EmployeeName,
    Guid DepartmentPublicId,
    string DepartmentName,
    Guid LeaveTypePublicId,
    string LeaveTypeCode,
    string LeaveTypeName,
    string? LeaveTypeColor,
    DateOnly DateFrom,
    DateOnly DateTo,
    int WorkingDays,
    string Status,
    string? EmployeeNote,
    string? DecisionNote,
    DateTimeOffset SubmittedAt,
    DateTimeOffset? DecidedAt,
    DateTimeOffset? CancelledAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

internal sealed record LeaveRequestHistoryResponse(
    Guid PublicId,
    string? PreviousStatus,
    string NewStatus,
    Guid ChangedByUserPublicId,
    string ChangedByDisplayName,
    string? Comment,
    DateTimeOffset ChangedAt);

internal sealed record LeaveBalanceResponse(
    Guid PublicId,
    Guid EmployeePublicId,
    Guid LeaveTypePublicId,
    string LeaveTypeCode,
    string LeaveTypeName,
    int Year,
    int EntitlementDays,
    int CarryOverDays,
    int AdjustmentDays,
    int UsedDays,
    int AvailableDays);

internal sealed record PagedLeaveRequestsResponse(
    IReadOnlyList<LeaveRequestResponse> Items,
    int Page,
    int PageSize,
    long TotalCount);

internal sealed record LeaveRequestAdminQuery(
    Guid? EmployeeId,
    Guid? DepartmentId,
    Guid? LeaveTypeId,
    string? Status,
    DateOnly? DateFrom,
    DateOnly? DateTo,
    string? Search,
    int Page,
    int PageSize);

internal enum LeaveRequestOperationStatus
{
    Success,
    ValidationFailed,
    InvalidDateRange,
    CrossYearNotAllowed,
    NoWorkingDays,
    CurrentEmployeeNotLinked,
    CurrentEmployeeInactive,
    LeaveTypeNotFound,
    LeaveTypeInactive,
    RequestNotFound,
    Forbidden,
    Overlap,
    InvalidTransition,
    BalanceNotFound,
    BalanceInsufficient,
    BalanceInvalid
}

internal sealed record LeaveRequestOperationResult(
    LeaveRequestOperationStatus Status,
    LeaveRequestResponse? Request = null,
    Dictionary<string, string[]>? Errors = null);

internal sealed record LeaveRequestEntity(
    long Id,
    Guid PublicId,
    long EmployeeId,
    Guid EmployeePublicId,
    long LeaveTypeId,
    Guid LeaveTypePublicId,
    bool RequiresBalance,
    DateOnly DateFrom,
    DateOnly DateTo,
    int WorkingDays,
    string Status);

internal sealed record LeaveTypeEntity(
    long Id,
    Guid PublicId,
    bool IsActive,
    bool RequiresBalance);

internal sealed record LeaveBalanceEntity(
    long Id,
    Guid PublicId,
    int EntitlementDays,
    int CarryOverDays,
    int AdjustmentDays,
    int UsedDays)
{
    public int AvailableDays =>
        EntitlementDays + CarryOverDays + AdjustmentDays - UsedDays;
}
