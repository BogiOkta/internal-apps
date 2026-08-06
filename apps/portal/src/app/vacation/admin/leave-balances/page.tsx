"use client";

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
import { PortalDateInput } from "@/components/portal-date-input";
import { PortalNotification } from "@/components/portal-notification";
import { PortalNotificationHost } from "@/components/portal-notification-host";
import { VacationWorkspace } from "@/features/vacation/components/vacation-workspace";
import { useTranslations } from "@/i18n/use-translations";
import { formatPortalDate, formatPortalDateTime } from "@/utils/portal-date-format";
import { ApiError } from "@/services/auth";
import { getLeaveBalance, listLeaveBalanceHistory, postLeaveBalanceEntry } from "@/services/leave-balances";
import { getEmployees } from "@/services/organization";
import { listLeaveTypes } from "@/services/vacation";
import {
  leaveBalanceManagePermission,
  type LeaveBalance,
  type LeaveBalanceEntry,
  type PostLeaveBalanceEntryRequest,
} from "@/types/leave-balance";
import type { Employee } from "@/types/organization";
import type { LeaveType } from "@/types/vacation";

const currentYear = new Date().getFullYear();
const columnCount = 6;
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

export default function LeaveBalancesPage() {
  const { accessToken, user } = useAuth();
  const { browserLocale, t } = useTranslations();
  const allowed = user?.permissions.includes(leaveBalanceManagePermission) ?? false;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [scope, setScope] = useState({ employeeId: "", leaveTypeId: "", year: currentYear });
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [history, setHistory] = useState<LeaveBalanceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; key: FeedbackKey } | null>(null);
  const [search, setSearch] = useState("");
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

  const filteredHistory = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
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
  }, [history, search, t]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const visibleHistory = filteredHistory.slice((page - 1) * pageSize, page * pageSize);
  const activeFilterCount =
    (scope.employeeId ? 1 : 0) +
    (scope.leaveTypeId ? 1 : 0) +
    (scope.year !== currentYear ? 1 : 0);

  useEffect(() => {
    if (!accessToken || !allowed) return;
    const params = new URLSearchParams(window.location.search);
    const leaveTypeIdParam = params.get("leaveTypeId");
    const employeeIdParam = params.get("employeeId");
    const yearParam = params.get("year");
    const parsedYear = yearParam ? Number(yearParam) : NaN;

    setScope((current) => {
      const next = {
        ...current,
        leaveTypeId: leaveTypeIdParam ?? current.leaveTypeId,
        employeeId: employeeIdParam ?? current.employeeId,
        year:
          Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
            ? parsedYear
            : current.year,
      };

      if (
        next.leaveTypeId === current.leaveTypeId &&
        next.employeeId === current.employeeId &&
        next.year === current.year
      ) {
        return current;
      }

      return next;
    });
  }, [accessToken, allowed]);

  useEffect(() => setPage(1), [search, pageSize, history]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const loadOptions = useCallback(async (signal?: AbortSignal) => {
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
  }, [accessToken, allowed, browserLocale]);

  useEffect(() => {
    const controller = new AbortController();
    void loadOptions(controller.signal);
    return () => controller.abort();
  }, [loadOptions]);

  function changeScope(next: typeof scope) {
    setScope(next);
    setBalance(null);
    setHistory([]);
    setLoaded(false);
    setFeedback(null);
  }

  function clearScopeFilters() {
    changeScope({ employeeId: "", leaveTypeId: "", year: currentYear });
    setSearch("");
  }

  async function load() {
    if (!accessToken || !scope.employeeId || !scope.leaveTypeId) {
      setFeedback({ error: true, key: "leaveBalance.scopeValidation" });
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const entries = await listLeaveBalanceHistory(
        accessToken,
        scope.employeeId,
        scope.leaveTypeId,
        scope.year,
      );
      setHistory(entries);
      try {
        setBalance(
          await getLeaveBalance(accessToken, scope.employeeId, scope.leaveTypeId, scope.year),
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) setBalance(null);
        else throw error;
      }
      setLoaded(true);
      setForm((value) => ({
        ...value,
        employeeId: scope.employeeId,
        leaveTypeId: scope.leaveTypeId,
        leaveYear: scope.year,
        effectiveDate: `${scope.year}-01-01`,
      }));
    } catch {
      setFeedback({ error: true, key: "leaveBalance.loadError" });
    } finally {
      setLoading(false);
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
      await load();
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

  return (
    <VacationWorkspace
      title={t("leaveBalance.title")}
      description={t("leaveBalance.description")}
      contentFillsViewport
      sectionActions={
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className={formPrimaryButtonClassName()}
        >
          {loading ? t("common.loading") : t("leaveBalance.load")}
        </button>
      }
      sectionSecondaryActions={
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
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
          ariaLabel={t("leaveBalance.tableLabel")}
          fillViewport
          toolbar={
            <AdministrativeGridToolbar
              search={search}
              searchLabel={t("leaveBalance.searchLabel")}
              searchPlaceholder={t("leaveBalance.searchPlaceholder")}
              onSearchChange={setSearch}
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
                  value={scope.employeeId}
                  onChange={(employeeId) => changeScope({ ...scope, employeeId })}
                  empty={t("leaveBalance.selectEmployee")}
                  options={employees.map((employee) => ({
                    value: employee.publicId,
                    label: `${employee.lastName}, ${employee.firstName} (${employee.employeeNumber})`,
                  }))}
                />
                <SelectField
                  id="balance-leave-type"
                  label={t("leaveBalance.leaveType")}
                  value={scope.leaveTypeId}
                  onChange={(leaveTypeId) => changeScope({ ...scope, leaveTypeId })}
                  empty={t("leaveBalance.selectLeaveType")}
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
                    value={scope.year}
                    onChange={(event) =>
                      changeScope({ ...scope, year: Number(event.target.value) })
                    }
                    className={formControlClassName()}
                  />
                </FormField>
              </div>
              {loaded ? (
                <div className="border-b border-slate-200 bg-white px-4 py-3">
                  <p className="text-sm text-slate-600">{t("leaveBalance.current")}</p>
                  <p className="text-2xl font-semibold text-slate-950">
                    {balance ? balance.balanceDays : "—"}
                  </p>
                </div>
              ) : null}
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
                  {!loaded || loading || filteredHistory.length === 0 ? (
                    <GridStateRows
                      columnCount={columnCount}
                      isLoading={loading}
                      hasError={Boolean(feedback?.error)}
                      isEmpty={!loaded || filteredHistory.length === 0}
                      loadingLabel={t("common.loading")}
                      emptyTitle={
                        loaded ? t("leaveBalance.empty") : t("leaveBalance.emptyScope")
                      }
                      emptyDescription={
                        loaded
                          ? t("leaveBalance.emptyDescription")
                          : t("leaveBalance.emptyScopeDescription")
                      }
                    />
                  ) : (
                    visibleHistory.map((entry) => (
                      <tr key={entry.publicId}>
                        <td className="px-3 py-3">{formatPortalDateTime(entry.acceptedAt)}</td>
                        <td className="px-3 py-3">{formatPortalDate(entry.effectiveDate)}</td>
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
          }
          pagination={
            <GridPagination
              page={page}
              pageSize={pageSize}
              totalCount={loaded ? filteredHistory.length : 0}
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
            loaded ? (
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
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  empty?: string;
}) {
  return (
    <FormField id={id} label={label} required>
      <select
        id={id}
        required
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
