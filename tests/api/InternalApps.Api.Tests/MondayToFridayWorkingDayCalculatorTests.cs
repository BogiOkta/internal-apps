using InternalApps.Api.Modules.Vacation;
using Xunit;

namespace InternalApps.Api.Tests;

public sealed class MondayToFridayWorkingDayCalculatorTests
{
    private readonly MondayToFridayWorkingDayCalculator calculator = new();

    [Theory]
    [InlineData(2026, 8, 10, 2026, 8, 14, 5)]
    [InlineData(2026, 8, 14, 2026, 8, 17, 2)]
    [InlineData(2026, 8, 15, 2026, 8, 16, 0)]
    [InlineData(2026, 8, 10, 2026, 8, 10, 1)]
    [InlineData(2026, 8, 15, 2026, 8, 15, 0)]
    [InlineData(2026, 8, 3, 2026, 8, 21, 15)]
    public void Calculate_ReturnsInclusiveWeekdayCount(
        int fromYear, int fromMonth, int fromDay,
        int toYear, int toMonth, int toDay, int expected)
    {
        var actual = calculator.Calculate(
            new DateOnly(fromYear, fromMonth, fromDay),
            new DateOnly(toYear, toMonth, toDay));

        Assert.Equal(expected, actual);
    }

    [Fact]
    public void Calculate_ThrowsForReversedRange()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            calculator.Calculate(new DateOnly(2026, 8, 11),
                new DateOnly(2026, 8, 10)));
    }
}
