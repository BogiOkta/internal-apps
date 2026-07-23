using Microsoft.Net.Http.Headers;

namespace InternalApps.Api.Modules.Vacation;

internal sealed class LeaveTypesService(LeaveTypesRepository repository)
{
    public bool TryCreateListQuery(
        string? search,
        string? status,
        string? sortBy,
        string? sortDirection,
        out LeaveTypeListQuery query,
        out Dictionary<string, string[]> errors)
    {
        errors = [];

        var normalizedSearch = string.IsNullOrWhiteSpace(search)
            ? null
            : search.Trim();
        if (normalizedSearch?.Length > 100)
        {
            errors["search"] = ["Search must not exceed 100 characters."];
        }

        var normalizedStatus = status switch
        {
            null or "" => LeaveTypeStatusFilter.All,
            "all" => LeaveTypeStatusFilter.All,
            "active" => LeaveTypeStatusFilter.Active,
            "inactive" => LeaveTypeStatusFilter.Inactive,
            _ => LeaveTypeStatusFilter.All
        };
        if (status is not null and not "" &&
            status is not "all" and not "active" and not "inactive")
        {
            errors["status"] = ["Status must be active, inactive, or all."];
        }

        var normalizedSortBy = sortBy switch
        {
            null or "" => LeaveTypeSortField.DisplayOrder,
            "displayOrder" => LeaveTypeSortField.DisplayOrder,
            "code" => LeaveTypeSortField.Code,
            "name" => LeaveTypeSortField.Name,
            "status" => LeaveTypeSortField.Status,
            _ => LeaveTypeSortField.DisplayOrder
        };
        if (sortBy is not null and not "" &&
            sortBy is not "displayOrder" and not "code" and not "name" and not "status")
        {
            errors["sortBy"] = ["The requested sort field is not supported."];
        }

        var normalizedDirection = sortDirection switch
        {
            null or "" => LeaveTypeSortDirection.Ascending,
            "asc" => LeaveTypeSortDirection.Ascending,
            "desc" => LeaveTypeSortDirection.Descending,
            _ => LeaveTypeSortDirection.Ascending
        };
        if (sortDirection is not null and not "" &&
            sortDirection is not "asc" and not "desc")
        {
            errors["sortDirection"] = ["Sort direction must be asc or desc."];
        }

        query = new LeaveTypeListQuery(
            normalizedSearch,
            normalizedStatus,
            normalizedSortBy,
            normalizedDirection);

        return errors.Count == 0;
    }

    public async Task<IReadOnlyList<LeaveTypeResponse>> ListAsync(
        LeaveTypeListQuery query,
        string? acceptLanguage,
        CancellationToken cancellationToken)
    {
        var locale = ResolveLocale(acceptLanguage);
        var records = await repository.ListAsync(query, locale, cancellationToken);
        return records.Select(record => ToResponse(record, locale)).ToArray();
    }

    public async Task<LeaveTypeResponse?> GetByPublicIdAsync(
        Guid publicId,
        string? acceptLanguage,
        CancellationToken cancellationToken)
    {
        var locale = ResolveLocale(acceptLanguage);
        var record = await repository.GetByPublicIdAsync(publicId, cancellationToken);
        return record is null ? null : ToResponse(record, locale);
    }

    private static LeaveTypeResponse ToResponse(
        LeaveTypeRecord record,
        LeaveTypeLocale locale)
    {
        var description = locale == LeaveTypeLocale.English
            ? record.DescriptionEn
            : record.DescriptionSr;

        return new LeaveTypeResponse(
            record.PublicId,
            record.Code,
            locale == LeaveTypeLocale.English ? record.NameEn : record.NameSr,
            string.IsNullOrWhiteSpace(description) ? null : description,
            record.CalendarColor,
            record.CountsAgainstVacationBalance,
            record.RequiresApproval,
            record.IsActive,
            record.DisplayOrder);
    }

    private static LeaveTypeLocale ResolveLocale(string? acceptLanguage)
    {
        if (string.IsNullOrWhiteSpace(acceptLanguage))
        {
            return LeaveTypeLocale.Serbian;
        }

        var candidates = ParseLanguages(acceptLanguage)
            .OrderByDescending(candidate => candidate.Quality)
            .ThenBy(candidate => candidate.Index);

        foreach (var candidate in candidates)
        {
            if (candidate.Tag.Equals("en", StringComparison.OrdinalIgnoreCase) ||
                candidate.Tag.StartsWith("en-", StringComparison.OrdinalIgnoreCase))
            {
                return LeaveTypeLocale.English;
            }

            if (candidate.Tag.Equals("sr", StringComparison.OrdinalIgnoreCase) ||
                candidate.Tag.StartsWith("sr-", StringComparison.OrdinalIgnoreCase))
            {
                return LeaveTypeLocale.Serbian;
            }
        }

        return LeaveTypeLocale.Serbian;
    }

    private static IEnumerable<LanguageCandidate> ParseLanguages(string acceptLanguage)
    {
        var values = acceptLanguage.Split(
            ',',
            StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        for (var index = 0; index < values.Length; index++)
        {
            if (!StringWithQualityHeaderValue.TryParse(values[index], out var parsed) ||
                parsed is null)
            {
                continue;
            }

            var quality = parsed.Quality ?? 1d;
            if (quality is <= 0 or > 1)
            {
                continue;
            }

            yield return new LanguageCandidate(parsed.Value.ToString(), quality, index);
        }
    }

    private sealed record LanguageCandidate(string Tag, double Quality, int Index);
}
