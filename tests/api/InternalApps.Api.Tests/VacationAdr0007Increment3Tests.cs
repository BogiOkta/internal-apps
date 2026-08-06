using InternalApps.Api.Modules.Vacation;
using Xunit;

namespace InternalApps.Api.Tests;

public sealed class VacationAdr0007Increment3Tests
{
    [Fact]
    public void RequestDeleteEndpoint_DeclaresDedicatedPermissionAndCommandRoute()
    {
        var endpoints = Read("apps", "api", "src", "Api", "Modules", "Vacation",
            "LeaveRequestEndpoints.cs");
        var service = Read("apps", "api", "src", "Api", "Modules", "Vacation",
            "LeaveRequestService.cs");
        var models = Read("apps", "api", "src", "Api", "Modules", "Vacation",
            "LeaveRequestModels.cs");
        var repository = Read("apps", "api", "src", "Api", "Modules", "Vacation",
            "LeaveRequestsRepository.cs");
        var permissions = Read("apps", "api", "src", "Api", "Modules", "Vacation",
            "VacationPermissions.cs");
        var program = Read("apps", "api", "src", "Api", "Program.cs");

        Assert.Equal("vacation.requests.delete", VacationPermissions.DeleteRequests);
        Assert.Contains("\"vacation.requests.delete\"", permissions);
        Assert.Contains("VacationPermissions.DeleteRequests", program);
        Assert.Contains(
            "MapPost(\"/requests/{requestId:guid}/delete\", DeleteAsync)",
            endpoints);
        Assert.Contains(
            "RequireAuthorization(VacationPermissions.DeleteRequests)",
            endpoints);
        Assert.DoesNotContain(
            ".RequireAuthorization(VacationPermissions.ManageRequests);\r\n        group.MapPost(\"/requests/{requestId:guid}/delete\"",
            endpoints.Replace("\r\n", "\n"));
        Assert.DoesNotContain(
            ".RequireAuthorization(VacationPermissions.ManageRequests);\n        group.MapPost(\"/requests/{requestId:guid}/delete\"",
            endpoints.Replace("\r\n", "\n"));

        Assert.Contains("DeleteLeaveRequestRequest", models);
        Assert.Contains("vacation.delete_neutralized_leave_request(@PublicId)", repository);
        Assert.Contains("vacation.request.delete", service);
        Assert.Contains("vacation_request", service);
        Assert.Contains("leave_request_delete_conflict:v1:", service);
        Assert.Contains("non_terminal_status", service);
        Assert.Contains("ledger_effect_not_zero", service);
        Assert.Contains("protected_dependency", service);
        Assert.Contains("vacation_request_not_terminal", endpoints);
        Assert.Contains("vacation_request_ledger_effect_not_zero", endpoints);
        Assert.Contains("vacation_request_delete_conflict", endpoints);
        Assert.Contains("Results.NoContent()", endpoints);
        Assert.Contains("[\"reason\"]", service);
        Assert.Contains("DeleteReasonMaxLength", service);
    }

    [Fact]
    public void LeaveTypeDeleteEndpoint_UsesDedicatedDeletePermission()
    {
        var endpoints = Read("apps", "api", "src", "Api", "Modules", "Vacation",
            "VacationEndpoints.cs");

        Assert.Equal("vacation.leave-types.delete", VacationPermissions.DeleteLeaveTypes);
        Assert.Contains(
            "MapDelete(\"/leave-types/{publicId:guid}\", DeleteLeaveTypeAsync)",
            endpoints);
        Assert.Contains(
            "RequireAuthorization(VacationPermissions.DeleteLeaveTypes)",
            endpoints);
        Assert.Contains("leave_type_system_protected", endpoints);
        Assert.Contains("leave_type_delete_conflict", endpoints);
        Assert.Contains("IsSystemLeaveTypeProtection", endpoints);
    }

    [Fact]
    public void Portal_RequestDeleteUsesDedicatedPermissionConfirmDialogAndNotification()
    {
        var details = Read("apps", "portal", "src", "features", "vacation",
            "components", "admin-vacation-request-details.tsx");
        var list = Read("apps", "portal", "src", "features", "vacation",
            "components", "admin-vacation-request-list.tsx");
        var types = Read("apps", "portal", "src", "types", "vacation.ts");
        var service = Read("apps", "portal", "src", "services", "vacation.ts");
        var leaveTypes = Read("apps", "portal", "src", "app", "vacation",
            "leave-types", "page.tsx");
        var translations = Read("apps", "portal", "src", "i18n", "translations.ts");
        var problems = Read("apps", "portal", "src", "features", "vacation",
            "vacation-request-utils.ts");

        Assert.Contains("vacation.requests.delete", types);
        Assert.Contains("vacation.leave-types.delete", types);
        Assert.Contains("vacationRequestsDeletePermission", details);
        Assert.Contains("deleteAdminVacationRequest", details);
        Assert.Contains("deleteAdminVacationRequest", service);
        Assert.Contains("/delete", service);
        Assert.Contains("ConfirmDialog", details);
        Assert.Contains("confirmDisabled={deleteReason.trim().length < 1", details);
        Assert.Contains("destructive", details);
        Assert.Contains("REJECTED", details);
        Assert.Contains("CANCELLED", details);
        Assert.DoesNotContain("status === \"SUBMITTED\" && canDelete", details);
        Assert.Contains("PortalNotification", details);
        Assert.Contains("VACATION_REQUEST_DELETED_NOTICE_KEY", list);
        Assert.Contains("setSelectedPublicId(null)", list);
        Assert.Contains("vacation.admin.action.delete.success", list);
        Assert.Contains("VACATION_REQUEST_DELETED_NOTICE_KEY", problems);
        Assert.Contains("leaveTypesDeletePermission", leaveTypes);
        Assert.Contains("leave_type_system_protected", leaveTypes);
        Assert.Contains("\"vacation.admin.action.delete.title\": \"Delete request\"",
            translations);
        Assert.Contains("\"vacation.admin.action.delete.title\": \"Obriši zahtev\"",
            translations);
        Assert.Contains("vacation_request_not_terminal", problems);
        Assert.Contains("vacation_request_ledger_effect_not_zero", problems);
        Assert.Contains("vacation_request_delete_conflict", problems);
    }

    [Fact]
    public void RequestDelete_DoesNotChangeLedgerCancellationOrMirrorPaths()
    {
        var service = Read("apps", "api", "src", "Api", "Modules", "Vacation",
            "LeaveRequestService.cs");
        var deleteStart = service.IndexOf(
            "public async Task<LeaveRequestDeleteResult> DeleteAsync",
            StringComparison.Ordinal);
        Assert.True(deleteStart >= 0);
        var deleteEnd = service.IndexOf(
            "public bool TryCreateAdminQuery",
            deleteStart,
            StringComparison.Ordinal);
        Assert.True(deleteEnd > deleteStart);
        var deleteBody = service[deleteStart..deleteEnd];

        Assert.DoesNotContain("InsertRequestConsumptionAsync", deleteBody);
        Assert.DoesNotContain("InsertCancellationReversalAsync", deleteBody);
        Assert.DoesNotContain("UpdateUsedDaysAsync", deleteBody);
        Assert.DoesNotContain("UpsertCompatibilityBalanceAsync", deleteBody);
        Assert.DoesNotContain("leave_balances", deleteBody);
        Assert.Contains("DeleteNeutralizedAsync", deleteBody);
        Assert.Contains("auditWriter.WriteAsync", deleteBody);
        Assert.Contains("BeginTransactionAsync", deleteBody);
        Assert.Contains("CommitAsync", deleteBody);
        Assert.Contains("RollbackAsync", deleteBody);
    }

    private static string Read(params string[] parts)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null &&
               !File.Exists(Path.Combine(directory.FullName, "internal.ps1")))
        {
            directory = directory.Parent;
        }

        Assert.NotNull(directory);
        return File.ReadAllText(Path.Combine([directory!.FullName, .. parts]));
    }
}
