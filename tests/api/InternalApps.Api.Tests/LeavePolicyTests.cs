using InternalApps.Api.Modules.Vacation;
using Xunit;

namespace InternalApps.Api.Tests;

public sealed class LeavePolicyTests
{
    [Fact]
    public void Validation_AcceptsNegativeManualAdjustment()
    {
        var valid = LeavePoliciesService.TryNormalize(
            new(Guid.NewGuid(), 2026, 20, 5, null, -2, "  correction  "),
            out var command, out var errors);

        Assert.True(valid);
        Assert.Empty(errors);
        Assert.Equal(-2, command.ManualAdjustmentDays);
        Assert.Equal("correction", command.Notes);
    }

    [Theory]
    [InlineData(-1, 0, "annualEntitlementDays")]
    [InlineData(1, -1, "carryOverDays")]
    public void Validation_RejectsNegativeNonAdjustmentValues(
        decimal entitlement, decimal carryOver, string expectedField)
    {
        var valid = LeavePoliciesService.TryNormalize(
            new(Guid.NewGuid(), 2026, entitlement, carryOver, null, 0, null),
            out _, out var errors);

        Assert.False(valid);
        Assert.Contains(expectedField, errors.Keys);
    }

    [Fact]
    public void Migration_ContainsMinimalPolicyConstraintsWithoutBalanceColumns()
    {
        var source = ReadRepositoryFile("database", "migrations",
            "019_vacation_leave_policies.sql");
        Assert.Contains("UNIQUE (employee_id, leave_year)", source);
        Assert.Contains("annual_entitlement_days >= 0", source);
        Assert.Contains("carry_over_days >= 0", source);
        Assert.DoesNotContain("remaining_days", source);
        Assert.DoesNotContain("consumed_days", source);
        Assert.DoesNotContain("used_days", source);
        Assert.DoesNotContain("balance", source, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Portal_UsesCrudFiltersAndNoUnsupportedReporting()
    {
        var service = ReadRepositoryFile("apps", "portal", "src", "services",
            "leave-policies.ts");
        var page = ReadRepositoryFile("apps", "portal", "src", "app", "vacation",
            "admin", "policies", "page.tsx");
        Assert.Contains("/api/v1/vacation/leave-policies", service);
        Assert.Contains("query.set(\"year\"", service);
        Assert.Contains("query.set(\"employee\"", service);
        Assert.Contains("method: \"POST\"", service);
        Assert.Contains("method: \"PUT\"", service);
        Assert.Contains("method: \"DELETE\"", service);
        Assert.Contains("includes(leavePolicyManagePermission)", page);
        Assert.DoesNotContain("chart", page, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("report", page, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("type=\"file\"", page, StringComparison.OrdinalIgnoreCase);
    }

    private static string ReadRepositoryFile(params string[] parts)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null &&
               !File.Exists(Path.Combine(directory.FullName, "internal.ps1")))
            directory = directory.Parent;
        Assert.NotNull(directory);
        return File.ReadAllText(Path.Combine([directory!.FullName, .. parts]));
    }
}
