using Xunit;

namespace InternalApps.Api.Tests;

public sealed class LeaveBalanceLedgerMigrationTests
{
    [Fact]
    public void Migration_DefinesTheReducedAppendOnlyLedgerAndLeastPrivilegeRuntimeAccess()
    {
        var sql = ReadRepositoryFile("database", "migrations",
            "020_vacation_leave_balance_ledger.sql");

        Assert.Contains("CREATE TABLE vacation.leave_balance_entries", sql);
        Assert.Contains("employee_id, leave_type_id, leave_year", sql);
        Assert.Contains("annual_entitlement", sql);
        Assert.Contains("carry_over", sql);
        Assert.Contains("manual_adjustment", sql);
        Assert.Contains("request_consumption", sql);
        Assert.Contains("cancellation_reversal", sql);
        Assert.Contains("quantity_days <> 0 AND mod(abs(quantity_days) * 2, 1) = 0", sql);
        Assert.Contains("UNIQUE (reverses_entry_id)", sql);
        Assert.Contains("BEFORE UPDATE OR DELETE", sql);
        Assert.Contains("append-only", sql);
        Assert.Contains("GRANT SELECT, INSERT ON vacation.leave_balance_entries", sql);
        Assert.DoesNotContain("GRANT UPDATE ON vacation.leave_balance_entries", sql);
        Assert.DoesNotContain("GRANT DELETE ON vacation.leave_balance_entries", sql);
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
