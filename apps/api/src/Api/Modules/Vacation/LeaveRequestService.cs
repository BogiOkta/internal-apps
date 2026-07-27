using System.IdentityModel.Tokens.Jwt;
using InternalApps.Api.Authentication;
using InternalApps.Api.Core.BusinessCalendar;
using InternalApps.Api.Infrastructure.Auditing;
using InternalApps.Api.Modules.Organization;
using Npgsql;

namespace InternalApps.Api.Modules.Vacation;

internal sealed class LeaveRequestService(
    NpgsqlDataSource dataSource,
    LeaveRequestsRepository repository,
    LeaveBalanceLedgerRepository ledgerRepository,
    CurrentEmployeeResolver currentEmployeeResolver,
    BusinessCalendarService businessCalendar,
    AuditWriter auditWriter)
{
    private const int NoteMaxLength = 1000;

    public async Task<(LeaveRequestOperationStatus Status,
        IReadOnlyList<LeaveTypeOptionResponse>? LeaveTypes)> ListLeaveTypesAsync(
        HttpContext context, string? acceptLanguage, CancellationToken cancellationToken)
    {
        var current = await ResolveActiveEmployeeAsync(context, cancellationToken);
        if (current.Error is not null) return (current.Error.Value, null);
        return (LeaveRequestOperationStatus.Success,
            await repository.ListActiveLeaveTypesAsync(
                IsEnglish(acceptLanguage), cancellationToken));
    }

    public async Task<(LeaveRequestOperationStatus Status,
        IReadOnlyList<LeaveRequestResponse>? Requests)> ListOwnAsync(
        HttpContext context, string? acceptLanguage, CancellationToken cancellationToken)
    {
        var current = await currentEmployeeResolver.ResolveAsync(context, cancellationToken);
        if (current.Status != CurrentEmployeeResolutionStatus.Success)
            return (LeaveRequestOperationStatus.CurrentEmployeeNotLinked, null);
        if (!IsEmployeeActive(current.Employee!))
            return (LeaveRequestOperationStatus.CurrentEmployeeInactive, null);
        return (LeaveRequestOperationStatus.Success,
            await repository.ListForEmployeeAsync(current.Employee!.PublicId,
                IsEnglish(acceptLanguage), cancellationToken));
    }

    public async Task<LeaveRequestOperationResult> GetOwnAsync(
        HttpContext context, Guid publicId, string? acceptLanguage,
        CancellationToken cancellationToken)
    {
        var current = await ResolveActiveEmployeeAsync(context, cancellationToken);
        if (current.Error is not null) return new(current.Error.Value);
        var request = await repository.GetAsync(publicId, current.Employee!.PublicId,
            IsEnglish(acceptLanguage), cancellationToken);
        return request is null
            ? new(LeaveRequestOperationStatus.RequestNotFound)
            : new(LeaveRequestOperationStatus.Success, request);
    }

    public async Task<(LeaveRequestOperationStatus Status,
        IReadOnlyList<LeaveBalanceResponse>? Balances)> ListBalancesAsync(
        HttpContext context, string? acceptLanguage, CancellationToken cancellationToken)
    {
        var current = await ResolveActiveEmployeeAsync(context, cancellationToken);
        if (current.Error is not null) return (current.Error.Value, null);
        return (LeaveRequestOperationStatus.Success,
            await repository.ListBalancesAsync(current.Employee!.PublicId,
                IsEnglish(acceptLanguage), cancellationToken));
    }

    public async Task<LeaveRequestOperationResult> CreateAsync(
        HttpContext context, CreateLeaveRequest request, string? acceptLanguage,
        CancellationToken cancellationToken)
    {
        if (request.DateFrom.HasValue && request.DateTo.HasValue &&
            request.DateTo < request.DateFrom)
            return new(LeaveRequestOperationStatus.InvalidDateRange);
        if (request.DateFrom.HasValue && request.DateTo.HasValue &&
            request.DateFrom.Value.Year != request.DateTo.Value.Year)
            return new(LeaveRequestOperationStatus.CrossYearNotAllowed);
        var errors = ValidateCreate(request);
        if (errors.Count > 0)
            return new(LeaveRequestOperationStatus.ValidationFailed, Errors: errors);

        var current = await ResolveActiveEmployeeAsync(context, cancellationToken);
        if (current.Error is not null) return new(current.Error.Value);
        if (!TryGetActor(context, out var actor))
            return new(LeaveRequestOperationStatus.CurrentEmployeeNotLinked);

        var dateFrom = request.DateFrom!.Value;
        var dateTo = request.DateTo!.Value;
        var workingDays = await businessCalendar.WorkingDaysBetween(
            dateFrom, dateTo, cancellationToken);
        if (workingDays == 0)
            return new(LeaveRequestOperationStatus.NoWorkingDays);

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        var leaveType = await repository.GetLeaveTypeAsync(connection, transaction,
            request.LeaveTypeId!.Value, cancellationToken);
        if (leaveType is null)
            return new(LeaveRequestOperationStatus.LeaveTypeNotFound);
        if (!leaveType.IsActive)
            return new(LeaveRequestOperationStatus.LeaveTypeInactive);

        try
        {
            var created = await repository.CreateAsync(connection, transaction,
                current.Employee!.PublicId, leaveType.PublicId, actor, dateFrom, dateTo,
                workingDays, NormalizeOptional(request.Note),
                IsEnglish(acceptLanguage), cancellationToken);
            var entity = await repository.GetForUpdateAsync(connection, transaction,
                created.PublicId, current.Employee.PublicId, cancellationToken)
                ?? throw new InvalidOperationException("Created leave request was not found.");
            await repository.InsertHistoryAsync(connection, transaction, entity.Id, null,
                LeaveRequestStatuses.Submitted, actor, NormalizeOptional(request.Note),
                cancellationToken);
            await auditWriter.WriteAsync(connection, transaction,
                new(actor, "vacation", "leave_request_submitted", "leave_request",
                    created.PublicId, context.TraceIdentifier,
                    [
                        new("status", null, LeaveRequestStatuses.Submitted),
                        new("date_from", null, dateFrom.ToString("yyyy-MM-dd")),
                        new("date_to", null, dateTo.ToString("yyyy-MM-dd")),
                        new("working_days", null, workingDays.ToString())
                    ]), cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return new(LeaveRequestOperationStatus.Success, created);
        }
        catch (LeaveRequestOverlapException)
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(LeaveRequestOperationStatus.Overlap);
        }
    }

    public async Task<LeaveRequestOperationResult> CancelOwnAsync(
        HttpContext context, Guid publicId, LeaveRequestComment command,
        string? acceptLanguage, CancellationToken cancellationToken)
    {
        var current = await ResolveActiveEmployeeAsync(context, cancellationToken);
        if (current.Error is not null) return new(current.Error.Value);
        return await TransitionAsync(context, publicId, current.Employee!.PublicId,
            LeaveRequestStatuses.Cancelled, NormalizeOptional(command.Comment),
            IsEnglish(acceptLanguage), cancellationToken);
    }

    public Task<LeaveRequestResponse?> GetAdminAsync(
        Guid publicId, string? acceptLanguage, CancellationToken cancellationToken) =>
        repository.GetAsync(publicId, null, IsEnglish(acceptLanguage), cancellationToken);

    public Task<PagedLeaveRequestsResponse> ListAdminAsync(
        LeaveRequestAdminQuery query, string? acceptLanguage,
        CancellationToken cancellationToken) =>
        repository.ListAdminAsync(query, IsEnglish(acceptLanguage), cancellationToken);

    public Task<IReadOnlyList<LeaveRequestHistoryResponse>> ListHistoryAsync(
        Guid publicId, CancellationToken cancellationToken) =>
        repository.ListHistoryAsync(publicId, cancellationToken);

    public async Task<(LeaveRequestOperationStatus Status,
        IReadOnlyList<LeaveRequestHistoryResponse>? History)> ListOwnHistoryAsync(
        HttpContext context, Guid publicId, CancellationToken cancellationToken)
    {
        var current = await ResolveActiveEmployeeAsync(context, cancellationToken);
        if (current.Error is not null) return (current.Error.Value, null);
        var request = await repository.GetAsync(
            publicId, current.Employee!.PublicId, false, cancellationToken);
        if (request is null)
            return (LeaveRequestOperationStatus.RequestNotFound, null);
        return (LeaveRequestOperationStatus.Success,
            await repository.ListHistoryAsync(publicId, cancellationToken));
    }

    public Task<LeaveRequestOperationResult> ApproveAsync(
        HttpContext context, Guid publicId, LeaveRequestComment command,
        string? acceptLanguage, CancellationToken cancellationToken) =>
        TransitionAsync(context, publicId, null, LeaveRequestStatuses.Approved,
            NormalizeOptional(command.Comment), IsEnglish(acceptLanguage),
            cancellationToken);

    public Task<LeaveRequestOperationResult> RejectAsync(
        HttpContext context, Guid publicId, LeaveRequestComment command,
        string? acceptLanguage, CancellationToken cancellationToken) =>
        TransitionAsync(context, publicId, null, LeaveRequestStatuses.Rejected,
            NormalizeOptional(command.Comment), IsEnglish(acceptLanguage),
            cancellationToken);

    public Task<LeaveRequestOperationResult> CancelAdminAsync(
        HttpContext context, Guid publicId, LeaveRequestComment command,
        string? acceptLanguage, CancellationToken cancellationToken) =>
        TransitionAsync(context, publicId, null, LeaveRequestStatuses.Cancelled,
            NormalizeOptional(command.Comment), IsEnglish(acceptLanguage),
            cancellationToken);

    public bool TryCreateAdminQuery(
        Guid? employeeId, Guid? departmentId, Guid? leaveTypeId, string? status,
        DateOnly? dateFrom, DateOnly? dateTo, string? search, int? page, int? pageSize,
        out LeaveRequestAdminQuery query, out Dictionary<string, string[]> errors)
    {
        errors = [];
        var normalizedStatus = string.IsNullOrWhiteSpace(status)
            ? null : status.Trim().ToUpperInvariant();
        if (normalizedStatus is not null && !LeaveRequestStatuses.IsValid(normalizedStatus))
            errors["status"] = ["The status is not supported."];
        if (dateFrom.HasValue && dateTo.HasValue && dateTo < dateFrom)
            errors["dateTo"] = ["The end date cannot precede the start date."];
        var normalizedSearch = NormalizeOptional(search);
        if (normalizedSearch?.Length > 100)
            errors["search"] = ["Search must not exceed 100 characters."];
        var normalizedPage = page ?? 1;
        var normalizedPageSize = pageSize ?? 50;
        if (normalizedPage < 1) errors["page"] = ["Page must be at least 1."];
        if (normalizedPageSize is < 1 or > 100)
            errors["pageSize"] = ["Page size must be between 1 and 100."];
        query = new(employeeId, departmentId, leaveTypeId, normalizedStatus,
            dateFrom, dateTo, normalizedSearch, normalizedPage, normalizedPageSize);
        return errors.Count == 0;
    }

    private async Task<LeaveRequestOperationResult> TransitionAsync(
        HttpContext context, Guid publicId, Guid? employeePublicId, string targetStatus,
        string? comment, bool english, CancellationToken cancellationToken)
    {
        if (comment?.Length > NoteMaxLength)
            return new(LeaveRequestOperationStatus.ValidationFailed, Errors:
                new() { ["comment"] = [$"Comment must not exceed {NoteMaxLength} characters."] });
        if (!TryGetActor(context, out var actor))
            return new(LeaveRequestOperationStatus.Forbidden);

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        var entity = await repository.GetForUpdateAsync(connection, transaction,
            publicId, employeePublicId, cancellationToken);
        if (entity is null) return new(LeaveRequestOperationStatus.RequestNotFound);
        if (!CanTransition(entity.Status, targetStatus))
            return new(LeaveRequestOperationStatus.InvalidTransition);

        if (entity.RequiresBalance &&
            (targetStatus == LeaveRequestStatuses.Approved ||
             (targetStatus == LeaveRequestStatuses.Cancelled &&
              entity.Status == LeaveRequestStatuses.Approved)))
        {
            var balance = await repository.GetBalanceForUpdateAsync(connection, transaction,
                entity.EmployeeId, entity.LeaveTypeId, entity.DateFrom.Year,
                cancellationToken);
            if (balance is null)
                return new(LeaveRequestOperationStatus.BalanceNotFound);
            var usedDays = targetStatus == LeaveRequestStatuses.Approved
                ? balance.UsedDays + entity.WorkingDays
                : balance.UsedDays - entity.WorkingDays;
            if (targetStatus == LeaveRequestStatuses.Approved &&
                balance.AvailableDays < entity.WorkingDays)
                return new(LeaveRequestOperationStatus.BalanceInsufficient);
            if (usedDays < 0)
                return new(LeaveRequestOperationStatus.BalanceInvalid);
            await repository.UpdateUsedDaysAsync(connection, transaction,
                balance.Id, usedDays, cancellationToken);
        }

        var updated = await repository.SetStatusAsync(connection, transaction,
            entity.Id, targetStatus, comment, actor, english, cancellationToken);
        try
        {
            if (entity.RequiresBalance && targetStatus == LeaveRequestStatuses.Approved)
                await ledgerRepository.InsertRequestConsumptionAsync(connection, transaction,
                    entity, actor, cancellationToken);
            else if (entity.RequiresBalance && targetStatus == LeaveRequestStatuses.Cancelled &&
                     entity.Status == LeaveRequestStatuses.Approved)
                await ledgerRepository.InsertCancellationReversalAsync(connection, transaction,
                    entity, actor, cancellationToken);
        }
        catch (PostgresException exception) when (
            exception.SqlState == PostgresErrorCodes.RaiseException &&
            exception.MessageText.Contains("negative", StringComparison.OrdinalIgnoreCase))
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(LeaveRequestOperationStatus.BalanceInsufficient);
        }
        await repository.InsertHistoryAsync(connection, transaction, entity.Id,
            entity.Status, targetStatus, actor, comment, cancellationToken);
        await auditWriter.WriteAsync(connection, transaction,
            new(actor, "vacation", $"leave_request_{targetStatus.ToLowerInvariant()}",
                "leave_request", entity.PublicId, context.TraceIdentifier,
                [new("status", entity.Status, targetStatus)]), cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new(LeaveRequestOperationStatus.Success, updated);
    }

    private static bool CanTransition(string current, string target) =>
        target switch
        {
            LeaveRequestStatuses.Approved or LeaveRequestStatuses.Rejected =>
                current == LeaveRequestStatuses.Submitted,
            LeaveRequestStatuses.Cancelled =>
                current is LeaveRequestStatuses.Submitted or LeaveRequestStatuses.Approved,
            _ => false
        };

    private async Task<(EmployeeResponse? Employee,
        LeaveRequestOperationStatus? Error)> ResolveActiveEmployeeAsync(
        HttpContext context, CancellationToken cancellationToken)
    {
        var current = await currentEmployeeResolver.ResolveAsync(context, cancellationToken);
        if (current.Status != CurrentEmployeeResolutionStatus.Success)
            return (null, LeaveRequestOperationStatus.CurrentEmployeeNotLinked);
        return IsEmployeeActive(current.Employee!)
            ? (current.Employee, null)
            : (null, LeaveRequestOperationStatus.CurrentEmployeeInactive);
    }

    private static Dictionary<string, string[]> ValidateCreate(CreateLeaveRequest request)
    {
        Dictionary<string, string[]> errors = [];
        if (!request.LeaveTypeId.HasValue || request.LeaveTypeId == Guid.Empty)
            errors["leaveTypeId"] = ["Leave type is required."];
        if (!request.DateFrom.HasValue) errors["dateFrom"] = ["Start date is required."];
        if (!request.DateTo.HasValue) errors["dateTo"] = ["End date is required."];
        if (request.DateFrom.HasValue && request.DateTo.HasValue)
        {
            if (request.DateTo < request.DateFrom)
                errors["dateTo"] = ["The end date cannot precede the start date."];
            else if (request.DateFrom.Value.Year != request.DateTo.Value.Year)
                errors["dateTo"] = ["A request cannot span calendar years."];
        }
        if (NormalizeOptional(request.Note)?.Length > NoteMaxLength)
            errors["note"] = [$"Note must not exceed {NoteMaxLength} characters."];
        return errors;
    }

    private static bool TryGetActor(HttpContext context, out Guid actor) =>
        Guid.TryParse(context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out actor);

    private static bool IsEmployeeActive(EmployeeResponse employee) =>
        string.Equals(employee.EmploymentStatus, "ACTIVE",
            StringComparison.OrdinalIgnoreCase);

    private static bool IsEnglish(string? acceptLanguage) =>
        acceptLanguage?.StartsWith("en", StringComparison.OrdinalIgnoreCase) == true;

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
