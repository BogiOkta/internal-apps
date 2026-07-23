namespace InternalApps.Api.Applications;

internal sealed record ApplicationResponse(
    Guid PublicId,
    string Code,
    string Name,
    string? Description,
    string Route);
