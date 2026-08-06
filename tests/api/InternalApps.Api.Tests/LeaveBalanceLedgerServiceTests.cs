using InternalApps.Api.Modules.Vacation;
using Xunit;

namespace InternalApps.Api.Tests;

public sealed class LeaveBalanceLedgerServiceTests
{
    [Fact]
    public void Validation_NormalizesReasonedManualAdjustment()
    {
        var valid = LeaveBalanceLedgerService.TryNormalize(new(Guid.NewGuid(), Guid.NewGuid(), 2026, -1.5m,
            new DateOnly(2026, 7, 1), "  correction ", "  explained ", "  adjustment-1  "), false, out var command, out var errors);
        Assert.True(valid); Assert.Empty(errors); Assert.Equal(-1.5m, command.QuantityDays);
        Assert.Equal("correction", command.Reason); Assert.Equal("explained", command.Explanation); Assert.Equal("adjustment-1", command.SourceReference);
    }

    [Theory]
    [InlineData(0)] [InlineData(0.25)]
    public void Validation_RejectsZeroAndNonHalfDayQuantities(decimal quantity)
    {
        var valid = LeaveBalanceLedgerService.TryNormalize(new(Guid.NewGuid(), Guid.NewGuid(), 2026, quantity,
            new DateOnly(2026, 1, 1), "reason", null, "source"), false, out _, out var errors);
        Assert.False(valid); Assert.Contains("quantityDays", errors.Keys);
    }

    [Fact]
    public void Validation_RequiresPositiveEntitlementAndMatchingEffectiveYear()
    {
        var valid = LeaveBalanceLedgerService.TryNormalize(new(Guid.NewGuid(), Guid.NewGuid(), 2026, -1,
            new DateOnly(2025, 12, 31), "reason", null, "source"), true, out _, out var errors);
        Assert.False(valid); Assert.Contains("quantityDays", errors.Keys); Assert.Contains("effectiveDate", errors.Keys);
    }

    [Fact]
    public void Api_ExposesApprovedLv2PostingScopedReadAndScopeOverviewEndpoints()
    {
        var source = ReadRepositoryFile("apps", "api", "src", "Api", "Modules", "Vacation",
            "LeaveBalanceLedgerEndpoints.cs");
        Assert.Contains("/api/v1/vacation/leave-balances", source);
        Assert.Contains("MapGet(\"/scopes\"", source);
        Assert.Contains("MapPost(\"/entitlements\"", source);
        Assert.Contains("MapPost(\"/carry-overs\"", source);
        Assert.Contains("MapPost(\"/manual-adjustments\"", source);

        var repository = ReadRepositoryFile("apps", "api", "src", "Api", "Modules", "Vacation",
            "LeaveBalanceLedgerRepository.cs");
        Assert.Contains("LIMIT @Limit", repository);
        Assert.Contains("Limit = ScopeOverviewLimit", repository);
        Assert.Contains("MapGet(\"/history\"", source);
        Assert.Contains("RequireAuthorization(VacationPermissions.ManageLeaveBalances)", source);
        Assert.DoesNotContain("IdentityPermissions.ManageUsers", source);
        Assert.DoesNotContain("request-consumption", source, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("cancellation-reversal", source, StringComparison.OrdinalIgnoreCase);
    }

    private static string ReadRepositoryFile(params string[] parts)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "internal.ps1")))
            directory = directory.Parent;
        Assert.NotNull(directory);
        return File.ReadAllText(Path.Combine([directory!.FullName, .. parts]));
    }
}
