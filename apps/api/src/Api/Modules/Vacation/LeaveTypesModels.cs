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
    string[]? Dependencies = null);

internal sealed record LeaveTypeCreatePersistenceResult(
    LeaveTypeRecord? LeaveType,
    bool DuplicateCode);
