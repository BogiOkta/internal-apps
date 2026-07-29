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
        var users = Read("apps", "portal", "src", "app", "identity", "users", "page.tsx");
        var links = Read("apps", "portal", "src", "app", "organization", "user-employee-links", "page.tsx");
        var leaveTypes = Read("apps", "portal", "src", "app", "vacation", "leave-types", "page.tsx");

        foreach (var page in new[] { employees, departments, users, links, leaveTypes })
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
    public void IdentityAdministration_PreservesShellGeometryStates()
    {
        var users = Read("apps", "portal", "src", "app", "identity", "users", "page.tsx");
        Assert.Contains("AdministrationPageBody", users);
        Assert.Contains("fillViewport", users);
        Assert.Contains("GridStateRows", users);
        Assert.Contains("isLoading={isLoading}", users);
        Assert.Contains("isEmpty={users.length === 0}", users);
        Assert.Contains("hasError={hasError}", users);
        Assert.Contains("selectForDetails", users);
        Assert.Contains("panelMode === \"create\"", users);
        Assert.Contains("GridPagination", users);
        Assert.Contains("formPrimaryButtonClassName", users);
        Assert.Contains("formSecondaryButtonClassName", users);
        Assert.Contains("formControlClassName", users);
        Assert.DoesNotContain("GridFooter", users);
    }

    [Fact]
    public void UserEmployeeLinksAdministration_PreservesShellGeometryStates()
    {
        var links = Read("apps", "portal", "src", "app", "organization", "user-employee-links", "page.tsx");
        Assert.Contains("AdministrationPageBody", links);
        Assert.Contains("fillViewport", links);
        Assert.Contains("GridStateRows", links);
        Assert.Contains("isLoading={isLoading}", links);
        Assert.Contains("isEmpty={links.length === 0}", links);
        Assert.Contains("hasError={hasError}", links);
        Assert.Contains("selectForDetails", links);
        Assert.Contains("panelMode === \"create\"", links);
        Assert.Contains("panelMode === \"edit\"", links);
        Assert.Contains("GridPagination", links);
        Assert.Contains("SearchableCombobox", links);
        Assert.Contains("formPrimaryButtonClassName", links);
        Assert.Contains("formSecondaryButtonClassName", links);
        Assert.DoesNotContain("GridFooter", links);
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
    public void LeaveTypeAdministration_UsesCanonicalContractAndDeclaresRequiredColumns()
    {
        var page = Read("apps", "portal", "src", "app", "vacation", "leave-types", "page.tsx");
        var form = Read("apps", "portal", "src", "features", "vacation",
            "components", "leave-type-form.tsx");

        Assert.Contains("AdministrationPageBody", page);
        Assert.Contains("AdministrativeGridShell", page);
        Assert.Contains("AdministrativeGridToolbar", page);
        Assert.Contains("fillViewport", page);
        Assert.Contains("GridPagination", page);
        Assert.Contains("GridStateRows", page);
        Assert.Contains("contentFillsViewport", page);
        Assert.Contains("headerActions", page);
        Assert.DoesNotContain("GridFooter", page);
        Assert.DoesNotContain("GridToolbarActions", page);

        // The canonical grid columns for this increment.
        foreach (var column in new[]
        {
            "vacation.leaveTypes.code",
            "vacation.leaveTypes.name",
            "vacation.leaveTypes.balance",
            "vacation.leaveTypes.requiresBalance",
            "vacation.leaveTypes.approval",
            "vacation.leaveTypes.status",
            "vacation.leaveTypes.actions",
        })
        {
            Assert.Contains(column, page);
        }

        // Shared controls and buttons rather than page-local variants.
        Assert.Contains("formPrimaryButtonClassName", page);
        Assert.Contains("formSecondaryButtonClassName", page);
        Assert.Contains("formDangerButtonClassName", page);
        Assert.Contains("selectForDetails", page);
        Assert.Contains("panelMode === \"create\"", page);
        Assert.Contains("panelMode === \"edit\"", page);
        Assert.DoesNotContain("type=\"date\"", page, StringComparison.Ordinal);

        // Safe delete with the canonical localized conflict guidance.
        Assert.Contains("deleteLeaveType", page);
        Assert.Contains("leave_type_delete_conflict", page);
        Assert.Contains("vacation.leaveTypes.deleteReferenced", page);
        Assert.Contains("vacation.leaveTypes.deleteConfirmation", page);

        // Lock hints for the fields the business rules freeze after first use.
        Assert.Contains("formControlClassName", form);
        Assert.Contains("formPrimaryButtonClassName", form);
        Assert.Contains("leaveType?.isInUse", form);
        Assert.Contains("vacation.leaveTypes.form.balanceLocked", form);
        Assert.Contains("vacation.leaveTypes.form.codeReadOnly", form);
        Assert.Contains("disabled={isLocked}", form);
    }

    [Fact]
    public void LeaveTypeAdministration_LocalizesEveryNewKeyInBothLocales()
    {
        var translations = Read("apps", "portal", "src", "i18n", "translations.ts");

        foreach (var pair in new[]
        {
            ("\"vacation.leaveTypes.requiresBalance\": \"Requires balance\"",
             "\"vacation.leaveTypes.requiresBalance\": \"Zahteva saldo\""),
            ("\"vacation.leaveTypes.actions\": \"Actions\"",
             "\"vacation.leaveTypes.actions\": \"Radnje\""),
            ("\"vacation.leaveTypes.delete\": \"Delete\"",
             "\"vacation.leaveTypes.delete\": \"Obriši\""),
            ("\"vacation.leaveTypes.deleteSuccess\": \"Leave type deleted.\"",
             "\"vacation.leaveTypes.deleteSuccess\": \"Vrsta odsustva je obrisana.\""),
        })
        {
            Assert.Contains(pair.Item1, translations);
            Assert.Contains(pair.Item2, translations);
        }

        Assert.Contains("\"vacation.leaveTypes.deleteReferenced\":", translations);
        Assert.Contains("Deactivate it instead", translations);
        Assert.Contains("Deaktivirajte je", translations);
        Assert.Contains("\"vacation.leaveTypes.form.balanceLocked\":", translations);
        Assert.Contains("\"vacation.leaveTypes.validation.balanceLocked\":", translations);
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

    [Fact]
    public void LeavePolicyAdministration_UsesEntitlementTerminologyAndCanonicalControls()
    {
        var page = Read("apps", "portal", "src", "app", "vacation", "admin", "policies", "page.tsx");
        var translations = Read("apps", "portal", "src", "i18n", "translations.ts");

        Assert.Contains("AdministrationPageBody", page);
        Assert.Contains("AdministrativeGridShell", page);
        Assert.Contains("AdministrativeGridToolbar", page);
        Assert.Contains("GridPagination", page);
        Assert.Contains("PortalDateInput", page);
        Assert.Contains("leavePolicy.total", page);
        Assert.Contains("formatAdjustment", page);
        Assert.Contains("ExpiryStatus", page);
        Assert.DoesNotContain("type=\"date\"", page, StringComparison.Ordinal);
        Assert.Contains("\"leavePolicy.title\": \"Annual leave entitlement\"", translations);
        Assert.Contains("\"leavePolicy.title\": \"Godišnje pravo na odmor\"", translations);
        Assert.Contains("\"leavePolicy.total\": \"Total allocated\"", translations);
        Assert.Contains("\"leavePolicy.total\": \"Ukupno raspoloživo\"", translations);
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
