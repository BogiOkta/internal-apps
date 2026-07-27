using System.Globalization;
using System.Text.RegularExpressions;
using InternalApps.Api.Infrastructure.Auditing;
using Microsoft.Net.Http.Headers;
using Npgsql;

namespace InternalApps.Api.Modules.Vacation;

internal sealed class LeaveTypesService(
    NpgsqlDataSource dataSource,
    LeaveTypesRepository repository,
    AuditWriter auditWriter)
{
    private const int CodeMaxLength = 50;
    private const int NameMaxLength = 150;
    private const int DescriptionMaxLength = 500;

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

    public async Task<LeaveTypeDetailsResponse?> GetByPublicIdAsync(
        Guid publicId,
        string? acceptLanguage,
        CancellationToken cancellationToken)
    {
        var locale = ResolveLocale(acceptLanguage);
        var record = await repository.GetByPublicIdAsync(publicId, cancellationToken);
        return record is null ? null : ToDetailsResponse(record, locale);
    }

    public async Task<LeaveTypeWriteResult> CreateAsync(
        CreateLeaveTypeRequest request,
        Guid actorUserPublicId,
        string traceId,
        string? acceptLanguage,
        CancellationToken cancellationToken)
    {
        if (!TryNormalizeCreate(request, out var command, out var errors))
        {
            return new LeaveTypeWriteResult(
                LeaveTypeWriteStatus.ValidationFailed,
                Errors: errors);
        }

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        var result = await repository.CreateAsync(
            connection,
            transaction,
            command,
            cancellationToken);

        if (result.DuplicateCode)
        {
            await transaction.RollbackAsync(cancellationToken);
            return new LeaveTypeWriteResult(LeaveTypeWriteStatus.DuplicateCode);
        }

        var record = result.LeaveType!;
        await auditWriter.WriteAsync(
            connection,
            transaction,
            CreateAuditEntry(
                actorUserPublicId,
                "vacation.leave-types.created",
                record.PublicId,
                traceId,
                [new AuditChange("record", null, "created")]),
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);
        return new LeaveTypeWriteResult(
            LeaveTypeWriteStatus.Success,
            ToDetailsResponse(record, ResolveLocale(acceptLanguage)));
    }

    public async Task<LeaveTypeWriteResult> UpdateAsync(
        Guid publicId,
        UpdateLeaveTypeRequest request,
        Guid actorUserPublicId,
        string traceId,
        string? acceptLanguage,
        CancellationToken cancellationToken)
    {
        if (!TryNormalizeUpdate(request, out var command, out var errors))
        {
            return new LeaveTypeWriteResult(
                LeaveTypeWriteStatus.ValidationFailed,
                Errors: errors);
        }

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        var previous = await repository.GetByPublicIdForUpdateAsync(
            connection,
            transaction,
            publicId,
            cancellationToken);
        if (previous is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return new LeaveTypeWriteResult(LeaveTypeWriteStatus.NotFound);
        }

        var updated = await repository.UpdateAsync(
            connection,
            transaction,
            publicId,
            command,
            cancellationToken);
        var changes = GetUpdateChanges(previous, updated);

        await auditWriter.WriteAsync(
            connection,
            transaction,
            CreateAuditEntry(
                actorUserPublicId,
                "vacation.leave-types.updated",
                publicId,
                traceId,
                changes.Count > 0
                    ? changes
                    : [new AuditChange("record", null, "updated")]),
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);
        return new LeaveTypeWriteResult(
            LeaveTypeWriteStatus.Success,
            ToDetailsResponse(updated, ResolveLocale(acceptLanguage)));
    }

    public async Task<LeaveTypeWriteResult> SetActiveAsync(
        Guid publicId,
        bool isActive,
        Guid actorUserPublicId,
        string traceId,
        string? acceptLanguage,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        var previous = await repository.GetByPublicIdForUpdateAsync(
            connection,
            transaction,
            publicId,
            cancellationToken);
        if (previous is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return new LeaveTypeWriteResult(LeaveTypeWriteStatus.NotFound);
        }

        var updated = await repository.SetActiveAsync(
            connection,
            transaction,
            publicId,
            isActive,
            cancellationToken);

        await auditWriter.WriteAsync(
            connection,
            transaction,
            CreateAuditEntry(
                actorUserPublicId,
                isActive
                    ? "vacation.leave-types.activated"
                    : "vacation.leave-types.deactivated",
                publicId,
                traceId,
                [
                    new AuditChange(
                        "is_active",
                        previous.IsActive.ToString(),
                        updated.IsActive.ToString())
                ]),
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);
        return new LeaveTypeWriteResult(
            LeaveTypeWriteStatus.Success,
            ToDetailsResponse(updated, ResolveLocale(acceptLanguage)));
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
            record.RequiresBalance,
            record.RequiresApproval,
            record.IsActive,
            record.DisplayOrder);
    }

    private static LeaveTypeDetailsResponse ToDetailsResponse(
        LeaveTypeRecord record,
        LeaveTypeLocale locale)
    {
        var localized = ToResponse(record, locale);
        return new LeaveTypeDetailsResponse(
            localized.PublicId,
            localized.Code,
            localized.Name,
            localized.Description,
            record.NameSr,
            record.NameEn,
            record.DescriptionSr,
            record.DescriptionEn,
            localized.CalendarColor,
            localized.CountsAgainstVacationBalance,
            localized.RequiresBalance,
            localized.RequiresApproval,
            localized.IsActive,
            localized.DisplayOrder);
    }

    private static bool TryNormalizeCreate(
        CreateLeaveTypeRequest request,
        out CreateLeaveTypeCommand command,
        out Dictionary<string, string[]> errors)
    {
        errors = [];
        var code = NormalizeRequired(request.Code, "code", CodeMaxLength, errors);
        var nameSr = NormalizeRequired(request.NameSr, "nameSr", NameMaxLength, errors);
        var nameEn = NormalizeRequired(request.NameEn, "nameEn", NameMaxLength, errors);
        var descriptionSr = NormalizeOptional(
            request.DescriptionSr,
            "descriptionSr",
            DescriptionMaxLength,
            errors);
        var descriptionEn = NormalizeOptional(
            request.DescriptionEn,
            "descriptionEn",
            DescriptionMaxLength,
            errors);
        var calendarColor = NormalizeColor(request.CalendarColor, errors);

        if (code.Length > 0 &&
            !Regex.IsMatch(code, "^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$"))
        {
            errors["code"] =
                ["Code must use uppercase letters, digits, and single underscores."];
        }

        ValidateDisplayOrder(request.DisplayOrder, errors);
        ValidateRequiredBoolean(
            request.CountsAgainstVacationBalance,
            "countsAgainstVacationBalance",
            errors);
        ValidateRequiredBoolean(request.RequiresBalance, "requiresBalance", errors);
        ValidateRequiredBoolean(
            request.RequiresApproval,
            "requiresApproval",
            errors);
        ValidateRequiredBoolean(request.IsActive, "isActive", errors);

        command = new CreateLeaveTypeCommand(
            code,
            nameSr,
            nameEn,
            descriptionSr,
            descriptionEn,
            calendarColor,
            request.CountsAgainstVacationBalance.GetValueOrDefault(),
            request.RequiresBalance.GetValueOrDefault(),
            request.RequiresApproval.GetValueOrDefault(),
            request.IsActive.GetValueOrDefault(),
            request.DisplayOrder.GetValueOrDefault());
        return errors.Count == 0;
    }

    private static bool TryNormalizeUpdate(
        UpdateLeaveTypeRequest request,
        out UpdateLeaveTypeCommand command,
        out Dictionary<string, string[]> errors)
    {
        errors = [];
        var nameSr = NormalizeRequired(request.NameSr, "nameSr", NameMaxLength, errors);
        var nameEn = NormalizeRequired(request.NameEn, "nameEn", NameMaxLength, errors);
        var descriptionSr = NormalizeOptional(
            request.DescriptionSr,
            "descriptionSr",
            DescriptionMaxLength,
            errors);
        var descriptionEn = NormalizeOptional(
            request.DescriptionEn,
            "descriptionEn",
            DescriptionMaxLength,
            errors);
        var calendarColor = NormalizeColor(request.CalendarColor, errors);
        ValidateDisplayOrder(request.DisplayOrder, errors);
        ValidateRequiredBoolean(
            request.CountsAgainstVacationBalance,
            "countsAgainstVacationBalance",
            errors);
        ValidateRequiredBoolean(
            request.RequiresApproval,
            "requiresApproval",
            errors);

        command = new UpdateLeaveTypeCommand(
            nameSr,
            nameEn,
            descriptionSr,
            descriptionEn,
            calendarColor,
            request.CountsAgainstVacationBalance.GetValueOrDefault(),
            request.RequiresApproval.GetValueOrDefault(),
            request.DisplayOrder.GetValueOrDefault());
        return errors.Count == 0;
    }

    private static string NormalizeRequired(
        string? value,
        string field,
        int maximumLength,
        Dictionary<string, string[]> errors)
    {
        var normalized = value?.Trim() ?? string.Empty;
        if (normalized.Length == 0)
        {
            errors[field] = ["The field is required."];
        }
        else if (normalized.Length > maximumLength)
        {
            errors[field] = [$"The field must not exceed {maximumLength} characters."];
        }

        return normalized;
    }

    private static string? NormalizeOptional(
        string? value,
        string field,
        int maximumLength,
        Dictionary<string, string[]> errors)
    {
        var normalized = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        if (normalized?.Length > maximumLength)
        {
            errors[field] = [$"The field must not exceed {maximumLength} characters."];
        }

        return normalized;
    }

    private static string? NormalizeColor(
        string? value,
        Dictionary<string, string[]> errors)
    {
        var normalized = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        if (normalized is not null &&
            !Regex.IsMatch(normalized, "^#[0-9A-Fa-f]{6}$"))
        {
            errors["calendarColor"] = ["Calendar color must use the #RRGGBB format."];
        }

        return normalized;
    }

    private static void ValidateDisplayOrder(
        int? displayOrder,
        Dictionary<string, string[]> errors)
    {
        if (displayOrder is null)
        {
            errors["displayOrder"] = ["Display order is required."];
        }
        else if (displayOrder < 0)
        {
            errors["displayOrder"] = ["Display order must not be negative."];
        }
    }

    private static void ValidateRequiredBoolean(
        bool? value,
        string field,
        Dictionary<string, string[]> errors)
    {
        if (value is null)
        {
            errors[field] = ["The field is required."];
        }
    }

    private static List<AuditChange> GetUpdateChanges(
        LeaveTypeRecord previous,
        LeaveTypeRecord updated)
    {
        var changes = new List<AuditChange>();
        AddChange(changes, "name_sr", previous.NameSr, updated.NameSr);
        AddChange(changes, "name_en", previous.NameEn, updated.NameEn);
        AddRedactedChange(
            changes,
            "description_sr",
            previous.DescriptionSr,
            updated.DescriptionSr);
        AddRedactedChange(
            changes,
            "description_en",
            previous.DescriptionEn,
            updated.DescriptionEn);
        AddChange(
            changes,
            "calendar_color",
            previous.CalendarColor,
            updated.CalendarColor);
        AddChange(
            changes,
            "counts_against_vacation_balance",
            previous.CountsAgainstVacationBalance.ToString(),
            updated.CountsAgainstVacationBalance.ToString());
        AddChange(
            changes,
            "requires_approval",
            previous.RequiresApproval.ToString(),
            updated.RequiresApproval.ToString());
        AddChange(
            changes,
            "display_order",
            previous.DisplayOrder.ToString(CultureInfo.InvariantCulture),
            updated.DisplayOrder.ToString(CultureInfo.InvariantCulture));
        return changes;
    }

    private static void AddChange(
        ICollection<AuditChange> changes,
        string fieldName,
        string? previousValue,
        string? newValue)
    {
        if (!string.Equals(previousValue, newValue, StringComparison.Ordinal))
        {
            changes.Add(new AuditChange(fieldName, previousValue, newValue));
        }
    }

    private static void AddRedactedChange(
        ICollection<AuditChange> changes,
        string fieldName,
        string? previousValue,
        string? newValue)
    {
        if (!string.Equals(previousValue, newValue, StringComparison.Ordinal))
        {
            changes.Add(
                new AuditChange(
                    fieldName,
                    previousValue is null ? null : "set",
                    newValue is null ? null : "set"));
        }
    }

    private static AuditEntry CreateAuditEntry(
        Guid actorUserPublicId,
        string action,
        Guid targetPublicId,
        string traceId,
        IReadOnlyCollection<AuditChange> changes) =>
        new(
            actorUserPublicId,
            "vacation",
            action,
            "leave_type",
            targetPublicId,
            traceId,
            changes);

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
