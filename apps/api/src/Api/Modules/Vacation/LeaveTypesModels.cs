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
    bool RequiresApproval,
    bool IsActive,
    int DisplayOrder);

internal sealed record LeaveTypeResponse(
    Guid PublicId,
    string Code,
    string Name,
    string? Description,
    string? CalendarColor,
    bool CountsAgainstVacationBalance,
    bool RequiresApproval,
    bool IsActive,
    int DisplayOrder);
