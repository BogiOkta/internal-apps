using Xunit;

namespace InternalApps.Api.Tests;

public sealed class PortalAdministrationUiContractTests
{
    [Fact]
    public void MigratedScope_DoesNotUseNativeUserFacingDateInputs()
    {
        foreach (var parts in new[]
        {
            new[] { "apps", "portal", "src", "app", "organization", "employees", "page.tsx" },
            new[] { "apps", "portal", "src", "app", "organization", "departments", "page.tsx" },
            new[] { "apps", "portal", "src", "app", "business-calendar", "admin", "non-working-days", "page.tsx" },
            new[] { "apps", "portal", "src", "features", "vacation", "components", "employee-form.tsx" },
            new[] { "apps", "portal", "src", "features", "organization", "components", "department-form.tsx" },
        })
        {
            var source = Read(parts);
            Assert.DoesNotContain("type=\"date\"", source, StringComparison.Ordinal);
            Assert.DoesNotContain("type='date'", source, StringComparison.Ordinal);
        }

        var businessCalendar = Read("apps", "portal", "src", "app", "business-calendar",
            "admin", "non-working-days", "page.tsx");
        Assert.Contains("PortalDateInput", businessCalendar);
        Assert.Contains("nullable={false}", businessCalendar);

        var employeeForm = Read("apps", "portal", "src", "features", "vacation",
            "components", "employee-form.tsx");
        Assert.Contains("PortalDateInput", employeeForm);
    }

    [Fact]
    public void PortalDateInput_DerivesCalendarLabelsFromPortalLocale()
    {
        var source = Read("apps", "portal", "src", "components", "portal-date-input.tsx");

        Assert.Contains("const { locale } = useTranslations()", source);
        Assert.Contains("browserLocales[locale]", source);
        Assert.Contains("weekday: \"short\"", source);
        Assert.Contains("month: \"long\"", source);
        Assert.DoesNotContain("\"sr-Latn-RS\"", source);
        foreach (var hardcodedWeekday in new[] { ">Po<", ">Ut<", ">Sr<", ">Če<", ">Pe<", ">Su<", ">Ne<" })
        {
            Assert.DoesNotContain(hardcodedWeekday, source);
        }
    }

    [Fact]
    public void OrganizationAdministration_UsesSharedLayoutContracts()
    {
        var employees = Read("apps", "portal", "src", "app", "organization", "employees", "page.tsx");
        var departments = Read("apps", "portal", "src", "app", "organization", "departments", "page.tsx");

        foreach (var page in new[] { employees, departments })
        {
            Assert.Contains("AdministrationPageBody", page);
            Assert.Contains("AdministrativeGridShell", page);
            Assert.Contains("fillViewport", page);
            Assert.Contains("AdministrativeGridToolbar", page);
            Assert.Contains("GridPagination", page);
            Assert.Contains("contentFillsViewport", page);
            Assert.Contains("headerActions", page);
            Assert.DoesNotContain("GridFooter", page);
        }
    }

    [Fact]
    public void AdministrativeGridShell_GatesViewportFillHeightCollapse()
    {
        var shell = Read("apps", "portal", "src", "components", "admin-data-grid.tsx");
        var body = Read("apps", "portal", "src", "components", "administration-page-body.tsx");

        Assert.Contains("fillViewport = false", shell);
        Assert.Contains("fillViewport ? \"lg:h-0 lg:flex-1\"", shell);
        Assert.Contains("min-h-[24rem]", shell);
        Assert.Contains("min-h-0 flex-1 overflow-auto", shell);
        Assert.Contains("lg:flex lg:min-h-0 lg:flex-1 lg:flex-col", body);
    }

    [Fact]
    public void DepartmentsPage_PreservesShellGeometryStates()
    {
        var page = Read("apps", "portal", "src", "app", "organization", "departments", "page.tsx");
        Assert.Contains("AdministrationPageBody", page);
        Assert.Contains("fillViewport", page);
        Assert.Contains("GridStateRows", page);
        Assert.Contains("isLoading={isLoading}", page);
        Assert.Contains("isEmpty={departments.length === 0}", page);
        Assert.Contains("hasError={hasError}", page);
        Assert.Contains("selectForDetails", page);
        Assert.Contains("panelMode === \"create\"", page);
        Assert.Contains("panelMode === \"edit\"", page);
        Assert.Contains("GridPagination", page);
        Assert.DoesNotContain("GridFooter", page);
    }

    [Fact]
    public void BusinessCalendarAdministration_UsesCanonicalChrome()
    {
        var page = Read("apps", "portal", "src", "app", "business-calendar",
            "admin", "non-working-days", "page.tsx");
        Assert.Contains("CompanyAdministrationWorkspace", page);
        Assert.Contains("headerActions", page);
        Assert.Contains("PortalDateInput", page);
        Assert.Contains("formControlClassName", page);
        Assert.Contains("formPrimaryButtonClassName", page);
        Assert.Contains("rounded-xl border border-slate-300", page);
        Assert.DoesNotContain("type=\"date\"", page);
    }

    private static string Read(params string[] parts)
    {
        return File.ReadAllText(Path.Combine([RepositoryRoot(), .. parts]));
    }

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null &&
               !File.Exists(Path.Combine(directory.FullName, "internal.ps1")))
        {
            directory = directory.Parent;
        }

        Assert.NotNull(directory);
        return directory!.FullName;
    }
}
