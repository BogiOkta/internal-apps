using InternalApps.Api.Core.BusinessCalendar;
using Xunit;

namespace InternalApps.Api.Tests;

public sealed class BusinessCalendarServiceTests
{
    [Fact]
    public async Task IsWorkingDay_OrdinaryWeekday_ReturnsTrue()
    {
        var service = Create();
        Assert.True(await service.IsWorkingDay(new DateOnly(2026, 8, 10)));
    }

    [Theory]
    [InlineData(2026, 8, 15)]
    [InlineData(2026, 8, 16)]
    public async Task IsWorkingDay_Weekend_ReturnsFalse(
        int year, int month, int day)
    {
        var service = Create();
        Assert.False(await service.IsWorkingDay(new DateOnly(year, month, day)));
    }

    [Fact]
    public async Task IsWorkingDay_ConfiguredWeekdayHoliday_ReturnsFalse()
    {
        var service = Create(new DateOnly(2026, 8, 12));
        Assert.False(await service.IsWorkingDay(new DateOnly(2026, 8, 12)));
    }

    [Fact]
    public async Task WorkingDaysBetween_IsInclusive()
    {
        var service = Create();
        Assert.Equal(5, await service.WorkingDaysBetween(
            new DateOnly(2026, 8, 10), new DateOnly(2026, 8, 14)));
    }

    [Fact]
    public async Task WorkingDaysBetween_ExcludesWeekendsAndConfiguredHolidays()
    {
        var service = Create(new DateOnly(2026, 8, 12));
        Assert.Equal(4, await service.WorkingDaysBetween(
            new DateOnly(2026, 8, 10), new DateOnly(2026, 8, 16)));
    }

    [Fact]
    public async Task WorkingDaysBetween_WeekendHolidayIsNotDoubleCounted()
    {
        var service = Create(new DateOnly(2026, 8, 15));
        Assert.Equal(5, await service.WorkingDaysBetween(
            new DateOnly(2026, 8, 10), new DateOnly(2026, 8, 16)));
    }

    [Theory]
    [InlineData(2026, 8, 10, 1)]
    [InlineData(2026, 8, 15, 0)]
    public async Task WorkingDaysBetween_SingleDayRange(
        int year, int month, int day, int expected)
    {
        var date = new DateOnly(year, month, day);
        Assert.Equal(expected, await Create().WorkingDaysBetween(date, date));
    }

    [Fact]
    public async Task WorkingDaysBetween_ReversedRangeThrows()
    {
        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
            Create().WorkingDaysBetween(
                new DateOnly(2026, 8, 11), new DateOnly(2026, 8, 10)));
    }

    [Fact]
    public void Validation_RejectsMissingNameAndDate()
    {
        var valid = BusinessCalendarService.TryNormalize(
            null, " ", null, out _, out var errors);
        Assert.False(valid);
        Assert.Contains("date", errors);
        Assert.Contains("name", errors);
    }

    private static BusinessCalendarService Create(params DateOnly[] holidays) =>
        new(new FakeStore(holidays));

    private sealed class FakeStore(IEnumerable<DateOnly> dates) : INonWorkingDayStore
    {
        private readonly HashSet<DateOnly> dates = dates.ToHashSet();

        public Task<bool> ExistsAsync(
            DateOnly date, CancellationToken cancellationToken) =>
            Task.FromResult(dates.Contains(date));

        public Task<IReadOnlySet<DateOnly>> GetDatesAsync(
            DateOnly from, DateOnly to, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlySet<DateOnly>>(
                dates.Where(date => date >= from && date <= to).ToHashSet());
    }
}
