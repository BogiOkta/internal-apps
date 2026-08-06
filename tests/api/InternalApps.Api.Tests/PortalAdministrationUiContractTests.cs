using Xunit;

namespace InternalApps.Api.Tests;

public sealed class PortalAdministrationUiContractTests
{
    [Fact]
    public void MigratedScope_DoesNotUseNativeUserFacingDateInputs()
    {
        foreach (var parts in new[]
        {
            new[] { "apps", "portal", "src", "app", "(company)", "organization", "employees", "page.tsx" },
            new[] { "apps", "portal", "src", "app", "(company)", "organization", "departments", "page.tsx" },
            new[] { "apps", "portal", "src", "app", "(company)", "business-calendar", "admin", "non-working-days", "page.tsx" },
            new[] { "apps", "portal", "src", "features", "vacation", "components", "employee-form.tsx" },
            new[] { "apps", "portal", "src", "features", "organization", "components", "department-form.tsx" },
            new[] { "apps", "portal", "src", "features", "vacation", "components", "admin-record-absence.tsx" },
            new[] { "apps", "portal", "src", "app", "vacation", "admin", "leave-balances", "page.tsx" },
        })
        {
            var source = Read(parts);
            Assert.DoesNotContain("type=\"date\"", source, StringComparison.Ordinal);
            Assert.DoesNotContain("type='date'", source, StringComparison.Ordinal);
        }

        var businessCalendar = Read("apps", "portal", "src", "app", "(company)", "business-calendar",
            "admin", "non-working-days", "page.tsx");
        Assert.Contains("PortalDateInput", businessCalendar);
        Assert.Contains("nullable={false}", businessCalendar);

        var employeeForm = Read("apps", "portal", "src", "features", "vacation",
            "components", "employee-form.tsx");
        Assert.Contains("PortalDateInput", employeeForm);
    }

    [Fact]
    public void PortalFeatureSource_RejectsNativeUserFacingDateInputs()
    {
        // Registry rule: user-facing native date inputs are prohibited outside
        // an explicitly documented shared-component exception. PortalDateInput
        // does not use type="date", so the allowlist is empty by default.
        var root = Path.Combine(RepositoryRoot(), "apps", "portal", "src");
        var violations = new List<string>();
        foreach (var path in Directory.EnumerateFiles(root, "*.*", SearchOption.AllDirectories))
        {
            if (!path.EndsWith(".tsx", StringComparison.OrdinalIgnoreCase) &&
                !path.EndsWith(".ts", StringComparison.OrdinalIgnoreCase) &&
                !path.EndsWith(".jsx", StringComparison.OrdinalIgnoreCase) &&
                !path.EndsWith(".js", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var relative = Path.GetRelativePath(root, path).Replace('\\', '/');
            if (IsApprovedNativeDateInputException(relative))
            {
                continue;
            }

            var source = File.ReadAllText(path);
            if (source.Contains("type=\"date\"", StringComparison.Ordinal) ||
                source.Contains("type='date'", StringComparison.Ordinal))
            {
                violations.Add(relative);
            }
        }

        Assert.True(
            violations.Count == 0,
            "Native user-facing <input type=\"date\"> is prohibited. Use PortalDateInput. Violations: "
            + string.Join(", ", violations));
    }

    private static bool IsApprovedNativeDateInputException(string relativePath)
    {
        // Document exceptions in docs/standards/UI_GUIDELINES.md §1.4 only.
        // No current shared component or feature path is allowed to ship
        // native type="date".
        _ = relativePath;
        return false;
    }

    [Fact]
    public void PortalFeatureSource_RejectsBrowserNativeConfirmAndAlert()
    {
        var violations = ScanPortalSource((relative, source) =>
            source.Contains("window.confirm", StringComparison.Ordinal) ||
            source.Contains("window.alert", StringComparison.Ordinal)
                ? relative
                : null);

        Assert.True(
            violations.Count == 0,
            "window.confirm/window.alert are prohibited. Use ConfirmDialog. Violations: "
            + string.Join(", ", violations));
    }

    [Fact]
    public void PortalFeatureSource_RejectsForbiddenLocalButtonClassConstants()
    {
        var forbidden = new[]
        {
            "export const primaryButtonClass",
            "export const secondaryButtonClass",
            "export const dangerButtonClass",
            "const primaryButtonClass =",
            "const secondaryButtonClass =",
            "const dangerButtonClass =",
            "const inputClass =",
        };

        var violations = ScanPortalSource((relative, source) =>
        {
            if (relative.StartsWith("components/", StringComparison.Ordinal))
            {
                return null;
            }

            return forbidden.Any(token => source.Contains(token, StringComparison.Ordinal))
                ? relative
                : null;
        });

        Assert.True(
            violations.Count == 0,
            "Forbidden local button/input class constants detected. Use form-field helpers. Violations: "
            + string.Join(", ", violations));
    }

    [Fact]
    public void PortalFeatureSource_RejectsFeatureLocalDateDisplayFormatters()
    {
        var allowlist = new HashSet<string>(StringComparer.Ordinal)
        {
            "utils/portal-date-format.ts",
            "components/portal-date-input.tsx",
            "components/portal-date-utils.ts",
            "components/date-range/date-range-picker.tsx",
            "components/calendar/calendar-utils.ts",
            "components/calendar/app-calendar.tsx",
            "app/demo/calendar/page.tsx",
            "i18n/translations.ts",
        };

        var violations = ScanPortalSource((relative, source) =>
        {
            if (allowlist.Contains(relative))
            {
                return null;
            }

            if (source.Contains("toLocaleDateString", StringComparison.Ordinal) ||
                source.Contains("toLocaleString(", StringComparison.Ordinal))
            {
                return relative;
            }

            return null;
        });

        Assert.True(
            violations.Count == 0,
            "Feature-local date display formatting is prohibited. Use formatPortalDate/formatPortalDateTime. Violations: "
            + string.Join(", ", violations));
    }

    [Fact]
    public void PortalFeatureSource_RejectsFeatureSpecificCopiesOfCanonicalControls()
    {
        // Known naming patterns for prohibited module-prefixed duplicates of
        // Portal platform controls. Document exceptions in UI_GUIDELINES §1.4.
        var prohibitedSymbols = new[]
        {
            "function VacationDateInput",
            "function HrDateInput",
            "function WmsDateInput",
            "export function VacationDateInput",
            "export function HrDateInput",
            "export function WmsDateInput",
            "export function ConfirmDialog",
            "export function DependencyInspector",
            "export function StatusBadge",
            "export function PortalDateInput",
            "export function DateRangePicker",
            "export function FormField",
            "export function GridPagination",
            "export function AdministrativeGridShell",
            "export function AdministrativeGridToolbar",
            "export function SearchableCombobox",
            "export function PortalSectionHeader",
            "export function WorkspaceNavigation",
            "export function PortalActionIcon",
            "export function PortalNotification",
            "export function PortalNotificationHost",
        };

        var canonicalOwners = new HashSet<string>(StringComparer.Ordinal)
        {
            "components/confirm-dialog.tsx",
            "components/dependency-inspector.tsx",
            "components/status-badge.tsx",
            "components/portal-date-input.tsx",
            "components/date-range/date-range-picker.tsx",
            "components/date-range/index.ts",
            "components/form-field.tsx",
            "components/grid-pagination.tsx",
            "components/admin-data-grid.tsx",
            "components/administrative-grid-toolbar.tsx",
            "components/searchable-combobox.tsx",
            "components/portal-section-header.tsx",
            "components/workspace-navigation.tsx",
            "components/portal-action-icon.tsx",
            "components/portal-notification.tsx",
            "components/portal-notification-host.tsx",
        };

        var filenamePatterns = new[]
        {
            "date-input",
            "confirm-dialog",
            "dependency-inspector",
            "portal-date",
            "date-range-picker",
            "status-badge",
            "grid-pagination",
            "searchable-combobox",
            "section-header",
            "workspace-navigation",
            "portal-action-icon",
            "portal-notification",
        };

        var filenameAllowlist = new HashSet<string>(StringComparer.Ordinal)
        {
            // Domain leave-request status vocabulary; documented §1.4 exception.
            "features/vacation/components/vacation-status-badge.tsx",
        };

        var violations = ScanPortalSource((relative, source) =>
        {
            if (canonicalOwners.Contains(relative))
            {
                return null;
            }

            if (filenameAllowlist.Contains(relative))
            {
                return null;
            }

            var fileName = Path.GetFileNameWithoutExtension(relative).ToLowerInvariant();
            if ((relative.StartsWith("features/", StringComparison.Ordinal) ||
                 relative.StartsWith("app/", StringComparison.Ordinal)) &&
                filenamePatterns.Any(pattern => fileName.Contains(pattern, StringComparison.Ordinal)))
            {
                return relative + " (filename)";
            }

            foreach (var symbol in prohibitedSymbols)
            {
                if (source.Contains(symbol, StringComparison.Ordinal))
                {
                    return relative + $" ({symbol})";
                }
            }

            return null;
        });

        Assert.True(
            violations.Count == 0,
            "Feature-specific copies of canonical Portal controls are prohibited. Violations: "
            + string.Join(", ", violations));
    }

    [Fact]
    public void SharedControls_LiveUnderPortalComponentsOwnership()
    {
        foreach (var relative in new[]
        {
            "components/confirm-dialog.tsx",
            "components/status-badge.tsx",
            "components/portal-date-input.tsx",
            "components/form-field.tsx",
            "components/grid-pagination.tsx",
            "components/searchable-combobox.tsx",
            "components/portal-section-header.tsx",
            "components/workspace-navigation.tsx",
            "components/portal-action-icon.tsx",
            "components/portal-notification.tsx",
            "components/portal-notification-host.tsx",
        })
        {
            var parts = relative.Split('/');
            var source = Read(["apps", "portal", "src", .. parts]);
            Assert.StartsWith("components/", relative, StringComparison.Ordinal);
            Assert.Contains("export function", source);
        }

        Assert.True(File.Exists(Path.Combine(RepositoryRoot(), "apps", "portal", "src",
            "utils", "portal-date-format.ts")));
    }

    [Fact]
    public void ConfirmDialog_IsCanonicalSharedConfirmationControl()
    {
        var dialog = Read("apps", "portal", "src", "components", "confirm-dialog.tsx");
        Assert.Contains("export function ConfirmDialog", dialog);
        Assert.Contains("formDangerSolidButtonClassName", dialog);
        Assert.Contains("formPrimaryButtonClassName", dialog);
        Assert.Contains("formSecondaryButtonClassName", dialog);

        foreach (var parts in new[]
        {
            new[] { "apps", "portal", "src", "app", "(company)", "business-calendar", "admin", "non-working-days", "page.tsx" },
            new[] { "apps", "portal", "src", "app", "vacation", "admin", "policies", "page.tsx" },
            new[] { "apps", "portal", "src", "app", "(company)", "organization", "departments", "page.tsx" },
            new[] { "apps", "portal", "src", "app", "vacation", "leave-types", "page.tsx" },
        })
        {
            var source = Read(parts);
            Assert.Contains("ConfirmDialog", source);
            Assert.DoesNotContain("window.confirm", source, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void DependencyInspector_IsCanonicalSharedDependencyDialog()
    {
        var dialog = Read("apps", "portal", "src", "components", "dependency-inspector.tsx");
        Assert.Contains("export function DependencyInspector", dialog);
        Assert.Contains("formPrimaryButtonClassName", dialog);
        Assert.Contains("formSecondaryButtonClassName", dialog);
        Assert.Contains("role=\"alertdialog\"", dialog);
        Assert.DoesNotContain("Delete anyway", dialog, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("setTimeout", dialog);

        var leaveTypes = Read("apps", "portal", "src", "app", "vacation", "leave-types", "page.tsx");
        Assert.Contains("DependencyInspector", leaveTypes);
        Assert.Contains("getLeaveTypeDependencies", leaveTypes);
        Assert.Contains("@/components/dependency-inspector", leaveTypes);

        var helper = Read("apps", "portal", "src", "features", "vacation",
            "leave-type-dependency-mapping.ts");
        Assert.Contains("toLeaveTypeDependencyGroups", helper);
        Assert.Contains("leaveTypeDependencyNavigationActions", helper);
        Assert.Contains("buildLeaveTypeDependencyHref", helper);
        Assert.Contains("historical_ledger_records", helper);

        var requestList = Read("apps", "portal", "src", "features", "vacation",
            "components", "admin-vacation-request-list.tsx");
        Assert.Contains("leaveTypeIdParam", requestList);
        Assert.Contains("window.location.search", requestList);

        var balances = Read("apps", "portal", "src", "app", "vacation", "admin",
            "leave-balances", "page.tsx");
        Assert.Contains("leaveTypeIdParam", balances);
        Assert.Contains("window.location.search", balances);
    }

    [Fact]
    public void MigratedAdministrationPages_UseGridPaginationNotAdHocFooters()
    {
        foreach (var parts in new[]
        {
            new[] { "apps", "portal", "src", "app", "(company)", "organization", "employees", "page.tsx" },
            new[] { "apps", "portal", "src", "app", "(company)", "organization", "departments", "page.tsx" },
            new[] { "apps", "portal", "src", "app", "identity", "users", "page.tsx" },
            new[] { "apps", "portal", "src", "app", "(company)", "organization", "user-employee-links", "page.tsx" },
            new[] { "apps", "portal", "src", "app", "vacation", "leave-types", "page.tsx" },
            new[] { "apps", "portal", "src", "app", "vacation", "admin", "policies", "page.tsx" },
            new[] { "apps", "portal", "src", "app", "vacation", "admin", "leave-balances", "page.tsx" },
            new[] { "apps", "portal", "src", "features", "vacation", "components", "admin-vacation-request-list.tsx" },
        })
        {
            var source = Read(parts);
            Assert.Contains("GridPagination", source);
            Assert.DoesNotContain("GridFooter", source);
        }
    }

    private static List<string> ScanPortalSource(Func<string, string, string?> match)
    {
        var root = Path.Combine(RepositoryRoot(), "apps", "portal", "src");
        var violations = new List<string>();
        foreach (var path in Directory.EnumerateFiles(root, "*.*", SearchOption.AllDirectories))
        {
            if (!path.EndsWith(".tsx", StringComparison.OrdinalIgnoreCase) &&
                !path.EndsWith(".ts", StringComparison.OrdinalIgnoreCase) &&
                !path.EndsWith(".jsx", StringComparison.OrdinalIgnoreCase) &&
                !path.EndsWith(".js", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var relative = Path.GetRelativePath(root, path).Replace('\\', '/');
            var hit = match(relative, File.ReadAllText(path));
            if (hit is not null)
            {
                violations.Add(hit);
            }
        }

        return violations;
    }

    [Fact]
    public void TabbedVacationScreens_UseCanonicalActiveSectionHeader()
    {
        // Vacation IA pilot: capability tabs moved to the sidebar. PortalSectionHeader
        // remains the page header (h1 via asPageTitle) and still owns page actions.
        var sectionHeader = Read("apps", "portal", "src", "components",
            "portal-section-header.tsx");
        Assert.Contains("export function PortalSectionHeader", sectionHeader);
        Assert.Contains("asPageTitle", sectionHeader);
        Assert.Contains("secondaryActions", sectionHeader);

        var workspace = Read("apps", "portal", "src", "features", "vacation",
            "components", "vacation-workspace.tsx");
        var vacationShell = Read("apps", "portal", "src", "features", "vacation",
            "components", "vacation-shell.tsx");
        Assert.Contains("PortalSectionHeader", workspace);
        Assert.Contains("asPageTitle", workspace);
        Assert.Contains("layoutMode=\"workspace\"", vacationShell);
        Assert.DoesNotContain("WorkspaceNavigation", workspace);
        Assert.Contains("sectionActions", workspace);
        Assert.DoesNotContain("headerActions", workspace);
        Assert.DoesNotContain("commandBar", workspace);

        // Known page-specific actions and their owning screens.
        var requests = Read("apps", "portal", "src", "app", "vacation",
            "requests", "page.tsx");
        Assert.Contains("sectionActions", requests);
        Assert.Contains("vacation.employeePortal.newRequest", requests);

        var leaveTypes = Read("apps", "portal", "src", "app", "vacation",
            "leave-types", "page.tsx");
        Assert.Contains("sectionActions", leaveTypes);
        Assert.Contains("vacation.leaveTypes.new", leaveTypes);
        Assert.Contains("sectionSecondaryActions", leaveTypes);
        Assert.Contains("vacation.leaveTypes.refresh", leaveTypes);

        var adminList = Read("apps", "portal", "src", "features", "vacation",
            "components", "admin-vacation-request-list.tsx");
        Assert.Contains("sectionActions", adminList);
        Assert.Contains("vacation.admin.record", adminList);
        Assert.Contains("sectionSecondaryActions", adminList);
        Assert.Contains("vacation.admin.refresh", adminList);

        var policies = Read("apps", "portal", "src", "app", "vacation",
            "admin", "policies", "page.tsx");
        Assert.Contains("sectionActions", policies);
        Assert.Contains("leavePolicy.new", policies);
        Assert.Contains("sectionSecondaryActions", policies);

        var leaveBalances = Read("apps", "portal", "src", "app", "vacation",
            "admin", "leave-balances", "page.tsx");
        Assert.Contains("sectionActions", leaveBalances);
        Assert.Contains("leaveBalance.load", leaveBalances);
        Assert.Contains("sectionSecondaryActions", leaveBalances);
        Assert.Contains("leaveBalance.refresh", leaveBalances);

        var dashboard = Read("apps", "portal", "src", "features", "vacation",
            "components", "employee-vacation-dashboard.tsx");
        Assert.Contains("sectionActions", dashboard);

        // No Vacation tabbed screen may route actions to the module header
        // or resurrect a command band above the tabs.
        foreach (var source in new[]
        {
            requests, leaveTypes, adminList, policies, leaveBalances, dashboard,
            Read("apps", "portal", "src", "app", "vacation", "requests",
                "new", "page.tsx"),
            Read("apps", "portal", "src", "features", "vacation",
                "components", "admin-record-absence.tsx"),
            Read("apps", "portal", "src", "features", "vacation",
                "components", "admin-vacation-request-details.tsx"),
        })
        {
            Assert.DoesNotContain("headerActions", source);
            Assert.DoesNotContain("commandBar", source);
        }
    }

    [Fact]
    public void PortalTabNavigation_UsesCanonicalWorkspaceNavigation()
    {
        var tabs = Read("apps", "portal", "src", "components", "workspace-navigation.tsx");
        Assert.Contains("export function WorkspaceNavigation", tabs);
        Assert.Contains("font-semibold", tabs);
        Assert.Contains("font-medium", tabs);
        Assert.Contains("before:w-[3px]", tabs);
        Assert.Contains("before:rounded-[2px]", tabs);
        Assert.Contains("showLeadingSeparator", tabs);
        Assert.Contains("border-b-2", tabs);
        Assert.Contains("aria-current", tabs);
        Assert.Contains("dark:", tabs);

        var workspace = Read("apps", "portal", "src", "features", "vacation",
            "components", "vacation-workspace.tsx");
        Assert.DoesNotContain("WorkspaceNavigation", workspace);

        // Feature pages must not recreate inter-tab separator chrome.
        var violations = ScanPortalSource((relative, source) =>
        {
            if (relative == "components/workspace-navigation.tsx")
            {
                return null;
            }

            if (!relative.StartsWith("app/", StringComparison.Ordinal) &&
                !relative.StartsWith("features/", StringComparison.Ordinal))
            {
                return null;
            }

            return source.Contains("before:w-[3px]", StringComparison.Ordinal) ||
                   source.Contains("before:w-px", StringComparison.Ordinal)
                ? relative
                : null;
        });

        Assert.True(
            violations.Count == 0,
            "Feature-local tab separator styling is prohibited. Use WorkspaceNavigation. Violations: "
            + string.Join(", ", violations));
    }

    [Fact]
    public void PortalActionIcons_UseCanonicalSharedMapping()
    {
        var icons = Read("apps", "portal", "src", "components", "portal-action-icon.tsx");
        Assert.Contains("export function PortalActionIcon", icons);
        Assert.Contains("export function portalActionContent", icons);
        Assert.Contains("\"create\"", icons);
        Assert.Contains("\"refresh\"", icons);
        Assert.Contains("\"export\"", icons);
        Assert.Contains("\"delete\"", icons);
        Assert.Contains("aria-hidden", icons);

        var createConsumers = new[]
        {
            Read("apps", "portal", "src", "app", "vacation", "requests", "page.tsx"),
            Read("apps", "portal", "src", "app", "vacation", "leave-types", "page.tsx"),
            Read("apps", "portal", "src", "features", "vacation",
                "components", "admin-vacation-request-list.tsx"),
            Read("apps", "portal", "src", "app", "vacation", "admin", "policies", "page.tsx"),
            Read("apps", "portal", "src", "app", "(company)", "organization", "departments", "page.tsx"),
            Read("apps", "portal", "src", "app", "(company)", "organization", "employees", "page.tsx"),
            Read("apps", "portal", "src", "app", "identity", "users", "page.tsx"),
            Read("apps", "portal", "src", "app", "(company)", "organization", "user-employee-links", "page.tsx"),
            Read("apps", "portal", "src", "app", "(company)", "business-calendar", "admin",
                "non-working-days", "page.tsx"),
        };

        foreach (var source in createConsumers)
        {
            Assert.Contains("portalActionContent", source);
            Assert.Contains("\"create\"", source);
        }

        var refreshConsumers = new[]
        {
            Read("apps", "portal", "src", "app", "vacation", "leave-types", "page.tsx"),
            Read("apps", "portal", "src", "app", "vacation", "admin", "policies", "page.tsx"),
            Read("apps", "portal", "src", "features", "vacation",
                "components", "admin-vacation-request-list.tsx"),
            Read("apps", "portal", "src", "app", "(company)", "organization", "departments", "page.tsx"),
            Read("apps", "portal", "src", "app", "(company)", "organization", "employees", "page.tsx"),
            Read("apps", "portal", "src", "app", "identity", "users", "page.tsx"),
            Read("apps", "portal", "src", "app", "(company)", "organization", "user-employee-links", "page.tsx"),
            Read("apps", "portal", "src", "app", "(company)", "business-calendar", "admin",
                "non-working-days", "page.tsx"),
        };

        foreach (var source in refreshConsumers)
        {
            Assert.Contains("portalActionContent", source);
            Assert.Contains("\"refresh\"", source);
        }

        var toolbar = Read("apps", "portal", "src", "components", "admin-data-grid.tsx");
        Assert.Contains("PortalActionIcon kind=\"export\"", toolbar);
        Assert.DoesNotContain("function PlusIcon", Read("apps", "portal", "src", "app",
            "(company)", "organization", "employees", "page.tsx"));
    }

    [Fact]
    public void PortalOperationNotifications_UseStableTopCenterHostOnVacation()
    {
        var notification = Read("apps", "portal", "src", "components",
            "portal-notification.tsx");
        Assert.Contains("export function PortalNotification", notification);
        Assert.Contains("PORTAL_NOTIFICATION_DEFAULT_DURATION_MS", notification);
        Assert.Contains("success: 5000", notification);
        Assert.Contains("info: 6000", notification);
        Assert.Contains("warning: 8000", notification);
        Assert.Contains("error: 10000", notification);
        Assert.Contains("aria-live", notification);
        Assert.Contains("aria-label={dismissLabel}", notification);
        Assert.Contains("prefers-reduced-motion", notification);
        Assert.Contains("success", notification);
        Assert.Contains("warning", notification);
        Assert.Contains("error", notification);
        Assert.Contains("info", notification);
        // X-only dismiss: no text Close / secondary button chrome inside the card.
        Assert.DoesNotContain("formSecondaryButtonClassName", notification);
        Assert.DoesNotContain(">Close<", notification);
        Assert.DoesNotContain(">Zatvori<", notification);
        Assert.Contains("<DismissGlyph", notification);

        var host = Read("apps", "portal", "src", "components",
            "portal-notification-host.tsx");
        Assert.Contains("export function PortalNotificationHost", host);
        Assert.Contains("data-portal-notification-host", host);
        Assert.Contains("lg:left-[240px]", host);
        Assert.Contains("max-w-[560px]", host);
        Assert.Contains("fixed", host);
        Assert.Contains("z-30", host);
        Assert.DoesNotContain("z-40", host);
        Assert.Contains("lg:top-[7.5rem]", host);
        Assert.DoesNotContain("bottom-", host);

        var shell = Read("apps", "portal", "src", "components", "admin-data-grid.tsx");
        Assert.Contains("detailsNotification", shell);

        var confirm = Read("apps", "portal", "src", "components", "confirm-dialog.tsx");
        Assert.Contains("export function ConfirmDialog", confirm);
        Assert.DoesNotContain("setTimeout", confirm);
        Assert.DoesNotContain("PORTAL_NOTIFICATION_DEFAULT_DURATION_MS", confirm);
        Assert.Contains("formDangerSolidButtonClassName", confirm);

        var migratedHostPages = new[]
        {
            "apps/portal/src/app/vacation/leave-types/page.tsx",
            "apps/portal/src/app/vacation/admin/policies/page.tsx",
            "apps/portal/src/app/vacation/admin/leave-balances/page.tsx",
            "apps/portal/src/features/vacation/components/admin-vacation-request-list.tsx",
            "apps/portal/src/features/vacation/components/admin-vacation-request-details.tsx",
            "apps/portal/src/features/vacation/components/admin-record-absence.tsx",
            "apps/portal/src/app/(company)/organization/departments/page.tsx",
            "apps/portal/src/app/(company)/organization/employees/page.tsx",
            "apps/portal/src/app/(company)/organization/user-employee-links/page.tsx",
            "apps/portal/src/app/(company)/business-calendar/admin/non-working-days/page.tsx",
            "apps/portal/src/app/identity/users/page.tsx",
        };

        foreach (var relative in migratedHostPages)
        {
            var source = Read(relative.Split('/'));
            Assert.Contains("PortalNotification", source);
            Assert.Contains("PortalNotificationHost", source);
            Assert.DoesNotContain("detailsNotification", source);

            // No layout-shifting operation banners on migrated workspace surfaces.
            Assert.DoesNotContain(
                "mb-4 rounded-md border border-emerald-300 bg-emerald-50", source);
            Assert.DoesNotContain(
                "mb-4 rounded-md border border-red-300 bg-red-50", source);
            Assert.DoesNotContain(
                "mb-4 rounded border border-emerald-300 bg-emerald-50", source);
            Assert.DoesNotContain(
                "mb-4 rounded border border-red-300 bg-red-50", source);

            // No feature-local dismiss timers for operation notifications.
            Assert.DoesNotContain("setTimeout(() => setFeedback(null)", source);
            Assert.DoesNotContain("setTimeout(() => setSuccessMessage(null)", source);
            Assert.DoesNotContain("setTimeout(() => setOperationError(null)", source);
            Assert.DoesNotContain("setTimeout(() => setSuccess(null)", source);
            Assert.DoesNotContain("setTimeout(() => setError(null)", source);
            Assert.DoesNotContain("setTimeout(() => setExportError(false)", source);
            Assert.DoesNotContain("setTimeout(() => setExportError(null)", source);
        }
    }

    [Fact]
    public void PortalNotification_RemainsOwnedUnderSharedComponents()
    {
        var root = Path.Combine(RepositoryRoot(), "apps", "portal", "src");
        var owners = Directory.EnumerateFiles(root, "portal-notification.tsx",
                SearchOption.AllDirectories)
            .Select(path => Path.GetRelativePath(root, path).Replace('\\', '/'))
            .ToArray();

        Assert.Equal(
            new[] { "components/portal-notification.tsx" },
            owners);

        var hostOwners = Directory.EnumerateFiles(root, "portal-notification-host.tsx",
                SearchOption.AllDirectories)
            .Select(path => Path.GetRelativePath(root, path).Replace('\\', '/'))
            .ToArray();
        Assert.Equal(
            new[] { "components/portal-notification-host.tsx" },
            hostOwners);

        var confirmOwners = Directory.EnumerateFiles(root, "confirm-dialog.tsx",
                SearchOption.AllDirectories)
            .Select(path => Path.GetRelativePath(root, path).Replace('\\', '/'))
            .ToArray();
        Assert.Equal(
            new[] { "components/confirm-dialog.tsx" },
            confirmOwners);
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
        var employees = Read("apps", "portal", "src", "app", "(company)", "organization", "employees", "page.tsx");
        var departments = Read("apps", "portal", "src", "app", "(company)", "organization", "departments", "page.tsx");
        var users = Read("apps", "portal", "src", "app", "identity", "users", "page.tsx");
        var links = Read("apps", "portal", "src", "app", "(company)", "organization", "user-employee-links", "page.tsx");
        var leaveTypes = Read("apps", "portal", "src", "app", "vacation", "leave-types", "page.tsx");

        foreach (var page in new[] { employees, departments, users, links, leaveTypes })
        {
            Assert.Contains("AdministrationPageBody", page);
            Assert.Contains("AdministrativeGridShell", page);
            Assert.Contains("fillViewport", page);
            Assert.Contains("AdministrativeGridToolbar", page);
            Assert.Contains("GridPagination", page);
            Assert.Contains("contentFillsViewport", page);
            Assert.DoesNotContain("GridFooter", page);
        }

        // Organization and Identity workspace pages use page-header sectionActions.
        foreach (var page in new[] { employees, departments, links })
        {
            Assert.Contains("sectionActions", page);
            Assert.Contains("OrganizationWorkspace", page);
            Assert.DoesNotContain("headerActions", page);
        }

        Assert.Contains("sectionActions", users);
        Assert.Contains("IdentityWorkspace", users);
        Assert.Contains("PortalNotificationHost", users);
        Assert.DoesNotContain("headerActions", users);
        Assert.DoesNotContain("CompanyAdministrationWorkspace", users);
        Assert.DoesNotContain("detailsNotification", users);

        Assert.Contains("sectionActions", leaveTypes);
        Assert.DoesNotContain("headerActions", leaveTypes);
    }

    [Fact]
    public void IdentityAdministration_PreservesShellGeometryStates()
    {
        var users = Read("apps", "portal", "src", "app", "identity", "users", "page.tsx");
        Assert.Contains("IdentityWorkspace", users);
        Assert.Contains("PortalNotificationHost", users);
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
        Assert.DoesNotContain("detailsNotification", users);
        Assert.DoesNotContain("CompanyAdministrationWorkspace", users);
    }

    [Fact]
    public void UserEmployeeLinksAdministration_PreservesShellGeometryStates()
    {
        var links = Read("apps", "portal", "src", "app", "(company)", "organization", "user-employee-links", "page.tsx");
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
        var page = Read("apps", "portal", "src", "app", "(company)", "organization", "departments", "page.tsx");
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
        Assert.Contains("sectionActions", page);
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

        // Safe delete opens the shared Dependency Inspector instead of a toast-only conflict.
        Assert.Contains("deleteLeaveType", page);
        Assert.Contains("getLeaveTypeDependencies", page);
        Assert.Contains("leaveTypesDeletePermission", page);
        Assert.Contains("leave_type_delete_conflict", page);
        Assert.Contains("leave_type_system_protected", page);
        Assert.Contains("vacation.leaveTypes.deleteConfirmation", page);
        Assert.Contains("DependencyInspector", page);
        Assert.Contains("toLeaveTypeDependencyGroups", page);
        Assert.Contains("leaveTypeDependencyNavigationActions", page);
        Assert.DoesNotContain("Delete anyway", page, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("unprotected delete bypass", page, StringComparison.OrdinalIgnoreCase);

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
        Assert.Contains("\"vacation.leaveTypes.dependencyInspector.title\":", translations);
        Assert.Contains("This Leave Type cannot be deleted.", translations);
        Assert.Contains("Ova vrsta odsustva ne može se obrisati.", translations);
        Assert.Contains("\"vacation.leaveTypes.dependencyInspector.historicalLedger\":", translations);
        Assert.Contains("Historical ledger records exist.", translations);
        Assert.Contains("\"vacation.leaveTypes.form.balanceLocked\":", translations);
        Assert.Contains("\"vacation.leaveTypes.validation.balanceLocked\":", translations);
    }

    [Fact]
    public void BusinessCalendarAdministration_UsesCanonicalChrome()
    {
        var page = Read("apps", "portal", "src", "app", "(company)", "business-calendar",
            "admin", "non-working-days", "page.tsx");
        Assert.Contains("OrganizationWorkspace", page);
        Assert.Contains("PortalNotificationHost", page);
        Assert.Contains("sectionActions", page);
        Assert.Contains("PortalDateInput", page);
        Assert.Contains("formControlClassName", page);
        Assert.Contains("formPrimaryButtonClassName", page);
        Assert.Contains("rounded-xl border border-slate-300", page);
        Assert.DoesNotContain("type=\"date\"", page);
        Assert.DoesNotContain("CompanyAdministrationWorkspace", page);
        Assert.DoesNotContain("detailsNotification", page);
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

    [Fact]
    public void LeaveBalanceAdministration_UsesCanonicalShellAndPreservesLedgerBehavior()
    {
        var page = Read("apps", "portal", "src", "app", "vacation", "admin",
            "leave-balances", "page.tsx");
        var translations = Read("apps", "portal", "src", "i18n", "translations.ts");

        Assert.Contains("AdministrationPageBody", page);
        Assert.Contains("AdministrativeGridShell", page);
        Assert.Contains("AdministrativeGridToolbar", page);
        Assert.Contains("GridPagination", page);
        Assert.Contains("GridStateRows", page);
        Assert.Contains("fillViewport", page);
        Assert.Contains("contentFillsViewport", page);
        Assert.Contains("PortalDateInput", page);
        Assert.Contains("PortalNotification", page);
        Assert.Contains("PortalNotificationHost", page);
        Assert.DoesNotContain("detailsNotification", page);
        Assert.Contains("portalActionContent", page);
        Assert.Contains("sectionActions", page);
        Assert.Contains("sectionSecondaryActions", page);
        Assert.DoesNotContain("GridFooter", page);
        Assert.DoesNotContain("headerActions", page);
        Assert.DoesNotContain("type=\"date\"", page, StringComparison.Ordinal);

        // Existing ledger behavior remains page-owned.
        Assert.Contains("includes(leaveBalanceManagePermission)", page);
        Assert.Contains("form.quantityDays * 2", page);
        Assert.Contains("form.effectiveDate.slice(0, 4)", page);
        Assert.Contains("changeScope({ ...scope", page);
        Assert.Contains("setLoaded(false)", page);
        Assert.DoesNotContain("chart", page, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(".csv", page, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("projection", page, StringComparison.OrdinalIgnoreCase);

        Assert.Contains("\"leaveBalance.refresh\": \"Refresh\"", translations);
        Assert.Contains("\"leaveBalance.refresh\": \"Osveži\"", translations);
        Assert.Contains("\"leaveBalance.tableLabel\":", translations);
        Assert.Contains("\"leaveBalance.selectScope\":", translations);
    }

    [Fact]
    public void VacationRequestAdministration_UsesCanonicalShellAndPreservesWorkflowNavigation()
    {
        var list = Read("apps", "portal", "src", "features", "vacation",
            "components", "admin-vacation-request-list.tsx");
        var details = Read("apps", "portal", "src", "features", "vacation",
            "components", "admin-vacation-request-details.tsx");
        var translations = Read("apps", "portal", "src", "i18n", "translations.ts");

        Assert.Contains("AdministrationPageBody", list);
        Assert.Contains("AdministrativeGridShell", list);
        Assert.Contains("AdministrativeGridToolbar", list);
        Assert.Contains("GridPagination", list);
        Assert.Contains("GridStateRows", list);
        Assert.Contains("fillViewport", list);
        Assert.Contains("contentFillsViewport", list);
        Assert.Contains("PortalNotification", list);
        Assert.Contains("PortalNotificationHost", list);
        Assert.DoesNotContain("detailsNotification", list);
        Assert.Contains("portalActionContent", list);
        Assert.Contains("sectionActions", list);
        Assert.Contains("sectionSecondaryActions", list);
        Assert.Contains("VacationStatusBadge", list);
        Assert.DoesNotContain("GridFooter", list);
        Assert.DoesNotContain("headerActions", list);
        Assert.DoesNotContain("pageSize = 25", list);
        Assert.DoesNotContain("type=\"date\"", list, StringComparison.Ordinal);

        // Server-backed filters and paging remain; workflow actions stay on details.
        Assert.Contains("includes(vacationRequestsManagePermission)", list);
        Assert.Contains("listAdminVacationRequests", list);
        Assert.Contains("pageSize", list);
        Assert.Contains("requests/record", list);
        Assert.Contains("/vacation/admin/requests/${request.publicId}", list);
        Assert.Contains("ConfirmDialog", details);
        Assert.Contains("PortalNotification", details);
        Assert.Contains("PortalNotificationHost", details);
        Assert.DoesNotContain("detailsNotification", details);
        Assert.DoesNotContain(
            "mb-4 rounded-md border border-emerald-300 bg-emerald-50", details);
        Assert.Contains("approveAdminVacationRequest", details);
        Assert.Contains("rejectAdminVacationRequest", details);
        Assert.Contains("cancelAdminVacationRequest", details);
        Assert.Contains("deleteAdminVacationRequest", details);
        Assert.Contains("vacationRequestsDeletePermission", details);
        Assert.Contains("formDangerButtonClassName", details);
        Assert.Contains("VACATION_REQUEST_DELETED_NOTICE_KEY", list);
        Assert.Contains("vacation.admin.action.delete.success", list);

        Assert.Contains("\"vacation.admin.refresh\": \"Refresh\"", translations);
        Assert.Contains("\"vacation.admin.refresh\": \"Osveži\"", translations);
        Assert.Contains("\"vacation.admin.tableLabel\":", translations);
        Assert.Contains("\"vacation.admin.selectForDetails\":", translations);
        Assert.Contains("\"vacation.admin.emptyDescription\":", translations);
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
