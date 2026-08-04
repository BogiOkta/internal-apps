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
        var source = ReadRepositoryFile("apps", "portal", "src", "app", "(company)",
            "business-calendar", "admin", "non-working-days", "page.tsx");
        Assert.Contains("includes(businessCalendarManagePermission)", source);
        Assert.Contains("if (!allowed)", source);
        Assert.Contains("if (!form.date)", source);
        Assert.Contains("if (!form.name.trim())", source);
        Assert.Contains("if (isSubmitting", source);
        Assert.Contains("PortalDateInput", source);
        Assert.Contains("key={dateInputVersion}", source);
        Assert.DoesNotContain("type=\"date\"", source);
    }

    [Fact]
    public void Navigation_IsPermissionAware()
    {
        var shell = ReadRepositoryFile("apps", "portal", "src", "components",
            "app-shell.tsx");
        var registry = ReadRepositoryFile("apps", "portal", "src", "navigation",
            "organization.ts");
        var companyLayout = ReadRepositoryFile("apps", "portal", "src", "app", "(company)",
            "layout.tsx");
        Assert.Contains("user.permissions.includes(usersManagePermission)", shell);
        Assert.Contains("/business-calendar/admin/non-working-days", registry);
        Assert.Contains("businessCalendarManagePermission", registry);
        Assert.Contains("OrganizationPersistentShell", companyLayout);
    }

    [Fact]
    public void Page_DoesNotIntroduceUnsupportedCalendarControls()
    {
        var source = ReadRepositoryFile("apps", "portal", "src", "app", "(company)",
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
