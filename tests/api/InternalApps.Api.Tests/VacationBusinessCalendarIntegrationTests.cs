using Xunit;

namespace InternalApps.Api.Tests;

public sealed class VacationBusinessCalendarIntegrationTests
{
    [Fact]
    public void VacationCreation_DelegatesToBusinessCalendar_AndPersistsItsResult()
    {
        var source = ReadRepositoryFile(
            "apps", "api", "src", "Api", "Modules", "Vacation",
            "LeaveRequestService.cs");

        Assert.Contains("BusinessCalendarService businessCalendar", source);
        Assert.Contains(
            "await businessCalendar.WorkingDaysBetween(", source);
        Assert.Contains(
            "workingDays, NormalizeOptional(request.Note)", source);
    }

    [Fact]
    public void BalanceTransitions_UseThePersistedBusinessCalendarResult()
    {
        var source = ReadRepositoryFile(
            "apps", "api", "src", "Api", "Modules", "Vacation",
            "LeaveRequestService.cs");

        Assert.Contains("balance.UsedDays + entity.WorkingDays", source);
        Assert.Contains("balance.UsedDays - entity.WorkingDays", source);
        Assert.Contains("balance.AvailableDays < entity.WorkingDays", source);
    }

    [Fact]
    public void VacationContainsNoDuplicatedWorkingDayCalculation()
    {
        var vacationDirectory = FindRepositoryPath(
            "apps", "api", "src", "Api", "Modules", "Vacation");
        var portalPage = ReadRepositoryFile(
            "apps", "portal", "src", "app", "vacation", "requests", "new",
            "page.tsx");
        var portalUtilities = ReadRepositoryFile(
            "apps", "portal", "src", "features", "vacation",
            "vacation-request-utils.ts");

        Assert.Empty(Directory.GetFiles(
            vacationDirectory, "*WorkingDayCalculator*", SearchOption.AllDirectories));
        Assert.DoesNotContain("DayOfWeek", ReadAllFiles(vacationDirectory));
        Assert.DoesNotContain("calculateWeekdayEstimate", portalPage);
        Assert.DoesNotContain("getDay()", portalUtilities);
        Assert.Contains("getWorkingDaysBetween(", portalPage);
    }

    private static string ReadAllFiles(string directory) =>
        string.Join(Environment.NewLine,
            Directory.GetFiles(directory, "*.cs", SearchOption.AllDirectories)
                .Select(File.ReadAllText));

    private static string ReadRepositoryFile(params string[] parts) =>
        File.ReadAllText(FindRepositoryPath(parts));

    private static string FindRepositoryPath(params string[] parts)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            var candidate = Path.Combine([directory.FullName, .. parts]);
            if (File.Exists(candidate) || Directory.Exists(candidate)) return candidate;
            directory = directory.Parent;
        }
        throw new FileNotFoundException("Repository path was not found.");
    }
}
