using Xunit;

namespace InternalApps.Api.Tests;

public sealed class BusinessCalendarMigrationTests
{
    [Fact]
    public void Migration_EnforcesUniqueDateAndLeastPrivilegeWrites()
    {
        var path = FindRepositoryFile(
            "database", "migrations", "018_business_calendar_non_working_days.sql");
        var sql = File.ReadAllText(path);

        Assert.Contains(
            "CONSTRAINT uq_non_working_days_date UNIQUE (date)", sql);
        Assert.Contains("GRANT DELETE ON core.non_working_days", sql);
        Assert.Contains("FOREIGN KEY (created_by) REFERENCES identity.users (id)", sql);
        Assert.Contains("FOREIGN KEY (updated_by) REFERENCES identity.users (id)", sql);
    }

    private static string FindRepositoryFile(params string[] parts)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            var candidate = Path.Combine([directory.FullName, .. parts]);
            if (File.Exists(candidate)) return candidate;
            directory = directory.Parent;
        }
        throw new FileNotFoundException("Repository migration was not found.");
    }
}
