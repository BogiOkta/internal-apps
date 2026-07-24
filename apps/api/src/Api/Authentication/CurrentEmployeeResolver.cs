using System.IdentityModel.Tokens.Jwt;
using InternalApps.Api.Modules.Organization;

namespace InternalApps.Api.Authentication;

internal enum CurrentEmployeeResolutionStatus
{
    Success,
    Unauthenticated,
    NotLinked
}

internal sealed record CurrentEmployeeResolution(
    CurrentEmployeeResolutionStatus Status,
    Guid? UserPublicId = null,
    EmployeeResponse? Employee = null);

internal sealed class CurrentEmployeeResolver(UserEmployeeLinksRepository repository)
{
    public async Task<CurrentEmployeeResolution> ResolveAsync(
        HttpContext context, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(
                context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value,
                out var userPublicId))
            return new(CurrentEmployeeResolutionStatus.Unauthenticated);

        var employee = await repository.GetEmployeeForUserAsync(
            userPublicId, cancellationToken);
        return employee is null
            ? new(CurrentEmployeeResolutionStatus.NotLinked, userPublicId)
            : new(CurrentEmployeeResolutionStatus.Success, userPublicId, employee);
    }
}
