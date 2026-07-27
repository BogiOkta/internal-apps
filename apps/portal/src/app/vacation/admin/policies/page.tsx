"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { FormField, formControlClassName } from "@/components/form-field";
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

  async function remove(policy: LeavePolicy) {
    if (!accessToken || !window.confirm(t("leavePolicy.deleteConfirm",
      { employee: policy.employeeName, year: policy.leaveYear }))) return;
    try {
      await deleteLeavePolicy(accessToken, policy.policyId);
      if (editingId === policy.policyId) reset();
      await load();
      setFeedback({ error: false, text: t("leavePolicy.deleted") });
    } catch {
      setFeedback({ error: true, text: t("leavePolicy.deleteError") });
    }
  }

  if (!allowed) return <VacationWorkspace title={t("leavePolicy.title")}>
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
      {t("leavePolicy.forbidden")}
    </div>
  </VacationWorkspace>;

  return <VacationWorkspace title={t("leavePolicy.title")} description={t("leavePolicy.description")}>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <FormField id="policy-year-filter" label={t("leavePolicy.year")}>
            <input id="policy-year-filter" type="number" min={1900} max={9999}
              value={year} onChange={(e) => setYear(Number(e.target.value))}
              className={formControlClassName()} />
          </FormField>
          <FormField id="policy-employee-filter" label={t("leavePolicy.employee")}>
            <select id="policy-employee-filter" value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className={formControlClassName()}>
              <option value="">{t("leavePolicy.allEmployees")}</option>
              {employees.map((employee) => <option key={employee.publicId} value={employee.publicId}>
                {employee.lastName}, {employee.firstName} ({employee.employeeNumber})
              </option>)}
            </select>
          </FormField>
        </div>
        {feedback && <div role={feedback.error ? "alert" : "status"}
          className={`mb-4 rounded-md border p-3 text-sm ${feedback.error
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-green-200 bg-green-50 text-green-800"}`}>{feedback.text}</div>}
        {loading ? <p role="status">{t("common.loading")}</p> : policies.length === 0
          ? <p className="rounded-md border border-dashed p-6 text-slate-600">{t("leavePolicy.empty")}</p>
          : <div className="overflow-x-auto rounded-md border border-slate-300 bg-white">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>
                {([
                  "leavePolicy.employee", "leavePolicy.year", "leavePolicy.annual",
                  "leavePolicy.carryOver", "leavePolicy.expiration",
                  "leavePolicy.adjustment", "leavePolicy.actions",
                ] as const).map((key) =>
                  <th key={key} className="px-3 py-3">{t(key)}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-200">{policies.map((policy) => <tr key={policy.policyId}>
                <td className="px-3 py-3 font-medium">{policy.employeeName}</td>
                <td className="px-3 py-3">{policy.leaveYear}</td>
                <td className="px-3 py-3">{policy.annualEntitlementDays}</td>
                <td className="px-3 py-3">{policy.carryOverDays}</td>
                <td className="px-3 py-3">{policy.carryOverExpirationDate
                  ? formatPortalDate(policy.carryOverExpirationDate) : "—"}</td>
                <td className="px-3 py-3">{policy.manualAdjustmentDays}</td>
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
                  <button className="text-red-700 underline" onClick={() => void remove(policy)}>
                    {t("leavePolicy.delete")}</button>
                </td>
              </tr>)}</tbody>
            </table>
          </div>}
      </section>
      <form onSubmit={submit} className="h-fit space-y-4 rounded-md border border-slate-300 bg-white p-5">
        <h2 className="text-lg font-semibold">{t(editingId ? "leavePolicy.editTitle" : "leavePolicy.createTitle")}</h2>
        <FormField id="policy-employee" label={t("leavePolicy.employee")} required>
          <select id="policy-employee" required disabled={saving} value={form.employeeId}
            onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
            className={formControlClassName()}>
            <option value="">{t("leavePolicy.selectEmployee")}</option>
            {employees.map((employee) => <option key={employee.publicId} value={employee.publicId}>
              {employee.lastName}, {employee.firstName} ({employee.employeeNumber})
            </option>)}
          </select>
        </FormField>
        <NumberField id="policy-year" label={t("leavePolicy.year")} value={form.leaveYear}
          min={1900} set={(leaveYear) => setForm({ ...form, leaveYear })} />
        <NumberField id="policy-annual" label={t("leavePolicy.annual")} value={form.annualEntitlementDays}
          min={0} set={(annualEntitlementDays) => setForm({ ...form, annualEntitlementDays })} />
        <NumberField id="policy-carry" label={t("leavePolicy.carryOver")} value={form.carryOverDays}
          min={0} set={(carryOverDays) => setForm({ ...form, carryOverDays })} />
        <FormField id="policy-expiration" label={t("leavePolicy.expiration")}>
          <input id="policy-expiration" type="date" value={form.carryOverExpirationDate ?? ""}
            onChange={(e) => setForm({ ...form, carryOverExpirationDate: e.target.value || null })}
            className={formControlClassName()} />
        </FormField>
        <NumberField id="policy-adjustment" label={t("leavePolicy.adjustment")}
          value={form.manualAdjustmentDays}
          set={(manualAdjustmentDays) => setForm({ ...form, manualAdjustmentDays })} />
        <FormField id="policy-notes" label={t("leavePolicy.notes")}>
          <textarea id="policy-notes" maxLength={1000} value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
            className={`${formControlClassName()} min-h-20`} />
        </FormField>
        <div className="flex gap-2">
          <button disabled={saving} className="rounded-md bg-blue-700 px-4 py-2 text-white">
            {saving ? t("leavePolicy.saving") : t("leavePolicy.save")}</button>
          {editingId && <button type="button" onClick={reset}
            className="rounded-md border px-4 py-2">{t("leavePolicy.cancel")}</button>}
        </div>
      </form>
    </div>
  </VacationWorkspace>;
}

function NumberField({ id, label, value, min, set }: {
  id: string; label: string; value: number; min?: number; set: (value: number) => void;
}) {
  return <FormField id={id} label={label} required>
    <input id={id} type="number" step="0.01" min={min} required value={value}
      onChange={(event) => set(Number(event.target.value))}
      className={formControlClassName()} />
  </FormField>;
}
