namespace InternalApps.Api.Core.Dependencies;

/// <summary>
/// Platform-wide dependency inspection contract. Modules populate entity-specific
/// groups, counts, and navigation hints; the Portal Dependency Inspector renders
/// them without inventing domain rules or hard-coding dependency strings.
/// </summary>
internal sealed record DependencyInspectionResponse(
    string EntityType,
    Guid EntityPublicId,
    bool CanDelete,
    bool IsSystemProtected,
    bool HasPermanentProtection,
    IReadOnlyList<DependencyGroupResponse> Dependencies);

internal sealed record DependencyGroupResponse(
    string Code,
    int Count,
    string? CountUnit,
    IReadOnlyList<DependencyDetailResponse> Details,
    DependencyNavigationResponse Navigation);

internal sealed record DependencyDetailResponse(
    string Code,
    int Count);

/// <summary>
/// Navigation hint for resolving a dependency. Kind is either
/// <c>portal_route</c> (Route + optional Query) or <c>none</c> (InfoCode only).
/// </summary>
internal sealed record DependencyNavigationResponse(
    string Kind,
    string? Route = null,
    IReadOnlyDictionary<string, string>? Query = null,
    string? InfoCode = null);

internal static class DependencyNavigationKinds
{
    public const string PortalRoute = "portal_route";
    public const string None = "none";
}
