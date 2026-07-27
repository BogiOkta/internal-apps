"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { FormField, formControlClassName } from "@/components/form-field";
import { VacationWorkspace } from "@/features/vacation/components/vacation-workspace";
import { useTranslations } from "@/i18n/use-translations";
import { formatPortalDate, formatPortalDateTime } from "@/utils/portal-date-format";
import { ApiError } from "@/services/auth";
import { getLeaveBalance, listLeaveBalanceHistory, postLeaveBalanceEntry } from "@/services/leave-balances";
import { getEmployees } from "@/services/organization";
import { listLeaveTypes } from "@/services/vacation";
import { leaveBalanceManagePermission, type LeaveBalance, type LeaveBalanceEntry, type PostLeaveBalanceEntryRequest } from "@/types/leave-balance";
import type { Employee } from "@/types/organization";
import type { LeaveType } from "@/types/vacation";

const currentYear = new Date().getFullYear();
type EntryForm = PostLeaveBalanceEntryRequest & { kind: "annual_entitlement" | "carry_over" | "manual_adjustment" };

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
  const [feedback, setFeedback] = useState<{ error: boolean; key: "leaveBalance.loadError" | "leaveBalance.scopeValidation" | "leaveBalance.validation" | "leaveBalance.created" | "leaveBalance.duplicate" | "leaveBalance.insufficient" | "leaveBalance.saveError" } | null>(null);
  const [form, setForm] = useState<EntryForm>({ kind: "annual_entitlement", employeeId: "", leaveTypeId: "", leaveYear: currentYear, quantityDays: 0, effectiveDate: `${currentYear}-01-01`, reason: "", explanation: null, sourceReference: "" });

  const loadOptions = useCallback(async (signal?: AbortSignal) => {
    if (!accessToken || !allowed) return;
    try {
      const [employeeRows, typeRows] = await Promise.all([
        getEmployees(accessToken, { sort: "name" }, signal),
        listLeaveTypes(accessToken, browserLocale, { status: "all", sortBy: "displayOrder", sortDirection: "asc" }, signal),
      ]);
      setEmployees(employeeRows);
      setLeaveTypes(typeRows.filter((type) => type.requiresBalance));
    } catch { if (!signal?.aborted) setFeedback({ error: true, key: "leaveBalance.loadError" }); }
  }, [accessToken, allowed, browserLocale]);

  useEffect(() => { const controller = new AbortController(); void loadOptions(controller.signal); return () => controller.abort(); }, [loadOptions]);

  function changeScope(next: typeof scope) {
    setScope(next);
    setBalance(null);
    setHistory([]);
    setLoaded(false);
    setFeedback(null);
  }

  async function load() {
    if (!accessToken || !scope.employeeId || !scope.leaveTypeId) {
      setFeedback({ error: true, key: "leaveBalance.scopeValidation" }); return;
    }
    setLoading(true); setFeedback(null);
    try {
      const entries = await listLeaveBalanceHistory(accessToken, scope.employeeId, scope.leaveTypeId, scope.year);
      setHistory(entries);
      try { setBalance(await getLeaveBalance(accessToken, scope.employeeId, scope.leaveTypeId, scope.year)); }
      catch (error) { if (error instanceof ApiError && error.status === 404) setBalance(null); else throw error; }
      setLoaded(true);
      setForm((value) => ({ ...value, employeeId: scope.employeeId, leaveTypeId: scope.leaveTypeId, leaveYear: scope.year, effectiveDate: `${scope.year}-01-01` }));
    } catch { setFeedback({ error: true, key: "leaveBalance.loadError" }); }
    finally { setLoading(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || saving) return;
    const positive = form.kind !== "manual_adjustment";
    if (!form.employeeId || !form.leaveTypeId || !form.reason.trim() || !form.sourceReference.trim() || !form.effectiveDate || form.effectiveDate.slice(0, 4) !== String(form.leaveYear) || form.quantityDays === 0 || form.quantityDays * 2 !== Math.trunc(form.quantityDays * 2) || (positive && form.quantityDays < 0)) {
      setFeedback({ error: true, key: "leaveBalance.validation" }); return;
    }
    setSaving(true); setFeedback(null);
    try {
      await postLeaveBalanceEntry(accessToken, form.kind, { ...form, reason: form.reason.trim(), explanation: form.explanation?.trim() || null, sourceReference: form.sourceReference.trim() });
      setForm((value) => ({ ...value, quantityDays: 0, reason: "", explanation: null, sourceReference: "" }));
      await load(); setFeedback({ error: false, key: "leaveBalance.created" });
    } catch (error) {
      const code = error instanceof ApiError ? error.problem?.code : undefined;
      setFeedback({ error: true, key: code === "leave_balance_entry_source_conflict" ? "leaveBalance.duplicate" : code === "leave_balance_insufficient" ? "leaveBalance.insufficient" : "leaveBalance.saveError" });
    } finally { setSaving(false); }
  }

  if (!allowed) return <VacationWorkspace title={t("leaveBalance.title")}><div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">{t("leaveBalance.forbidden")}</div></VacationWorkspace>;

  return <VacationWorkspace title={t("leaveBalance.title")} description={t("leaveBalance.description")}>
    <div className="mb-6 grid gap-3 rounded-md border border-slate-300 bg-white p-4 md:grid-cols-4">
      <SelectField id="balance-employee" label={t("leaveBalance.employee")} value={scope.employeeId} onChange={(employeeId) => changeScope({ ...scope, employeeId })} empty={t("leaveBalance.selectEmployee")} options={employees.map((employee) => ({ value: employee.publicId, label: `${employee.lastName}, ${employee.firstName} (${employee.employeeNumber})` }))} />
      <SelectField id="balance-leave-type" label={t("leaveBalance.leaveType")} value={scope.leaveTypeId} onChange={(leaveTypeId) => changeScope({ ...scope, leaveTypeId })} empty={t("leaveBalance.selectLeaveType")} options={leaveTypes.map((type) => ({ value: type.publicId, label: type.name }))} />
      <FormField id="balance-year" label={t("leaveBalance.year")}><input id="balance-year" type="number" min={1900} max={9999} value={scope.year} onChange={(event) => changeScope({ ...scope, year: Number(event.target.value) })} className={formControlClassName()} /></FormField>
      <div className="self-end"><button type="button" disabled={loading} onClick={() => void load()} className="rounded-md bg-blue-700 px-4 py-2 text-white">{loading ? t("common.loading") : t("leaveBalance.load")}</button></div>
    </div>
    {feedback && <div role={feedback.error ? "alert" : "status"} className={`mb-4 rounded-md border p-3 text-sm ${feedback.error ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}>{t(feedback.key)}</div>}
    {loaded && <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section><div className="mb-4 rounded-md border border-slate-300 bg-white p-4"><p className="text-sm text-slate-600">{t("leaveBalance.current")}</p><p className="text-2xl font-semibold">{balance ? balance.balanceDays : "—"}</p></div>
        <h2 className="mb-3 text-lg font-semibold">{t("leaveBalance.history")}</h2>
        {history.length === 0 ? <p className="rounded-md border border-dashed p-6 text-slate-600">{t("leaveBalance.empty")}</p> : <div className="overflow-x-auto rounded-md border border-slate-300 bg-white"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>{(["leaveBalance.accepted", "leaveBalance.effective", "leaveBalance.entryKind", "leaveBalance.quantity", "leaveBalance.reason", "leaveBalance.source"] as const).map((key) => <th key={key} className="px-3 py-3">{t(key)}</th>)}</tr></thead><tbody className="divide-y divide-slate-200">{history.map((entry) => <tr key={entry.publicId}><td className="px-3 py-3">{formatPortalDateTime(entry.acceptedAt)}</td><td className="px-3 py-3">{formatPortalDate(entry.effectiveDate)}</td><td className="px-3 py-3">{t(`leaveBalance.kind.${entry.entryKind}`)}</td><td className="px-3 py-3">{entry.quantityDays}</td><td className="px-3 py-3">{entry.reason}{entry.explanation ? ` — ${entry.explanation}` : ""}</td><td className="px-3 py-3">{entry.sourceReference}</td></tr>)}</tbody></table></div>}</section>
      <form onSubmit={submit} className="h-fit space-y-4 rounded-md border border-slate-300 bg-white p-5"><h2 className="text-lg font-semibold">{t("leaveBalance.createTitle")}</h2>
        <SelectField id="entry-kind" label={t("leaveBalance.entryKind")} value={form.kind} onChange={(kind) => setForm({ ...form, kind: kind as EntryForm["kind"] })} options={[{ value: "annual_entitlement", label: t("leaveBalance.kind.annual_entitlement") }, { value: "carry_over", label: t("leaveBalance.kind.carry_over") }, { value: "manual_adjustment", label: t("leaveBalance.kind.manual_adjustment") }]} />
        <FormField id="entry-quantity" label={t("leaveBalance.quantity")} required><input id="entry-quantity" type="number" step="0.5" required value={form.quantityDays} onChange={(event) => setForm({ ...form, quantityDays: Number(event.target.value) })} className={formControlClassName()} /></FormField>
        <FormField id="entry-effective" label={t("leaveBalance.effective")} required><input id="entry-effective" type="date" required value={form.effectiveDate} onChange={(event) => setForm({ ...form, effectiveDate: event.target.value })} className={formControlClassName()} /></FormField>
        <FormField id="entry-reason" label={t("leaveBalance.reason")} required><input id="entry-reason" maxLength={200} required value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} className={formControlClassName()} /></FormField>
        <FormField id="entry-explanation" label={t("leaveBalance.explanation")}><textarea id="entry-explanation" maxLength={1000} value={form.explanation ?? ""} onChange={(event) => setForm({ ...form, explanation: event.target.value || null })} className={`${formControlClassName()} min-h-20`} /></FormField>
        <FormField id="entry-source" label={t("leaveBalance.source")} required><input id="entry-source" maxLength={100} required value={form.sourceReference} onChange={(event) => setForm({ ...form, sourceReference: event.target.value })} className={formControlClassName()} /></FormField>
        <button disabled={saving} className="rounded-md bg-blue-700 px-4 py-2 text-white">{saving ? t("leaveBalance.saving") : t("leaveBalance.save")}</button>
      </form>
    </div>}
  </VacationWorkspace>;
}

function SelectField({ id, label, value, onChange, options, empty }: { id: string; label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; empty?: string }) {
  return <FormField id={id} label={label} required><select id={id} required value={value} onChange={(event) => onChange(event.target.value)} className={formControlClassName()}>{empty && <option value="">{empty}</option>}{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FormField>;
}
