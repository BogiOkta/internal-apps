using Xunit;

namespace InternalApps.Api.Tests;

public sealed class AdministrativeAbsenceContractTests
{
    [Fact]
    public void Migration_AddsOnlyTheImmutableLeaveRequestSourceWithRuntimeInsertAccess()
    {
        var migration = Read("database", "migrations", "033_vacation_administrative_absence_source.sql");
        Assert.Contains("ADD COLUMN source varchar(30) NOT NULL DEFAULT 'EMPLOYEE_REQUEST'", migration);
        Assert.Contains("'ADMINISTRATIVE_ENTRY'", migration);
        Assert.Contains("prevent_leave_request_source_change", migration);
        Assert.Contains("GRANT INSERT (source, decided_at, decided_by_user_id)", migration);
    }

    [Fact]
    public void AdministrativeRecording_ReusesApprovedRequestBalanceLedgerHistoryAndAuditFlow()
    {
        var service = Read("apps", "api", "src", "Api", "Modules", "Vacation", "LeaveRequestService.cs");
        var recording = service[service.IndexOf("public async Task<LeaveRequestOperationResult> RecordAdministrativeAsync", StringComparison.Ordinal)..service.IndexOf("public async Task<LeaveRequestOperationResult> CancelOwnAsync", StringComparison.Ordinal)];
        Assert.Contains("RecordAdministrativeAsync", service);
        Assert.Contains("businessCalendar.WorkingDaysBetween", service);
        Assert.Contains("CreateAdministrativeAsync", service);
        Assert.Contains("LeaveRequestSources.AdministrativeEntry", service);
        Assert.Contains("InsertRequestConsumptionAsync", recording);
        Assert.Contains("LeaveRequestStatuses.Approved, actor", recording);
        Assert.Contains("leave_request_recorded", recording);
        Assert.True(recording.IndexOf("CreateAdministrativeAsync", StringComparison.Ordinal) <
                    recording.IndexOf("InsertRequestConsumptionAsync", StringComparison.Ordinal));
        Assert.True(recording.IndexOf("InsertRequestConsumptionAsync", StringComparison.Ordinal) <
                    recording.IndexOf("InsertHistoryAsync", StringComparison.Ordinal));
        Assert.True(recording.IndexOf("InsertHistoryAsync", StringComparison.Ordinal) <
                    recording.IndexOf("auditWriter.WriteAsync", StringComparison.Ordinal));
        Assert.True(recording.IndexOf("auditWriter.WriteAsync", StringComparison.Ordinal) <
                    recording.IndexOf("transaction.CommitAsync", StringComparison.Ordinal));
    }

    [Fact]
    public void Portal_PresentsRecordedAndHidesDecisionActionsForAdministrativeEntries()
    {
        var list = Read("apps", "portal", "src", "features", "vacation", "components", "admin-vacation-request-list.tsx");
        var details = Read("apps", "portal", "src", "features", "vacation", "components", "admin-vacation-request-details.tsx");
        Assert.Contains("vacation.admin.status.recorded", list);
        Assert.Contains("source === \"ADMINISTRATIVE_ENTRY\"", details);
        Assert.Contains("requests/record", Read("apps", "portal", "src", "services", "vacation.ts"));
    }

    [Fact]
    public void Portal_RecordForm_UsesPortalDateInputAndBusinessCalendarWorkingDays()
    {
        var form = Read("apps", "portal", "src", "features", "vacation", "components",
            "admin-record-absence.tsx");
        Assert.Contains("PortalDateInput", form);
        Assert.Contains("getWorkingDaysBetween", form);
        Assert.Contains("formControlClassName", form);
        Assert.Contains("formPrimaryButtonClassName", form);
        Assert.DoesNotContain("type=\"date\"", form, StringComparison.Ordinal);
        Assert.DoesNotContain("type='date'", form, StringComparison.Ordinal);
    }

    private static string Read(params string[] parts)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "internal.ps1"))) directory = directory.Parent;
        Assert.NotNull(directory);
        return File.ReadAllText(Path.Combine([directory!.FullName, .. parts]));
    }
}
