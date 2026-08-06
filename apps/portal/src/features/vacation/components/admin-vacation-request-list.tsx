"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdministrativeGridShell, GridStateRows } from "@/components/admin-data-grid";
import { AdministrationPageBody } from "@/components/administration-page-body";
import { AdministrativeGridToolbar } from "@/components/administrative-grid-toolbar";
import { useAuth } from "@/components/auth-provider";
import {
  FormField,
  formControlClassName,
  formPrimaryButtonClassName,
  formSecondaryButtonClassName,
} from "@/components/form-field";
import { GridPagination } from "@/components/grid-pagination";
import { portalActionContent } from "@/components/portal-action-icon";
import { PortalNotification } from "@/components/portal-notification";
import { PortalNotificationHost } from "@/components/portal-notification-host";
import {
  problemMessage,
  statusLabel,
} from "@/features/vacation/components/employee-vacation-dashboard";
import { VACATION_REQUEST_DELETED_NOTICE_KEY } from "@/features/vacation/vacation-request-utils";
import { VacationStatusBadge } from "@/features/vacation/components/vacation-status-badge";
import { VacationWorkspace } from "@/features/vacation/components/vacation-workspace";
import type { TranslationKey } from "@/i18n/translations";
import { useTranslations } from "@/i18n/use-translations";
import { ApiError } from "@/services/auth";
import { listAdminVacationRequests, listLeaveTypes } from "@/services/vacation";
import {
  vacationRequestsManagePermission,
  type LeaveType,
  type PagedVacationRequests,
  type VacationRequest,
  type VacationRequestStatus,
  type VacationRequestSource,
} from "@/types/vacation";
import { formatPortalDate, formatPortalDateTime } from "@/utils/portal-date-format";

const columnCount = 8;
const currentYear = new Date().getFullYear();

export function AdminVacationRequestList() {
  const { accessToken, user } = useAuth();
  const { locale, t } = useTranslations();
  const allowed = user?.permissions.includes(vacationRequestsManagePermission) ?? false;
  const [result, setResult] = useState<PagedVacationRequests | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [status, setStatus] = useState<"all" | VacationRequestStatus>("all");
  const [source, setSource] = useState<"all" | VacationRequestSource>("all");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [year, setYear] = useState(String(currentYear));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [areFiltersVisible, setAreFiltersVisible] = useState(true);
  const [selectedPublicId, setSelectedPublicId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    if (window.sessionStorage.getItem(VACATION_REQUEST_DELETED_NOTICE_KEY) !== "1") {
      return;
    }
    window.sessionStorage.removeItem(VACATION_REQUEST_DELETED_NOTICE_KEY);
    setSelectedPublicId(null);
    setSuccess(t("vacation.admin.action.delete.success"));
    setRefreshVersion((version) => version + 1);
  }, [t]);

  useEffect(() => {
    if (!accessToken || !allowed) return;
    const params = new URLSearchParams(window.location.search);
    const leaveTypeIdParam = params.get("leaveTypeId");
    if (leaveTypeIdParam) {
      setLeaveTypeId(leaveTypeIdParam);
    }
  }, [accessToken, allowed]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => setPage(1), [status, source, leaveTypeId, search, year, pageSize]);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!accessToken || !allowed) return;
    setIsLoading(true);
    setErrorCode(null);
    try {
      const selectedYear = Number(year);
      const [requests, types] = await Promise.all([
        listAdminVacationRequests(accessToken, locale, {
          status: status === "all" ? undefined : status,
          source: source === "all" ? undefined : source,
          leaveTypeId: leaveTypeId || undefined,
          search: search || undefined,
          dateFrom: `${selectedYear}-01-01`,
          dateTo: `${selectedYear}-12-31`,
          page,
          pageSize,
        }, signal),
        listLeaveTypes(accessToken, locale, { status: "all" }, signal),
      ]);
      setResult(requests);
      setLeaveTypes(types);
      setSelectedPublicId((current) =>
        current && requests.items.some((request) => request.publicId === current)
          ? current
          : null,
      );
    } catch (error) {
      if (!signal?.aborted) {
        setResult(null);
        setSelectedPublicId(null);
        setErrorCode(error instanceof ApiError
          ? error.problem?.code ?? "generic" : "generic");
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [accessToken, allowed, leaveTypeId, locale, page, pageSize, search, source, status, year]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refreshVersion]);

  const years = useMemo(() => {
    return Array.from({ length: currentYear - 1999 }, (_, index) => currentYear - index);
  }, []);

  const selectedRequest = useMemo(
    () => result?.items.find((request) => request.publicId === selectedPublicId) ?? null,
    [result, selectedPublicId],
  );

  const activeFilterCount =
    (status !== "all" ? 1 : 0) +
    (source !== "all" ? 1 : 0) +
    (leaveTypeId ? 1 : 0) +
    (year !== String(currentYear) ? 1 : 0);

  function clearFilters() {
    setStatus("all");
    setSource("all");
    setLeaveTypeId("");
    setYear(String(currentYear));
    setSearchInput("");
    setSearch("");
  }

  if (!allowed) {
    return (
      <VacationWorkspace title={t("vacation.admin.title")}>
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
          {t("vacation.admin.forbidden")}
        </div>
      </VacationWorkspace>
    );
  }

  return (
    <VacationWorkspace
      title={t("vacation.admin.title")}
      description={t("vacation.admin.description")}
      contentFillsViewport
      sectionActions={
        <Link
          href="/vacation/admin/requests/record"
          className={formPrimaryButtonClassName()}
        >
          {portalActionContent("create", t("vacation.admin.record"))}
        </Link>
      }
      sectionSecondaryActions={
        <button
          type="button"
          disabled={isLoading}
          onClick={() => setRefreshVersion((value) => value + 1)}
          className={formSecondaryButtonClassName()}
        >
          {portalActionContent(
            "refresh",
            isLoading ? t("vacation.admin.refreshing") : t("vacation.admin.refresh"),
          )}
        </button>
      }
    >
      <PortalNotificationHost>
        {success ? (
          <PortalNotification
            variant="success"
            message={success}
            dismissLabel={t("common.dismissNotification")}
            onDismiss={() => setSuccess(null)}
          />
        ) : null}
        {errorCode ? (
          <PortalNotification
            variant="error"
            message={problemMessage(errorCode, t)}
            dismissLabel={t("common.dismissNotification")}
            onDismiss={() => setErrorCode(null)}
          />
        ) : null}
      </PortalNotificationHost>
      <AdministrationPageBody>
        <AdministrativeGridShell
          ariaLabel={t("vacation.admin.tableLabel")}
          fillViewport
          toolbar={
            <AdministrativeGridToolbar
              search={searchInput}
              searchLabel={t("vacation.admin.filter.employee")}
              searchPlaceholder={t("vacation.admin.filter.employeePlaceholder")}
              onSearchChange={setSearchInput}
              activeFilterCount={activeFilterCount}
              areFiltersVisible={areFiltersVisible}
              exportDisabled
              filtersLabel={t("grid.filters")}
              showFiltersLabel={t("grid.showFilters")}
              hideFiltersLabel={t("grid.hideFilters")}
              clearFiltersLabel={t("grid.clearFilters")}
              exportLabel={t("grid.export")}
              exportCsvLabel={t("grid.exportCsv")}
              exportExcelLabel={t("grid.exportExcel")}
              onToggleFilters={() => setAreFiltersVisible((value) => !value)}
              onClearFilters={clearFilters}
              onExportCsv={() => undefined}
              onExportExcel={() => undefined}
            />
          }
          viewport={
            <>
              {areFiltersVisible ? (
                <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-4">
                  <FormField id="admin-request-status" label={t("vacation.admin.filter.status")}>
                    <select
                      id="admin-request-status"
                      className={formControlClassName()}
                      value={status}
                      onChange={(event) =>
                        setStatus(event.target.value as typeof status)
                      }
                    >
                      {["all", "submitted", "approved", "rejected", "cancelled"].map((value) => (
                        <option
                          key={value}
                          value={value === "all" ? "all" : value.toUpperCase()}
                        >
                          {t(`vacation.employeePortal.status.${value}` as TranslationKey)}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField
                    id="admin-request-leave-type"
                    label={t("vacation.admin.filter.leaveType")}
                  >
                    <select
                      id="admin-request-leave-type"
                      className={formControlClassName()}
                      value={leaveTypeId}
                      onChange={(event) => setLeaveTypeId(event.target.value)}
                    >
                      <option value="">{t("vacation.admin.filter.allLeaveTypes")}</option>
                      {leaveTypes.map((type) => (
                        <option key={type.publicId} value={type.publicId}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField id="admin-request-source" label={t("vacation.admin.filter.source")}>
                    <select
                      id="admin-request-source"
                      className={formControlClassName()}
                      value={source}
                      onChange={(event) =>
                        setSource(event.target.value as typeof source)
                      }
                    >
                      <option value="all">{t("vacation.admin.filter.allSources")}</option>
                      <option value="EMPLOYEE_REQUEST">
                        {t("vacation.admin.source.employeeRequest")}
                      </option>
                      <option value="ADMINISTRATIVE_ENTRY">
                        {t("vacation.admin.source.administrativeEntry")}
                      </option>
                    </select>
                  </FormField>
                  <FormField id="admin-request-year" label={t("vacation.admin.filter.year")}>
                    <select
                      id="admin-request-year"
                      className={formControlClassName()}
                      value={year}
                      onChange={(event) => setYear(event.target.value)}
                    >
                      {years.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
              ) : null}
              <table className="w-full min-w-[1040px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100 text-xs font-semibold text-slate-600">
                  <tr>
                    {(
                      [
                        "employee",
                        "leaveType",
                        "dateRange",
                        "workingDays",
                        "source",
                        "submitted",
                        "status",
                        "details",
                      ] as const
                    ).map((key) => (
                      <th key={key} className="px-3 py-3">
                        {t(`vacation.admin.column.${key}` as TranslationKey)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <GridStateRows
                    columnCount={columnCount}
                    isLoading={isLoading}
                    hasError={Boolean(errorCode)}
                    isEmpty={!result?.items.length}
                    loadingLabel={t("common.loading")}
                    emptyTitle={t("vacation.admin.empty")}
                    emptyDescription={t("vacation.admin.emptyDescription")}
                  />
                  {!isLoading &&
                    !errorCode &&
                    result?.items.map((request) => {
                      const isSelected = request.publicId === selectedPublicId;
                      return (
                        <tr
                          key={request.publicId}
                          aria-selected={isSelected}
                          onClick={() => setSelectedPublicId(request.publicId)}
                          className={`cursor-pointer hover:bg-slate-50 ${
                            isSelected
                              ? "bg-blue-50 shadow-[inset_3px_0_0_#1d4ed8]"
                              : "bg-white"
                          }`}
                        >
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              aria-pressed={isSelected}
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedPublicId(request.publicId);
                              }}
                              className="rounded-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                            >
                              <span className="font-medium">{request.employeeName}</span>
                              <span className="block text-xs text-slate-500">
                                {request.employeeNumber}
                              </span>
                            </button>
                          </td>
                          <td className="px-3 py-3">{request.leaveTypeName}</td>
                          <td className="px-3 py-3">
                            {formatPortalDate(request.dateFrom)} –{" "}
                            {formatPortalDate(request.dateTo)}
                          </td>
                          <td className="px-3 py-3">{request.workingDays}</td>
                          <td className="px-3 py-3">{sourceLabel(request.source, t)}</td>
                          <td className="px-3 py-3">
                            {formatPortalDateTime(request.submittedAt)}
                          </td>
                          <td className="px-3 py-3">
                            <VacationStatusBadge
                              status={request.status}
                              label={requestStatusLabel(request, t)}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <DetailsLink request={request} />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </>
          }
          pagination={
            <GridPagination
              page={page}
              pageSize={pageSize}
              totalCount={result?.totalCount ?? 0}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              labels={{
                range: (from, to, total) => t("grid.visibleRange", { from, to, total }),
                pageSize: t("grid.pageSize"),
                first: t("grid.firstPage"),
                previous: t("grid.previousPage"),
                next: t("grid.nextPage"),
                last: t("grid.lastPage"),
              }}
            />
          }
          detailsPanel={
            selectedRequest ? (
              <RequestDetailsPanel request={selectedRequest} />
            ) : (
              <p className="text-sm text-slate-600">
                {t("vacation.admin.selectForDetails")}
              </p>
            )
          }
        />
      </AdministrationPageBody>
    </VacationWorkspace>
  );
}

function RequestDetailsPanel({ request }: { request: VacationRequest }) {
  const { t } = useTranslations();
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-950">
        {t("vacation.admin.detailsTitle")}
      </h2>
      <dl className="space-y-3 text-sm">
        <DetailItem label={t("vacation.admin.column.employee")} value={request.employeeName} />
        <DetailItem
          label={t("vacation.admin.column.leaveType")}
          value={request.leaveTypeName}
        />
        <DetailItem
          label={t("vacation.admin.column.dateRange")}
          value={`${formatPortalDate(request.dateFrom)} – ${formatPortalDate(request.dateTo)}`}
        />
        <DetailItem
          label={t("vacation.admin.column.workingDays")}
          value={String(request.workingDays)}
        />
        <DetailItem
          label={t("vacation.admin.column.source")}
          value={sourceLabel(request.source, t)}
        />
        <DetailItem
          label={t("vacation.admin.column.submitted")}
          value={formatPortalDateTime(request.submittedAt)}
        />
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">
            {t("vacation.admin.column.status")}
          </dt>
          <dd className="mt-1">
            <VacationStatusBadge
              status={request.status}
              label={requestStatusLabel(request, t)}
            />
          </dd>
        </div>
      </dl>
      <Link
        href={`/vacation/admin/requests/${request.publicId}`}
        className={formPrimaryButtonClassName()}
      >
        {t("vacation.employeePortal.details")}
      </Link>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-950">{value}</dd>
    </div>
  );
}

export function sourceLabel(
  source: VacationRequestSource,
  t: ReturnType<typeof useTranslations>["t"],
) {
  return t(
    source === "ADMINISTRATIVE_ENTRY"
      ? "vacation.admin.source.administrativeEntry"
      : "vacation.admin.source.employeeRequest",
  );
}

export function requestStatusLabel(
  request: VacationRequest,
  t: ReturnType<typeof useTranslations>["t"],
) {
  return request.status === "APPROVED" && request.source === "ADMINISTRATIVE_ENTRY"
    ? t("vacation.admin.status.recorded")
    : statusLabel(request.status, t);
}

function DetailsLink({ request }: { request: VacationRequest }) {
  const { t } = useTranslations();
  return (
    <Link
      href={`/vacation/admin/requests/${request.publicId}`}
      onClick={(event) => event.stopPropagation()}
      className="font-semibold text-blue-700 hover:underline"
    >
      {t("vacation.employeePortal.details")}
    </Link>
  );
}
