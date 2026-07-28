using Xunit;

namespace InternalApps.Api.Tests;

public sealed class PortalNavigationContractTests
{
    [Fact]
    public void CompanyAdministration_UsesCanonicalOrganizationAndCalendarRoutes()
    {
        var shell = ReadRepositoryFile("apps", "portal", "src", "components", "app-shell.tsx");

        Assert.Contains("navigation.companyAdministration", shell);
        Assert.Contains("/organization/departments", shell);
        Assert.Contains("/organization/employees", shell);
        Assert.Contains("/business-calendar/admin/non-working-days", shell);
        Assert.Contains("user.permissions.includes(usersManagePermission)", shell);
    }

    [Fact]
    public void Shell_ExposesSettingsWithoutPermanentPreferenceControls()
    {
        var shell = ReadRepositoryFile("apps", "portal", "src", "components", "app-shell.tsx");
        var settings = ReadRepositoryFile("apps", "portal", "src", "app", "settings", "page.tsx");
        var translations = ReadRepositoryFile("apps", "portal", "src", "i18n", "translations.ts");
        var appearanceProvider = ReadRepositoryFile(
            "apps", "portal", "src", "components", "appearance-provider.tsx");

        Assert.Contains("href=\"/settings\"", shell);
        Assert.Contains("navigation.settings", shell);
        Assert.Contains("shell.logout", shell);
        Assert.DoesNotContain("useAppearance()", shell);
        Assert.DoesNotContain("setLocale(", shell);
        Assert.DoesNotContain("user.displayName", shell);
        Assert.DoesNotContain("user.username", shell);

        Assert.Contains("useAppearance()", settings);
        Assert.Contains("setLocale(", settings);
        Assert.Contains("setAppearance(", settings);
        Assert.Contains("appearanceStorageKey", appearanceProvider);
        Assert.Contains("\"settings.title\": \"Settings\"", translations);
        Assert.Contains("\"settings.title\": \"Podešavanja\"", translations);
        Assert.Contains("\"navigation.settings\": \"Settings\"", translations);
        Assert.Contains("\"navigation.settings\": \"Podešavanja\"", translations);
    }

    [Fact]
    public void VacationWorkspace_ContainsOnlyVacationNavigation()
    {
        var workspace = ReadRepositoryFile("apps", "portal", "src", "features", "vacation",
            "components", "vacation-workspace.tsx");

        Assert.Contains("/vacation/requests", workspace);
        Assert.Contains("/vacation/leave-types", workspace);
        Assert.Contains("/vacation/admin/requests", workspace);
        Assert.Contains("/vacation/admin/policies", workspace);
        Assert.Contains("/vacation/admin/leave-balances", workspace);
        Assert.DoesNotContain("/organization/employees", workspace);
        Assert.DoesNotContain("/organization/departments", workspace);
        Assert.DoesNotContain("/business-calendar/admin/non-working-days", workspace);
    }

    [Fact]
    public void CompanyAdministrationPages_DoNotUseTheVacationWorkspace()
    {
        var employees = ReadRepositoryFile("apps", "portal", "src", "app", "organization", "employees", "page.tsx");
        var departments = ReadRepositoryFile("apps", "portal", "src", "app", "organization", "departments", "page.tsx");
        var links = ReadRepositoryFile("apps", "portal", "src", "app", "organization", "user-employee-links", "page.tsx");
        var users = ReadRepositoryFile("apps", "portal", "src", "app", "identity", "users", "page.tsx");

        Assert.Contains("CompanyAdministrationWorkspace", employees);
        Assert.Contains("CompanyAdministrationWorkspace", departments);
        Assert.Contains("CompanyAdministrationWorkspace", links);
        Assert.Contains("CompanyAdministrationWorkspace", users);
        Assert.DoesNotContain("VacationWorkspace", employees);
        Assert.DoesNotContain("VacationWorkspace", departments);
        Assert.DoesNotContain("VacationWorkspace", links);
        Assert.DoesNotContain("VacationWorkspace", users);
    }

    [Fact]
    public void DashboardAndShell_UseUpdatedCopyWithoutTheRedundantAvatar()
    {
        var translations = ReadRepositoryFile("apps", "portal", "src", "i18n", "translations.ts");
        var shell = ReadRepositoryFile("apps", "portal", "src", "components", "app-shell.tsx");

        Assert.Contains("\"navigation.companyAdministration\": \"Company administration\"", translations);
        Assert.Contains("\"navigation.companyAdministration\": \"Administracija firme\"", translations);
        Assert.Contains("\"dashboard.assignedApplications\": \"My applications\"", translations);
        Assert.Contains("\"dashboard.assignedApplications\": \"Moje aplikacije\"", translations);
        Assert.DoesNotContain("getInitials", shell);
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
