using Xunit;

namespace InternalApps.Api.Tests;

public sealed class PortalNavigationContractTests
{
    [Fact]
    public void CompanyAdministration_UsesOrganizationWorkspaceRegistry()
    {
        var shell = ReadRepositoryFile("apps", "portal", "src", "components", "app-shell.tsx");
        var registry = ReadRepositoryFile("apps", "portal", "src", "navigation", "organization.ts");
        var identityRegistry = ReadRepositoryFile("apps", "portal", "src", "navigation", "identity.ts");
        var index = ReadRepositoryFile("apps", "portal", "src", "navigation", "index.ts");

        Assert.Contains("navigation.companyAdministration", shell);
        Assert.Contains("getCompanyWorkspaces", shell);
        Assert.Contains("getPlatformWorkspaces", shell);
        Assert.Contains("WorkspaceNavBlock", shell);
        // Identity route ownership lives in the registry, not a hardcoded NavLink.
        Assert.DoesNotContain("href=\"/identity/users\"", shell);

        Assert.DoesNotContain("href=\"/organization/departments\"", shell);
        Assert.DoesNotContain("href=\"/organization/employees\"", shell);
        Assert.DoesNotContain("href=\"/business-calendar/admin/non-working-days\"", shell);
        Assert.DoesNotContain("href=\"/organization/user-employee-links\"", shell);

        Assert.Contains("organizationWorkspace", index);
        Assert.Contains("identityWorkspace", index);
        Assert.Contains("getCompanyWorkspaces", index);
        Assert.Contains("getPlatformWorkspaces", index);
        Assert.Contains("/organization", registry);
        Assert.Contains("/organization/departments", registry);
        Assert.Contains("/organization/employees", registry);
        Assert.Contains("/business-calendar/admin/non-working-days", registry);
        Assert.Contains("/organization/user-employee-links", registry);
        Assert.Contains("organization.nav.administration", registry);
        Assert.Contains("businessCalendarManagePermission", registry);
        Assert.Contains("userEmployeeLinksManagePermission", registry);

        Assert.Contains("/identity/users", identityRegistry);
        Assert.Contains("usersManagePermission", identityRegistry);
        Assert.Contains("identity.workspace.name", identityRegistry);
        Assert.Contains("\"platform\"", identityRegistry);
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
        // Identity belongs in the workspace profile menu, not a permanent sidebar card.
        Assert.Contains("WorkspaceProfileMenu", shell);
        Assert.DoesNotContain("shell.noRole", shell);

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
    public void VacationWorkspace_UsesSidebarSectionsWithoutModuleTabStrip()
    {
        var workspace = ReadRepositoryFile("apps", "portal", "src", "features", "vacation",
            "components", "vacation-workspace.tsx");
        var shell = ReadRepositoryFile("apps", "portal", "src", "features", "vacation",
            "components", "vacation-shell.tsx");
        var layout = ReadRepositoryFile("apps", "portal", "src", "app", "vacation",
            "layout.tsx");
        var registry = ReadRepositoryFile("apps", "portal", "src", "navigation", "vacation.ts");
        var appShell = ReadRepositoryFile("apps", "portal", "src", "components", "app-shell.tsx");

        Assert.DoesNotContain("WorkspaceNavigation", workspace);
        Assert.DoesNotContain("AppShell", workspace);
        Assert.Contains("PortalSectionHeader", workspace);
        Assert.Contains("asPageTitle", workspace);
        Assert.Contains("useVacationShellChrome", workspace);

        Assert.Contains("layoutMode=\"workspace\"", shell);
        Assert.Contains("buildWorkspaceBreadcrumbs", shell);
        Assert.Contains("VacationPersistentShell", layout);
        Assert.Contains("breadcrumbRecordLabel", workspace);

        Assert.Contains("/vacation", registry);
        Assert.Contains("/vacation/requests", registry);
        Assert.Contains("/vacation/leave-types", registry);
        Assert.Contains("/vacation/admin/requests", registry);
        Assert.Contains("/vacation/admin/policies", registry);
        Assert.Contains("/vacation/admin/leave-balances", registry);
        Assert.Contains("vacation.nav.administration", registry);
        Assert.Contains("leaveTypesManagePermission", registry);
        Assert.Contains("vacationRequestsManagePermission", registry);
        Assert.Contains("leaveBalanceManagePermission", registry);

        Assert.Contains("WorkspaceNavBlock", appShell);
        Assert.Contains("AdministrationNavGroup", appShell);
        Assert.Contains("getWorkspaceByApplicationCode", appShell);

        Assert.DoesNotContain("/organization/employees", workspace);
        Assert.DoesNotContain("/organization/departments", workspace);
        Assert.DoesNotContain("/business-calendar/admin/non-working-days", workspace);
    }

    [Fact]
    public void OrganizationWorkspace_UsesPersistentShellWithoutModuleTabStrip()
    {
        var workspace = ReadRepositoryFile("apps", "portal", "src", "features", "organization",
            "components", "organization-workspace.tsx");
        var shell = ReadRepositoryFile("apps", "portal", "src", "features", "organization",
            "components", "organization-shell.tsx");
        var companyLayout = ReadRepositoryFile("apps", "portal", "src", "app", "(company)",
            "layout.tsx");
        var employees = ReadRepositoryFile("apps", "portal", "src", "app", "(company)",
            "organization", "employees", "page.tsx");
        var departments = ReadRepositoryFile("apps", "portal", "src", "app", "(company)",
            "organization", "departments", "page.tsx");
        var links = ReadRepositoryFile("apps", "portal", "src", "app", "(company)",
            "organization", "user-employee-links", "page.tsx");
        var nonWorkingDays = ReadRepositoryFile("apps", "portal", "src", "app", "(company)",
            "business-calendar", "admin", "non-working-days", "page.tsx");
        var users = ReadRepositoryFile("apps", "portal", "src", "app", "identity", "users", "page.tsx");
        var identityLayout = ReadRepositoryFile("apps", "portal", "src", "app", "identity",
            "layout.tsx");
        var identityShell = ReadRepositoryFile("apps", "portal", "src", "features", "identity",
            "components", "identity-shell.tsx");
        var identityWorkspace = ReadRepositoryFile("apps", "portal", "src", "features", "identity",
            "components", "identity-workspace.tsx");
        var vacationLayout = ReadRepositoryFile("apps", "portal", "src", "app", "vacation",
            "layout.tsx");

        Assert.DoesNotContain("WorkspaceNavigation", workspace);
        Assert.DoesNotContain("AppShell", workspace);
        Assert.Contains("PortalSectionHeader", workspace);
        Assert.Contains("asPageTitle", workspace);
        Assert.Contains("useOrganizationShellChrome", workspace);
        Assert.Contains("layoutMode=\"workspace\"", shell);
        Assert.Contains("OrganizationPersistentShell", companyLayout);
        Assert.DoesNotContain("VacationPersistentShell", companyLayout);
        Assert.DoesNotContain("IdentityPersistentShell", companyLayout);

        // Shared Company layout owns AppShell once; pages must not wrap it.
        Assert.DoesNotContain("AppShell", employees);
        Assert.DoesNotContain("AppShell", departments);
        Assert.DoesNotContain("AppShell", links);
        Assert.DoesNotContain("AppShell", nonWorkingDays);
        Assert.DoesNotContain("OrganizationPersistentShell", employees);
        Assert.DoesNotContain("OrganizationPersistentShell", departments);
        Assert.DoesNotContain("OrganizationPersistentShell", links);
        Assert.DoesNotContain("OrganizationPersistentShell", nonWorkingDays);

        Assert.Contains("OrganizationWorkspace", employees);
        Assert.Contains("OrganizationWorkspace", departments);
        Assert.Contains("OrganizationWorkspace", links);
        Assert.Contains("OrganizationWorkspace", nonWorkingDays);
        Assert.DoesNotContain("CompanyAdministrationWorkspace", employees);
        Assert.DoesNotContain("CompanyAdministrationWorkspace", departments);
        Assert.DoesNotContain("CompanyAdministrationWorkspace", links);
        Assert.DoesNotContain("CompanyAdministrationWorkspace", nonWorkingDays);
        Assert.DoesNotContain("VacationWorkspace", employees);
        Assert.DoesNotContain("VacationWorkspace", departments);
        Assert.DoesNotContain("VacationWorkspace", links);
        Assert.DoesNotContain("VacationWorkspace", nonWorkingDays);

        Assert.Contains("IdentityPersistentShell", identityLayout);
        Assert.Contains("layoutMode=\"workspace\"", identityShell);
        Assert.Contains("PortalSectionHeader", identityWorkspace);
        Assert.Contains("asPageTitle", identityWorkspace);
        Assert.Contains("IdentityWorkspace", users);
        Assert.DoesNotContain("AppShell", users);
        Assert.DoesNotContain("CompanyAdministrationWorkspace", users);
        Assert.DoesNotContain("OrganizationWorkspace", users);
        Assert.DoesNotContain("VacationWorkspace", users);

        // Vacation remains an independent persistent shell owner.
        Assert.Contains("VacationPersistentShell", vacationLayout);
        Assert.False(Directory.Exists(Path.Combine(
            RepositoryRoot(), "apps", "portal", "src", "app", "organization")));
        Assert.False(Directory.Exists(Path.Combine(
            RepositoryRoot(), "apps", "portal", "src", "app", "business-calendar")));
    }

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "internal.ps1")))
            directory = directory.Parent;
        Assert.NotNull(directory);
        return directory!.FullName;
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
        Assert.Contains("WorkspaceProfileMenu", shell);
        Assert.Contains("\"vacation.nav.overview\": \"Overview\"", translations);
        Assert.Contains("\"vacation.nav.overview\": \"Pregled\"", translations);
        Assert.Contains("\"vacation.nav.myRequests\": \"My requests\"", translations);
        Assert.Contains("\"vacation.nav.myRequests\": \"Moji zahtevi\"", translations);
        Assert.Contains("\"organization.nav.overview\": \"Overview\"", translations);
        Assert.Contains("\"organization.nav.overview\": \"Pregled\"", translations);
        Assert.Contains("\"organization.workspace.name\": \"Organization\"", translations);
        Assert.Contains("\"organization.workspace.name\": \"Organizacija\"", translations);
        Assert.Contains("\"identity.workspace.name\": \"Identity\"", translations);
        Assert.Contains("\"identity.workspace.name\": \"Identitet\"", translations);
        Assert.Contains("\"identity.nav.users\": \"Users\"", translations);
        Assert.Contains("\"identity.nav.users\": \"Korisnici\"", translations);
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
