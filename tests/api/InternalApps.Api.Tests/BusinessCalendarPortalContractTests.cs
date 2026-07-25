using Xunit;

namespace InternalApps.Api.Tests;

public sealed class BusinessCalendarPortalContractTests
{
    [Fact]
    public void Service_UsesExpectedRoutesMethodsAndPayload()
    {
        var source = ReadRepositoryFile("apps", "portal", "src", "services",
            "business-calendar.ts");
        Assert.Contains("/api/v1/business-calendar/non-working-days", source);
        Assert.Contains("?year=${year}", source);
        Assert.Contains("method: \"POST\", body", source);
        Assert.Contains("method: \"PUT\"", source);
        Assert.Contains("method: \"DELETE\"", source);
        Assert.Contains("JSON.stringify(options.body)", source);
    }

    [Fact]
    public void Page_GuardsPermissionAndValidatesRequiredFields()
    {
        var source = ReadRepositoryFile("apps", "portal", "src", "app",
            "business-calendar", "admin", "non-working-days", "page.tsx");
        Assert.Contains("includes(businessCalendarManagePermission)", source);
        Assert.Contains("if (!allowed)", source);
        Assert.Contains("if (!form.date)", source);
        Assert.Contains("if (!form.name.trim())", source);
        Assert.Contains("if (isSubmitting", source);
    }

    [Fact]
    public void Navigation_IsPermissionAware()
    {
        var source = ReadRepositoryFile("apps", "portal", "src", "components",
            "app-shell.tsx");
        Assert.Contains("user.permissions.includes(usersManagePermission)", source);
        Assert.Contains("/business-calendar/admin/non-working-days", source);
    }

    [Fact]
    public void Page_DoesNotIntroduceUnsupportedCalendarControls()
    {
        var source = ReadRepositoryFile("apps", "portal", "src", "app",
            "business-calendar", "admin", "non-working-days", "page.tsx");
        Assert.DoesNotContain("recurrence", source, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("working saturday", source, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("drag", source, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("type=\"file\"", source, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("bulk", source, StringComparison.OrdinalIgnoreCase);
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
