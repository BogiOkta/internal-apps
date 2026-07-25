namespace InternalApps.Api.Core.BusinessCalendar;

internal sealed record NonWorkingDayRecord(
    Guid PublicId,
    DateOnly Date,
    string Name,
    string? Description,
    DateTime CreatedAt,
    Guid CreatedBy,
    DateTime UpdatedAt,
    Guid UpdatedBy);

internal sealed record NonWorkingDayResponse(
    Guid PublicId,
    DateOnly Date,
    string Name,
    string? Description,
    DateTimeOffset CreatedAt,
    Guid CreatedBy,
    DateTimeOffset UpdatedAt,
    Guid UpdatedBy);

internal sealed record CreateNonWorkingDayRequest(
    DateOnly? Date,
    string? Name,
    string? Description);

internal sealed record UpdateNonWorkingDayRequest(
    DateOnly? Date,
    string? Name,
    string? Description);

internal sealed record SaveNonWorkingDayCommand(
    DateOnly Date,
    string Name,
    string? Description);

internal sealed record WorkingDayResponse(DateOnly Date, bool IsWorkingDay);

internal sealed record WorkingDaysBetweenResponse(
    DateOnly From,
    DateOnly To,
    int WorkingDays);

internal enum NonWorkingDayWriteStatus
{
    Success,
    ValidationFailed,
    NotFound,
    DuplicateDate,
    ActorMissing
}

internal sealed record NonWorkingDayWriteResult(
    NonWorkingDayWriteStatus Status,
    NonWorkingDayResponse? NonWorkingDay = null,
    Dictionary<string, string[]>? Errors = null);
