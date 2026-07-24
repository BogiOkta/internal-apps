namespace InternalApps.Api.Modules.Vacation;

internal interface IWorkingDayCalculator
{
    int Calculate(DateOnly dateFrom, DateOnly dateTo);
}

internal sealed class MondayToFridayWorkingDayCalculator : IWorkingDayCalculator
{
    public int Calculate(DateOnly dateFrom, DateOnly dateTo)
    {
        if (dateTo < dateFrom)
            throw new ArgumentOutOfRangeException(
                nameof(dateTo), "The end date cannot precede the start date.");

        var count = 0;
        for (var date = dateFrom; date <= dateTo; date = date.AddDays(1))
        {
            if (date.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday)
                count++;
        }

        return count;
    }
}
