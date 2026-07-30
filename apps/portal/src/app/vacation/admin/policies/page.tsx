"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AdministrativeGridShell, GridStateRows } from "@/components/admin-data-grid";
import { AdministrationPageBody } from "@/components/administration-page-body";
import { AdministrativeGridToolbar } from "@/components/administrative-grid-toolbar";
import { FormField, formControlClassName, formPrimaryButtonClassName, formSecondaryButtonClassName } from "@/components/form-field";
import { GridPagination } from "@/components/grid-pagination";
import { portalActionContent } from "@/components/portal-action-icon";
import { PortalDateInput } from "@/components/portal-date-input";
import { PortalNotification } from "@/components/portal-notification";
import { VacationWorkspace } from "@/features/vacation/components/vacation-workspace";
import { useTranslations } from "@/i18n/use-translations";
import { formatPortalDate } from "@/utils/portal-date-format";
import { ApiError } from "@/services/auth";
import {
  createLeavePolicy, deleteLeavePolicy, listLeavePolicies, updateLeavePolicy,
} from "@/services/leave-policies";
import { getEmployees } from "@/services/organization";
import {
  leavePolicyManagePermission, type LeavePolicy, type SaveLeavePolicyRequest,
} from "@/types/leave-policy";
import type { Employee } from "@/types/organization";

const currentYear = new Date().getFullYear();
const emptyForm: SaveLeavePolicyRequest = {
  employeeId: "", leaveYear: currentYear, annualEntitlementDays: 0,
  carryOverDays: 0, carryOverExpirationDate: null, manualAdjustmentDays: 0,
  notes: null,
};

export default function LeavePoliciesPage() {
  const { accessToken, user } = useAuth();
  const { t } = useTranslations();
  const allowed = user?.permissions.includes(leavePolicyManagePermission) ?? false;
  const [year, setYear] = useState(currentYear);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingDeletePolicy, setPendingDeletePolicy] = useState<LeavePolicy | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const filteredPolicies = useMemo(() => policies.filter((policy) =>
    policy.employeeName.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [policies, search]);
  const totalPages = Math.max(1, Math.ceil(filteredPolicies.length / pageSize));
  const visiblePolicies = filteredPolicies.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [search, year, employeeFilter, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!accessToken || !allowed) return;
    setLoading(true);
    try {
      const [policyRows, employeeRows] = await Promise.all([
        listLeavePolicies(accessToken, year, employeeFilter || undefined, signal),
        getEmployees(accessToken, { sort: "name" }, signal),
      ]);
      setPolicies(policyRows);
      setEmployees(employeeRows);
    } catch {
      if (!signal?.aborted) setFeedback({ error: true, text: t("leavePolicy.loadError") });
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [accessToken, allowed, employeeFilter, t, year]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function reset() {
    setEditingId(null);
    setForm({ ...emptyForm, leaveYear: year });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || saving) return;
    if (!form.employeeId || form.annualEntitlementDays < 0 || form.carryOverDays < 0) {
      setFeedback({ error: true, text: t("leavePolicy.validation") });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      if (editingId) await updateLeavePolicy(accessToken, editingId, form);
      else await createLeavePolicy(accessToken, form);
      reset();
      await load();
      setFeedback({ error: false, text: t(editingId ? "leavePolicy.updated" : "leavePolicy.created") });
    } catch (error) {
      const code = error instanceof ApiError ? error.problem?.code : undefined;
      setFeedback({ error: true, text: t(code === "leave_policy_employee_year_conflict"
        ? "leavePolicy.duplicate" : "leavePolicy.saveError") });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!accessToken || !pendingDeletePolicy || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteLeavePolicy(accessToken, pendingDeletePolicy.policyId);
      if (editingId === pendingDeletePolicy.policyId) reset();
      await load();
      setFeedback({ error: false, text: t("leavePolicy.deleted") });
      setPendingDeletePolicy(null);
    } catch {
      setFeedback({ error: true, text: t("leavePolicy.deleteError") });
    } finally {
      setIsDeleting(false);
    }
  }

  if (!allowed) return <VacationWorkspace title={t("leavePolicy.title")}>
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
      {t("leavePolicy.forbidden")}
    </div>
  </VacationWorkspace>;

  return <VacationWorkspace title={t("leavePolicy.title")} description={t("leavePolicy.description")} contentFillsViewport
    sectionActions={<button type="button" onClick={reset} className={formPrimaryButtonClassName()}>{portalActionContent("create", t("leavePolicy.new"))}</button>}
    sectionSecondaryActions={<button type="button" onClick={() => void load()} disabled={loading} className={formSecondaryButtonClassName()}>{portalActionContent("refresh", loading ? t("leavePolicy.refreshing") : t("leavePolicy.refresh"))}</button>}>
    <AdministrationPageBody>
    <AdministrativeGridShell ariaLabel={t("leavePolicy.tableLabel")} fillViewport
      toolbar={<AdministrativeGridToolbar search={search} searchLabel={t("leavePolicy.searchLabel")} searchPlaceholder={t("leavePolicy.searchPlaceholder")} onSearchChange={setSearch} activeFilterCount={employeeFilter ? 1 : 0} areFiltersVisible exportDisabled filtersLabel={t("grid.filters")} showFiltersLabel={t("grid.showFilters")} hideFiltersLabel={t("grid.hideFilters")} clearFiltersLabel={t("grid.clearFilters")} exportLabel={t("grid.export")} exportCsvLabel={t("grid.exportCsv")} exportExcelLabel={t("grid.exportExcel")} onToggleFilters={() => undefined} onClearFilters={() => { setEmployeeFilter(""); setYear(currentYear); }} onExportCsv={() => undefined} onExportExcel={() => undefined} />}
      viewport={<><div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-3 sm:grid-cols-2"><FormField id="policy-year-filter" label={t("leavePolicy.year")}><input id="policy-year-filter" type="number" min={1900} max={9999} value={year} onChange={(e) => setYear(Number(e.target.value))} className={formControlClassName()} /></FormField><FormField id="policy-employee-filter" label={t("leavePolicy.employee")}><select id="policy-employee-filter" value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className={formControlClassName()}><option value="">{t("leavePolicy.allEmployees")}</option>{employees.map((employee) => <option key={employee.publicId} value={employee.publicId}>{employee.lastName}, {employee.firstName} ({employee.employeeNumber})</option>)}</select></FormField></div><table className="w-full min-w-[1050px] text-left text-sm"><thead className="sticky top-0 z-10 bg-slate-100 text-xs font-semibold text-slate-600"><tr>
                {(["leavePolicy.employee", "leavePolicy.year", "leavePolicy.annual", "leavePolicy.carryOver", "leavePolicy.expiration", "leavePolicy.adjustment", "leavePolicy.total", "leavePolicy.actions"] as const).map((key) => <th key={key} className="px-3 py-3">{t(key)}</th>)}
              </tr></thead><tbody className="divide-y divide-slate-200">{loading || filteredPolicies.length === 0 ? <GridStateRows columnCount={8} isLoading={loading} hasError={Boolean(feedback?.error)} isEmpty={filteredPolicies.length === 0} loadingLabel={t("common.loading")} emptyTitle={t("leavePolicy.empty")} emptyDescription={t("leavePolicy.emptyDescription")} /> : visiblePolicies.map((policy) => <tr key={policy.policyId}>
                <td className="px-3 py-3 font-medium">{policy.employeeName}</td>
                <td className="px-3 py-3">{policy.leaveYear}</td>
                <td className="px-3 py-3">{formatDays(policy.annualEntitlementDays, t)}</td>
                <td className="px-3 py-3">{formatDays(policy.carryOverDays, t)}</td>
                <td className="px-3 py-3">{policy.carryOverExpirationDate
                  ? <span className="inline-flex items-center gap-2">{formatPortalDate(policy.carryOverExpirationDate)}<ExpiryStatus value={policy.carryOverExpirationDate} /></span> : "—"}</td>
                <td className="px-3 py-3">{formatAdjustment(policy.manualAdjustmentDays)}</td>
                <td className="px-3 py-3 font-semibold">{formatDays(totalFor(policy), t)}</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <button className="mr-3 text-blue-700 underline" onClick={() => {
                    setEditingId(policy.policyId);
                    setForm({
                      employeeId: policy.employeeId, leaveYear: policy.leaveYear,
                      annualEntitlementDays: policy.annualEntitlementDays,
                      carryOverDays: policy.carryOverDays,
                      carryOverExpirationDate: policy.carryOverExpirationDate,
                      manualAdjustmentDays: policy.manualAdjustmentDays, notes: policy.notes,
                    });
                  }}>{t("leavePolicy.edit")}</button>
                  <button className="text-red-700 underline" onClick={() => setPendingDeletePolicy(policy)}>
                    {t("leavePolicy.delete")}</button>
                </td>
              </tr>)}</tbody>
            </table></>}
      pagination={<GridPagination page={page} pageSize={pageSize} totalCount={filteredPolicies.length} onPageChange={setPage} onPageSizeChange={setPageSize} labels={{ range: (from, to, total) => t("grid.visibleRange", { from, to, total }), pageSize: t("grid.pageSize"), first: t("grid.firstPage"), previous: t("grid.previousPage"), next: t("grid.nextPage"), last: t("grid.lastPage") }} />}
      detailsPanel={<div className="space-y-4">
        <form onSubmit={submit} className="space-y-4">
        <h2 className="text-lg font-semibold">{t(editingId ? "leavePolicy.editTitle" : "leavePolicy.createTitle")}</h2>
        <FormField id="policy-employee" label={t("leavePolicy.employee")} required>
          <select id="policy-employee" required disabled={saving || Boolean(editingId)} value={form.employeeId}
            onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
            className={formControlClassName({ readOnly: Boolean(editingId) })}>
            <option value="">{t("leavePolicy.selectEmployee")}</option>
            {employees.map((employee) => <option key={employee.publicId} value={employee.publicId}>
              {employee.lastName}, {employee.firstName} ({employee.employeeNumber})
            </option>)}
          </select>
        </FormField>
        <NumberField id="policy-year" label={t("leavePolicy.year")} value={form.leaveYear}
          min={1900} disabled={Boolean(editingId)} set={(leaveYear) => setForm({ ...form, leaveYear })} />
        <NumberField id="policy-annual" label={t("leavePolicy.annual")} value={form.annualEntitlementDays}
          min={0} set={(annualEntitlementDays) => setForm({ ...form, annualEntitlementDays })} />
        <NumberField id="policy-carry" label={t("leavePolicy.carryOver")} value={form.carryOverDays}
          min={0} set={(carryOverDays) => setForm({ ...form, carryOverDays })} />
        <FormField id="policy-expiration" label={t("leavePolicy.expiration")} hint={t("dateInput.hint")}>
          <PortalDateInput id="policy-expiration" value={form.carryOverExpirationDate}
            onChange={(carryOverExpirationDate) => setForm({ ...form, carryOverExpirationDate })}
            invalidLabel={t("dateInput.invalid")} incompleteLabel={t("dateInput.incomplete")}
            todayLabel={t("dateInput.today")} clearLabel={t("dateInput.clear")}
            openCalendarLabel={t("dateInput.openCalendar")} previousMonthLabel={t("dateInput.previousMonth")}
            nextMonthLabel={t("dateInput.nextMonth")} />
        </FormField>
        <NumberField id="policy-adjustment" label={t("leavePolicy.adjustment")}
          value={form.manualAdjustmentDays}
          set={(manualAdjustmentDays) => setForm({ ...form, manualAdjustmentDays })} />
        <div className="rounded-md border border-slate-300 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-700">{t("leavePolicy.total")}</p>
          <output className="mt-1 block text-xl font-semibold text-slate-950">{formatDays(safeNumber(form.annualEntitlementDays) + safeNumber(form.carryOverDays) + safeNumber(form.manualAdjustmentDays), t)}</output>
          <p className="mt-1 text-xs text-slate-500">{t("leavePolicy.totalHint")}</p>
        </div>
        <FormField id="policy-notes" label={t("leavePolicy.notes")}>
          <textarea id="policy-notes" maxLength={1000} value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
            className={`${formControlClassName()} min-h-20`} />
        </FormField>
        <div className="flex gap-2">
          <button disabled={saving} className={formPrimaryButtonClassName()}>
            {saving ? t("leavePolicy.saving") : t("leavePolicy.save")}</button>
          <button type="button" onClick={reset} className={formSecondaryButtonClassName()}>{t("leavePolicy.cancel")}</button>
        </div>
      </form>
      {pendingDeletePolicy && (
        <ConfirmDialog
          destructive
          message={t("leavePolicy.deleteConfirm", {
            employee: pendingDeletePolicy.employeeName,
            year: pendingDeletePolicy.leaveYear,
          })}
          confirmLabel={t("leavePolicy.delete")}
          cancelLabel={t("leavePolicy.cancel")}
          pending={isDeleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDeletePolicy(null)}
        />
      )}
      </div>}
      detailsNotification={
        feedback ? (
          <PortalNotification
            variant={feedback.error ? "error" : "success"}
            message={feedback.text}
            dismissLabel={t("common.dismissNotification")}
            onDismiss={() => setFeedback(null)}
          />
        ) : undefined
      }
    />
    </AdministrationPageBody>
  </VacationWorkspace>;
}

function NumberField({ id, label, value, min, disabled = false, set }: {
  id: string; label: string; value: number; min?: number; disabled?: boolean; set: (value: number) => void;
}) {
  return <FormField id={id} label={label} required>
    <input id={id} type="number" step="0.01" min={min} required disabled={disabled} value={value}
      onChange={(event) => set(Number(event.target.value))}
      className={formControlClassName({ readOnly: disabled })} />
  </FormField>;
}

function safeNumber(value: number) { return Number.isFinite(value) ? value : 0; }
function totalFor(policy: LeavePolicy) { return safeNumber(policy.annualEntitlementDays) + safeNumber(policy.carryOverDays) + safeNumber(policy.manualAdjustmentDays); }
function formatDays(value: number, translate: (key: never) => string) { return `${safeNumber(value)} ${translate("leavePolicy.days" as never)}`; }
function formatAdjustment(value: number) { const safe = safeNumber(value); return safe > 0 ? `+${safe}` : String(safe); }
function ExpiryStatus({ value }: { value: string }) {
  const { t } = useTranslations();
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const expired = value < todayIso;
  return <span className={`rounded border px-2 py-0.5 text-xs font-medium ${expired ? "border-slate-300 bg-slate-100 text-slate-700" : "border-blue-200 bg-blue-50 text-blue-800"}`}>{t(expired ? "leavePolicy.expired" : "leavePolicy.valid")}</span>;
}
