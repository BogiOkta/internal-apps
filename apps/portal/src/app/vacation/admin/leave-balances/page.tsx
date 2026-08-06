"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { PortalDateInput } from "@/components/portal-date-input";
import { PortalNotification } from "@/components/portal-notification";
import { PortalNotificationHost } from "@/components/portal-notification-host";
import { VacationWorkspace } from "@/features/vacation/components/vacation-workspace";
import { useTranslations } from "@/i18n/use-translations";
import { formatPortalDate, formatPortalDateTime } from "@/utils/portal-date-format";
import { ApiError } from "@/services/auth";
import {
  getLeaveBalance,
  listLeaveBalanceHistory,
  listLeaveBalanceScopes,
  postLeaveBalanceEntry,
} from "@/services/leave-balances";
import { getEmployees } from "@/services/organization";
import { listLeaveTypes } from "@/services/vacation";
import {
  leaveBalanceManagePermission,
  type LeaveBalance,
  type LeaveBalanceEntry,
  type LeaveBalanceScope,
  type PostLeaveBalanceEntryRequest,
} from "@/types/leave-balance";
import type { Employee } from "@/types/organization";
import type { LeaveType } from "@/types/vacation";

const currentYear = new Date().getFullYear();
const overviewColumnCount = 7;
const historyColumnCount = 6;

type EntryForm = PostLeaveBalanceEntryRequest & {
  kind: "annual_entitlement" | "carry_over" | "manual_adjustment";
};
type FeedbackKey =
  | "leaveBalance.loadError"
  | "leaveBalance.scopeValidation"
  | "leaveBalance.validation"
  | "leaveBalance.created"
  | "leaveBalance.duplicate"
  | "leaveBalance.insufficient"
  | "leaveBalance.saveError";

type ScopeFilters = {
  employeeId: string;
  leaveTypeId: string;
  year: string;
};

function scopeKey(scope: {
  employeeId: string;
  leaveTypeId: string;
  leaveYear: number;
}) {
  return `${scope.employeeId}:${scope.leaveTypeId}:${scope.leaveYear}`;
}

export default function LeaveBalancesPage() {
  const { accessToken, user } = useAuth();
  const { browserLocale, t } = useTranslations();
  const allowed = user?.permissions.includes(leaveBalanceManagePermission) ?? false;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [filters, setFilters] = useState<ScopeFilters>({
    employeeId: "",
    leaveTypeId: "",
    year: "",
  });
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [debouncedEmployeeSearch, setDebouncedEmployeeSearch] = useState("");
  const [scopes, setScopes] = useState<LeaveBalanceScope[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [history, setHistory] = useState<LeaveBalanceEntry[]>([]);
  const [loadingScopes, setLoadingScopes] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; key: FeedbackKey } | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [form, setForm] = useState<EntryForm>({
    kind: "annual_entitlement",
    employeeId: "",
    leaveTypeId: "",
    leaveYear: currentYear,
    quantityDays: 0,
    effectiveDate: `${currentYear}-01-01`,
    reason: "",
    explanation: null,
    sourceReference: "",
  });
  const pendingDeepLink = useRef<{
    employeeId: string;
    leaveTypeId: string;
    year: number;
  } | null>(null);
  const deepLinkHandled = useRef(false);

  const selectedScope = useMemo(
    () => scopes.find((scope) => scopeKey(scope) === selectedKey) ?? null,
    [scopes, selectedKey],
  );
  const detailOpen = selectedKey !== null;
  const scopedYear = filters.year ? Number(filters.year) : null;
  const hasExactScopeFilters =
    Boolean(filters.employeeId && filters.leaveTypeId) &&
    scopedYear !== null &&
    Number.isInteger(scopedYear) &&
    scopedYear >= 1900 &&
    scopedYear <= 9999;
  const canOpenNewScope = hasExactScopeFilters && !loadingScopes && scopes.length === 0;

  const filteredHistory = useMemo(() => {
    const needle = historySearch.trim().toLocaleLowerCase();
    if (!needle) return history;
    return history.filter((entry) => {
      const kindLabel = t(`leaveBalance.kind.${entry.entryKind}`).toLocaleLowerCase();
      const haystack = [
        formatPortalDateTime(entry.acceptedAt),
        formatPortalDate(entry.effectiveDate),
        kindLabel,
        String(entry.quantityDays),
        entry.reason,
        entry.explanation ?? "",
        entry.sourceReference,
      ]
        .join(" ")
        .toLocaleLowerCase();
      return haystack.includes(needle);
    });
  }, [history, historySearch, t]);

  const visibleRows = detailOpen ? filteredHistory : scopes;
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const pageSlice = visibleRows.slice((page - 1) * pageSize, page * pageSize);
  const activeFilterCount =
    (filters.employeeId ? 1 : 0) +
    (filters.leaveTypeId ? 1 : 0) +
    (filters.year ? 1 : 0) +
    (debouncedEmployeeSearch.trim() ? 1 : 0);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedEmployeeSearch(employeeSearch),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [employeeSearch]);

  useEffect(() => {
    if (!accessToken || !allowed) return;
    const params = new URLSearchParams(window.location.search);
    const leaveTypeIdParam = params.get("leaveTypeId");
    const employeeIdParam = params.get("employeeId");
    const yearParam = params.get("year");
    const parsedYear = yearParam ? Number(yearParam) : NaN;
    const yearFromQuery =
      Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
        ? parsedYear
        : null;

    // Dependency Inspector deep-links carry the full balance key. Auto-select
    // that exact scope once filters and the overview have loaded.
    if (leaveTypeIdParam && employeeIdParam && yearFromQuery !== null) {
      pendingDeepLink.current = {
        employeeId: employeeIdParam,
        leaveTypeId: leaveTypeIdParam,
        year: yearFromQuery,
      };
      setFilters({
        employeeId: employeeIdParam,
        leaveTypeId: leaveTypeIdParam,
        year: String(yearFromQuery),
      });
    } else {
      setFilters((current) => ({
        ...current,
        leaveTypeId: leaveTypeIdParam ?? current.leaveTypeId,
        employeeId: employeeIdParam ?? current.employeeId,
        year: yearFromQuery !== null ? String(yearFromQuery) : current.year,
      }));
    }
  }, [accessToken, allowed]);

  useEffect(() => setPage(1), [
    employeeSearch,
    historySearch,
    pageSize,
    filters.employeeId,
    filters.leaveTypeId,
    filters.year,
    selectedKey,
    scopes,
    history,
  ]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const loadOptions = useCallback(
    async (signal?: AbortSignal) => {
      if (!accessToken || !allowed) return;
      try {
        const [employeeRows, typeRows] = await Promise.all([
          getEmployees(accessToken, { sort: "name" }, signal),
          listLeaveTypes(
            accessToken,
            browserLocale,
            { status: "all", sortBy: "displayOrder", sortDirection: "asc" },
            signal,
          ),
        ]);
        setEmployees(employeeRows);
        setLeaveTypes(typeRows.filter((type) => type.requiresBalance));
      } catch {
        if (!signal?.aborted) setFeedback({ error: true, key: "leaveBalance.loadError" });
      }
    },
    [accessToken, allowed, browserLocale],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadOptions(controller.signal);
    return () => controller.abort();
  }, [loadOptions]);

  const loadScopes = useCallback(
    async (signal?: AbortSignal) => {
      if (!accessToken || !allowed) return;
      setLoadingScopes(true);
      setFeedback(null);
      try {
        const yearValue = filters.year ? Number(filters.year) : undefined;
        const validYear =
          yearValue !== undefined &&
          Number.isInteger(yearValue) &&
          yearValue >= 1900 &&
          yearValue <= 9999
            ? yearValue
            : undefined;
        if (
          filters.year &&
          validYear === undefined
        ) {
          setScopes([]);
          setFeedback({ error: true, key: "leaveBalance.scopeValidation" });
          return;
        }
        const rows = await listLeaveBalanceScopes(
          accessToken,
          browserLocale,
          {
            employeeId: filters.employeeId || undefined,
            leaveTypeId: filters.leaveTypeId || undefined,
            year: validYear,
            search: debouncedEmployeeSearch || undefined,
          },
          signal,
        );
        if (signal?.aborted) return;
        setScopes(rows);
      } catch {
        if (!signal?.aborted) setFeedback({ error: true, key: "leaveBalance.loadError" });
      } finally {
        if (!signal?.aborted) setLoadingScopes(false);
      }
    },
    [
      accessToken,
      allowed,
      browserLocale,
      debouncedEmployeeSearch,
      filters.employeeId,
      filters.leaveTypeId,
      filters.year,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadScopes(controller.signal);
    return () => controller.abort();
  }, [loadScopes]);

  const loadDetail = useCallback(
    async (
      scope: { employeeId: string; leaveTypeId: string; leaveYear: number },
      signal?: AbortSignal,
    ) => {
      if (!accessToken) return;
      setLoadingDetail(true);
      setFeedback(null);
      try {
        const entries = await listLeaveBalanceHistory(
          accessToken,
          scope.employeeId,
          scope.leaveTypeId,
          scope.leaveYear,
          signal,
        );
        if (signal?.aborted) return;
        setHistory(entries);
        try {
          setBalance(
            await getLeaveBalance(
              accessToken,
              scope.employeeId,
              scope.leaveTypeId,
              scope.leaveYear,
              signal,
            ),
          );
        } catch (error) {
          if (signal?.aborted) return;
          if (error instanceof ApiError && error.status === 404) setBalance(null);
          else throw error;
        }
        setForm((value) => ({
          ...value,
          employeeId: scope.employeeId,
          leaveTypeId: scope.leaveTypeId,
          leaveYear: scope.leaveYear,
          effectiveDate: `${scope.leaveYear}-01-01`,
        }));
      } catch {
        if (!signal?.aborted) setFeedback({ error: true, key: "leaveBalance.loadError" });
      } finally {
        if (!signal?.aborted) setLoadingDetail(false);
      }
    },
    [accessToken],
  );

  function clearSelection() {
    setSelectedKey(null);
    setBalance(null);
    setHistory([]);
    setHistorySearch("");
    setFeedback(null);
  }

  function changeFilters(next: ScopeFilters) {
    setFilters(next);
    clearSelection();
  }

  function clearScopeFilters() {
    changeFilters({ employeeId: "", leaveTypeId: "", year: "" });
    setEmployeeSearch("");
    setDebouncedEmployeeSearch("");
  }

  function selectScope(scope: {
    employeeId: string;
    leaveTypeId: string;
    leaveYear: number;
  }) {
    const key = scopeKey(scope);
    setSelectedKey(key);
    setHistorySearch("");
    void loadDetail(scope);
  }

  useEffect(() => {
    const pending = pendingDeepLink.current;
    if (!pending || deepLinkHandled.current || loadingScopes) return;
    if (
      filters.employeeId !== pending.employeeId ||
      filters.leaveTypeId !== pending.leaveTypeId ||
      filters.year !== String(pending.year)
    ) {
      return;
    }
    deepLinkHandled.current = true;
    pendingDeepLink.current = null;
    const key = scopeKey({
      employeeId: pending.employeeId,
      leaveTypeId: pending.leaveTypeId,
      leaveYear: pending.year,
    });
    setSelectedKey(key);
    setHistorySearch("");
    void loadDetail({
      employeeId: pending.employeeId,
      leaveTypeId: pending.leaveTypeId,
      leaveYear: pending.year,
    });
  }, [
    filters.employeeId,
    filters.leaveTypeId,
    filters.year,
    loadDetail,
    loadingScopes,
    scopes,
  ]);

  function openFilteredScope() {
    if (!filters.employeeId || !filters.leaveTypeId || !filters.year) {
      setFeedback({ error: true, key: "leaveBalance.scopeValidation" });
      return;
    }
    const year = Number(filters.year);
    if (!Number.isInteger(year) || year < 1900 || year > 9999) {
      setFeedback({ error: true, key: "leaveBalance.scopeValidation" });
      return;
    }
    selectScope({
      employeeId: filters.employeeId,
      leaveTypeId: filters.leaveTypeId,
      leaveYear: year,
    });
  }

  async function refresh() {
    await loadScopes();
    if (selectedKey) {
      const [employeeId, leaveTypeId, leaveYear] = selectedKey.split(":");
      await loadDetail({
        employeeId,
        leaveTypeId,
        leaveYear: Number(leaveYear),
      });
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || saving) return;
    const positive = form.kind !== "manual_adjustment";
    if (
      !form.employeeId ||
      !form.leaveTypeId ||
      !form.reason.trim() ||
      !form.sourceReference.trim() ||
      !form.effectiveDate ||
      form.effectiveDate.slice(0, 4) !== String(form.leaveYear) ||
      form.quantityDays === 0 ||
      form.quantityDays * 2 !== Math.trunc(form.quantityDays * 2) ||
      (positive && form.quantityDays < 0)
    ) {
      setFeedback({ error: true, key: "leaveBalance.validation" });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await postLeaveBalanceEntry(accessToken, form.kind, {
        ...form,
        reason: form.reason.trim(),
        explanation: form.explanation?.trim() || null,
        sourceReference: form.sourceReference.trim(),
      });
      setForm((value) => ({
        ...value,
        quantityDays: 0,
        reason: "",
        explanation: null,
        sourceReference: "",
      }));
      await loadDetail({
        employeeId: form.employeeId,
        leaveTypeId: form.leaveTypeId,
        leaveYear: form.leaveYear,
      });
      await loadScopes();
      setFeedback({ error: false, key: "leaveBalance.created" });
    } catch (error) {
      const code = error instanceof ApiError ? error.problem?.code : undefined;
      setFeedback({
        error: true,
        key:
          code === "leave_balance_entry_source_conflict"
            ? "leaveBalance.duplicate"
            : code === "leave_balance_insufficient"
              ? "leaveBalance.insufficient"
              : "leaveBalance.saveError",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return (
      <VacationWorkspace title={t("leaveBalance.title")}>
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
          {t("leaveBalance.forbidden")}
        </div>
      </VacationWorkspace>
    );
  }

  const loading = detailOpen ? loadingDetail : loadingScopes;

  return (
    <VacationWorkspace
      title={t("leaveBalance.title")}
      description={t("leaveBalance.description")}
      contentFillsViewport
      sectionActions={
        detailOpen ? (
          <button
            type="button"
            disabled={loading}
            onClick={clearSelection}
            className={formPrimaryButtonClassName()}
          >
            {t("leaveBalance.backToOverview")}
          </button>
        ) : canOpenNewScope ? (
          <button
            type="button"
            disabled={loading}
            onClick={openFilteredScope}
            className={formPrimaryButtonClassName()}
          >
            {t("leaveBalance.openScope")}
          </button>
        ) : null
      }
      sectionSecondaryActions={
        <button
          type="button"
          disabled={loading}
          onClick={() => void refresh()}
          className={formSecondaryButtonClassName()}
        >
          {portalActionContent(
            "refresh",
            loading ? t("leaveBalance.refreshing") : t("leaveBalance.refresh"),
          )}
        </button>
      }
    >
      <PortalNotificationHost>
        {feedback ? (
          <PortalNotification
            variant={feedback.error ? "error" : "success"}
            message={t(feedback.key)}
            dismissLabel={t("common.dismissNotification")}
            onDismiss={() => setFeedback(null)}
          />
        ) : null}
      </PortalNotificationHost>
      <AdministrationPageBody>
        <AdministrativeGridShell
          ariaLabel={
            detailOpen ? t("leaveBalance.tableLabel") : t("leaveBalance.overviewTableLabel")
          }
          fillViewport
          toolbar={
            <AdministrativeGridToolbar
              search={detailOpen ? historySearch : employeeSearch}
              searchLabel={
                detailOpen
                  ? t("leaveBalance.searchLabel")
                  : t("leaveBalance.employeeSearchLabel")
              }
              searchPlaceholder={
                detailOpen
                  ? t("leaveBalance.searchPlaceholder")
                  : t("leaveBalance.employeeSearchPlaceholder")
              }
              onSearchChange={detailOpen ? setHistorySearch : setEmployeeSearch}
              activeFilterCount={activeFilterCount}
              areFiltersVisible
              exportDisabled
              filtersLabel={t("grid.filters")}
              showFiltersLabel={t("grid.showFilters")}
              hideFiltersLabel={t("grid.hideFilters")}
              clearFiltersLabel={t("grid.clearFilters")}
              exportLabel={t("grid.export")}
              exportCsvLabel={t("grid.exportCsv")}
              exportExcelLabel={t("grid.exportExcel")}
              onToggleFilters={() => undefined}
              onClearFilters={clearScopeFilters}
              onExportCsv={() => undefined}
              onExportExcel={() => undefined}
            />
          }
          viewport={
            <>
              <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
                <SelectField
                  id="balance-employee"
                  label={t("leaveBalance.employee")}
                  value={filters.employeeId}
                  onChange={(employeeId) => changeFilters({ ...filters, employeeId })}
                  empty={t("leaveBalance.allEmployees")}
                  required={false}
                  options={employees.map((employee) => ({
                    value: employee.publicId,
                    label: `${employee.lastName}, ${employee.firstName} (${employee.employeeNumber})`,
                  }))}
                />
                <SelectField
                  id="balance-leave-type"
                  label={t("leaveBalance.leaveType")}
                  value={filters.leaveTypeId}
                  onChange={(leaveTypeId) => changeFilters({ ...filters, leaveTypeId })}
                  empty={t("leaveBalance.allLeaveTypes")}
                  required={false}
                  options={leaveTypes.map((type) => ({
                    value: type.publicId,
                    label: type.name,
                  }))}
                />
                <FormField id="balance-year" label={t("leaveBalance.year")}>
                  <input
                    id="balance-year"
                    type="number"
                    min={1900}
                    max={9999}
                    placeholder={t("leaveBalance.allYears")}
                    value={filters.year}
                    onChange={(event) =>
                      changeFilters({ ...filters, year: event.target.value })
                    }
                    className={formControlClassName()}
                  />
                </FormField>
              </div>
              {detailOpen ? (
                <>
                  <div className="border-b border-slate-200 bg-white px-4 py-3">
                    <p className="text-sm text-slate-600">{t("leaveBalance.current")}</p>
                    <p className="text-2xl font-semibold text-slate-950">
                      {balance ? balance.balanceDays : "—"}
                    </p>
                    {selectedScope ? (
                      <p className="mt-1 text-sm text-slate-600">
                        {selectedScope.employeeName} ({selectedScope.employeeNumber}) ·{" "}
                        {selectedScope.leaveTypeName} · {selectedScope.leaveYear}
                      </p>
                    ) : null}
                  </div>
                  <table className="w-full min-w-[800px] text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-100 text-xs font-semibold text-slate-600">
                      <tr>
                        {(
                          [
                            "leaveBalance.accepted",
                            "leaveBalance.effective",
                            "leaveBalance.entryKind",
                            "leaveBalance.quantity",
                            "leaveBalance.reason",
                            "leaveBalance.source",
                          ] as const
                        ).map((key) => (
                          <th key={key} className="px-3 py-3">
                            {t(key)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {loadingDetail || filteredHistory.length === 0 ? (
                        <GridStateRows
                          columnCount={historyColumnCount}
                          isLoading={loadingDetail}
                          hasError={Boolean(feedback?.error)}
                          isEmpty={filteredHistory.length === 0}
                          loadingLabel={t("common.loading")}
                          emptyTitle={t("leaveBalance.empty")}
                          emptyDescription={t("leaveBalance.emptyDescription")}
                        />
                      ) : (
                        (pageSlice as LeaveBalanceEntry[]).map((entry) => (
                          <tr key={entry.publicId}>
                            <td className="px-3 py-3">
                              {formatPortalDateTime(entry.acceptedAt)}
                            </td>
                            <td className="px-3 py-3">
                              {formatPortalDate(entry.effectiveDate)}
                            </td>
                            <td className="px-3 py-3">
                              {t(`leaveBalance.kind.${entry.entryKind}`)}
                            </td>
                            <td className="px-3 py-3">{entry.quantityDays}</td>
                            <td className="px-3 py-3">
                              {entry.reason}
                              {entry.explanation ? ` — ${entry.explanation}` : ""}
                            </td>
                            <td className="px-3 py-3">{entry.sourceReference}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </>
              ) : (
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-xs font-semibold text-slate-600">
                    <tr>
                      {(
                        [
                          "leaveBalance.employee",
                          "leaveBalance.leaveType",
                          "leaveBalance.year",
                          "leaveBalance.current",
                          "leaveBalance.entryCount",
                          "leaveBalance.lastActivity",
                          "leaveBalance.actions",
                        ] as const
                      ).map((key) => (
                        <th key={key} className="px-3 py-3">
                          {t(key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loadingScopes || scopes.length === 0 ? (
                      <GridStateRows
                        columnCount={overviewColumnCount}
                        isLoading={loadingScopes}
                        hasError={Boolean(feedback?.error)}
                        isEmpty={scopes.length === 0}
                        loadingLabel={t("common.loading")}
                        emptyTitle={t("leaveBalance.emptyOverview")}
                        emptyDescription={t("leaveBalance.emptyOverviewDescription")}
                      />
                    ) : (
                      (pageSlice as LeaveBalanceScope[]).map((scope) => (
                        <tr
                          key={scopeKey(scope)}
                          className={
                            selectedKey === scopeKey(scope) ? "bg-slate-50" : undefined
                          }
                        >
                          <td className="px-3 py-3 font-medium">
                            {scope.employeeName} ({scope.employeeNumber})
                          </td>
                          <td className="px-3 py-3">{scope.leaveTypeName}</td>
                          <td className="px-3 py-3">{scope.leaveYear}</td>
                          <td className="px-3 py-3">{scope.balanceDays}</td>
                          <td className="px-3 py-3">{scope.entryCount}</td>
                          <td className="px-3 py-3">
                            {formatPortalDateTime(scope.lastActivityAt)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <button
                              type="button"
                              className="text-blue-700 underline"
                              onClick={() => selectScope(scope)}
                            >
                              {t("leaveBalance.details")}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </>
          }
          pagination={
            <GridPagination
              page={page}
              pageSize={pageSize}
              totalCount={visibleRows.length}
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
            detailOpen ? (
              <form onSubmit={submit} className="space-y-4">
                <h2 className="text-lg font-semibold">{t("leaveBalance.createTitle")}</h2>
                <SelectField
                  id="entry-kind"
                  label={t("leaveBalance.entryKind")}
                  value={form.kind}
                  onChange={(kind) =>
                    setForm({ ...form, kind: kind as EntryForm["kind"] })
                  }
                  options={[
                    {
                      value: "annual_entitlement",
                      label: t("leaveBalance.kind.annual_entitlement"),
                    },
                    {
                      value: "carry_over",
                      label: t("leaveBalance.kind.carry_over"),
                    },
                    {
                      value: "manual_adjustment",
                      label: t("leaveBalance.kind.manual_adjustment"),
                    },
                  ]}
                />
                <FormField id="entry-quantity" label={t("leaveBalance.quantity")} required>
                  <input
                    id="entry-quantity"
                    type="number"
                    step="0.5"
                    required
                    value={form.quantityDays}
                    onChange={(event) =>
                      setForm({ ...form, quantityDays: Number(event.target.value) })
                    }
                    className={formControlClassName()}
                  />
                </FormField>
                <FormField
                  id="entry-effective"
                  label={t("leaveBalance.effective")}
                  required
                  hint={t("dateInput.hint")}
                >
                  <PortalDateInput
                    id="entry-effective"
                    value={form.effectiveDate || null}
                    nullable={false}
                    disabled={saving}
                    onChange={(value) =>
                      setForm({ ...form, effectiveDate: value ?? "" })
                    }
                    invalidLabel={t("dateInput.invalid")}
                    incompleteLabel={t("dateInput.incomplete")}
                    todayLabel={t("dateInput.today")}
                    clearLabel={t("dateInput.clear")}
                    openCalendarLabel={t("dateInput.openCalendar")}
                    previousMonthLabel={t("dateInput.previousMonth")}
                    nextMonthLabel={t("dateInput.nextMonth")}
                  />
                </FormField>
                <FormField id="entry-reason" label={t("leaveBalance.reason")} required>
                  <input
                    id="entry-reason"
                    maxLength={200}
                    required
                    value={form.reason}
                    onChange={(event) => setForm({ ...form, reason: event.target.value })}
                    className={formControlClassName()}
                  />
                </FormField>
                <FormField id="entry-explanation" label={t("leaveBalance.explanation")}>
                  <textarea
                    id="entry-explanation"
                    maxLength={1000}
                    value={form.explanation ?? ""}
                    onChange={(event) =>
                      setForm({ ...form, explanation: event.target.value || null })
                    }
                    className={`${formControlClassName()} min-h-20`}
                  />
                </FormField>
                <FormField id="entry-source" label={t("leaveBalance.source")} required>
                  <input
                    id="entry-source"
                    maxLength={100}
                    required
                    value={form.sourceReference}
                    onChange={(event) =>
                      setForm({ ...form, sourceReference: event.target.value })
                    }
                    className={formControlClassName()}
                  />
                </FormField>
                <button disabled={saving} className={formPrimaryButtonClassName()}>
                  {saving ? t("leaveBalance.saving") : t("leaveBalance.save")}
                </button>
              </form>
            ) : (
              <p className="text-sm text-slate-600">{t("leaveBalance.selectScope")}</p>
            )
          }
        />
      </AdministrationPageBody>
    </VacationWorkspace>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  empty,
  required = true,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  empty?: string;
  required?: boolean;
}) {
  return (
    <FormField id={id} label={label} required={required}>
      <select
        id={id}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={formControlClassName()}
      >
        {empty && <option value="">{empty}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}
