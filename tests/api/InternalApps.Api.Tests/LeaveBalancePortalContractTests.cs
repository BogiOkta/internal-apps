using Xunit;

namespace InternalApps.Api.Tests;

public sealed class LeaveBalancePortalContractTests
{
    [Fact]
    public void Portal_UsesLedgerRoutesAndPostingCommands()
    {
        var service = ReadRepositoryFile("apps", "portal", "src", "services", "leave-balances.ts");
        Assert.Contains("/api/v1/vacation/leave-balances", service);
        Assert.Contains("/history?", service);
        Assert.Contains("entitlements", service);
        Assert.Contains("carry-overs", service);
        Assert.Contains("manual-adjustments", service);
        Assert.Contains("method: \"POST\"", service);
    }

    [Fact]
    public void Page_GuardsAdministrationAndMirrorsInputValidation()
    {
        var page = ReadRepositoryFile("apps", "portal", "src", "app", "vacation", "admin", "leave-balances", "page.tsx");
        Assert.Contains("includes(leaveBalanceManagePermission)", page);
        Assert.Contains("if (!allowed)", page);
        Assert.Contains("form.quantityDays * 2", page);
        Assert.Contains("form.effectiveDate.slice(0, 4)", page);
        Assert.Contains("form.reason.trim()", page);
        Assert.Contains("form.sourceReference.trim()", page);
        Assert.Contains("setLoaded(false)", page);
        Assert.Contains("changeScope({ ...scope", page);
    }

    [Fact]
    public void Page_DoesNotIntroduceDeferredLedgerCapabilities()
    {
        var page = ReadRepositoryFile("apps", "portal", "src", "app", "vacation", "admin", "leave-balances", "page.tsx");
        Assert.DoesNotContain("chart", page, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(".csv", page, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("projection", page, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("annual closing", page, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("type=\"file\"", page, StringComparison.OrdinalIgnoreCase);
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
