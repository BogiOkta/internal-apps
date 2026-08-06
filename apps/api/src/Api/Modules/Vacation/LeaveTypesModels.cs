using InternalApps.Api.Core.Dependencies;

namespace InternalApps.Api.Modules.Vacation;

internal enum LeaveTypeLocale
{
    Serbian,
    English
}

internal enum LeaveTypeStatusFilter
{
    All,
    Active,
    Inactive
}

internal enum LeaveTypeSortField
{
    DisplayOrder,
    Code,
    Name,
    Status
}

internal enum LeaveTypeSortDirection
{
    Ascending,
    Descending
}

internal sealed record LeaveTypeListQuery(
    string? Search,
    LeaveTypeStatusFilter Status,
    LeaveTypeSortField SortBy,
    LeaveTypeSortDirection SortDirection);

internal sealed record LeaveTypeRecord(
    Guid PublicId,
    string Code,
    string NameSr,
    string NameEn,
    string? DescriptionSr,
    string? DescriptionEn,
    string? CalendarColor,
    bool CountsAgainstVacationBalance,
    bool RequiresBalance,
    bool RequiresApproval,
    bool IsActive,
    bool IsSystem,
    int DisplayOrder,
    bool IsInUse);

internal sealed record LeaveTypeResponse(
    Guid PublicId,
    string Code,
    string Name,
    string? Description,
    string? CalendarColor,
    bool CountsAgainstVacationBalance,
    bool RequiresBalance,
    bool RequiresApproval,
    bool IsActive,
    bool IsSystem,
    int DisplayOrder,
    bool IsInUse);

internal sealed record LeaveTypeDetailsResponse(
    Guid PublicId,
    string Code,
    string Name,
    string? Description,
    string NameSr,
    string NameEn,
    string? DescriptionSr,
    string? DescriptionEn,
    string? CalendarColor,
    bool CountsAgainstVacationBalance,
    bool RequiresBalance,
    bool RequiresApproval,
    bool IsActive,
    bool IsSystem,
    int DisplayOrder,
    bool IsInUse);

internal sealed record CreateLeaveTypeRequest(
    string? Code,
    string? NameSr,
    string? NameEn,
    string? DescriptionSr,
    string? DescriptionEn,
    string? CalendarColor,
    bool? CountsAgainstVacationBalance,
    bool? RequiresBalance,
    bool? RequiresApproval,
    bool? IsActive,
    int? DisplayOrder);

internal sealed record UpdateLeaveTypeRequest(
    string? NameSr,
    string? NameEn,
    string? DescriptionSr,
    string? DescriptionEn,
    string? CalendarColor,
    bool? CountsAgainstVacationBalance,
    bool? RequiresBalance,
    bool? RequiresApproval,
    int? DisplayOrder);

internal sealed record CreateLeaveTypeCommand(
    string Code,
    string NameSr,
    string NameEn,
    string? DescriptionSr,
    string? DescriptionEn,
    string? CalendarColor,
    bool CountsAgainstVacationBalance,
    bool RequiresBalance,
    bool RequiresApproval,
    bool IsActive,
    int DisplayOrder);

internal sealed record UpdateLeaveTypeCommand(
    string NameSr,
    string NameEn,
    string? DescriptionSr,
    string? DescriptionEn,
    string? CalendarColor,
    bool CountsAgainstVacationBalance,
    bool RequiresBalance,
    bool RequiresApproval,
    int DisplayOrder);

internal enum LeaveTypeWriteStatus
{
    Success,
    ValidationFailed,
    NotFound,
    DuplicateCode,
    HasDependencies
}

internal sealed record LeaveTypeWriteResult(
    LeaveTypeWriteStatus Status,
    LeaveTypeDetailsResponse? LeaveType = null,
    Dictionary<string, string[]>? Errors = null);

internal sealed record LeaveTypeDeleteResult(
    LeaveTypeWriteStatus Status,
    string[]? Dependencies = null,
    DependencyInspectionResponse? Inspection = null);

internal sealed record LeaveTypeCreatePersistenceResult(
    LeaveTypeRecord? LeaveType,
    bool DuplicateCode);

internal sealed record LeaveTypeDependencySnapshot(
    Guid PublicId,
    bool IsSystem,
    bool HasPermanentProtection,
    int RequestCount,
    IReadOnlyList<LeaveTypeRequestStatusCount> RequestStatusCounts,
    IReadOnlyList<LeaveTypeBalanceScope> BalanceScopes,
    int LedgerEntryCount);

internal sealed record LeaveTypeRequestStatusCount(
    string Status,
    int Count);

/// <summary>
/// One compatibility-mirror leave balance identity: employee + calendar year.
/// Leave Balances administration resolves a single scope, so Dependency
/// Inspector navigation must carry both public identifiers with the Leave Type.
/// </summary>
internal sealed record LeaveTypeBalanceScope(
    Guid EmployeePublicId,
    int Year);

internal static class LeaveTypeDependencyCodes
{
    public const string EntityType = "leave_type";
    public const string LeaveRequests = "leave_requests";
    public const string LeaveBalances = "leave_balances";
    public const string LeaveBalanceEntries = "leave_balance_entries";
    public const string CountUnitBalances = "balances";
    public const string CountUnitEntries = "entries";
    public const string InfoHistoricalLedger = "historical_ledger_records";
    public const string InfoMultipleLeaveBalances = "multiple_leave_balance_scopes";
    public const string RouteLeaveRequests = "/vacation/admin/requests";
    public const string RouteLeaveBalances = "/vacation/admin/leave-balances";
}
