"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { secondaryButtonClass } from "@/features/vacation/components/employee-vacation-dashboard";
import { VacationWorkspace } from "@/features/vacation/components/vacation-workspace";
import { useTranslations } from "@/i18n/use-translations";
import { ApiError } from "@/services/auth";
import { getEmployees } from "@/services/organization";
import { getWorkingDaysBetween, listLeaveTypes, recordAdministrativeAbsence } from "@/services/vacation";
import { vacationRequestsManagePermission, type LeaveType } from "@/types/vacation";
import type { Employee } from "@/types/organization";

const inputClass = "mt-1 block min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600";

export function AdminRecordAbsence() {
  const { accessToken, user } = useAuth();
  const { locale, t } = useTranslations();
  const allowed = user?.permissions.includes(vacationRequestsManagePermission) ?? false;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [employeeId, setEmployeeId] = useState(""); const [leaveTypeId, setLeaveTypeId] = useState("");
  const [dateFrom, setDateFrom] = useState(""); const [dateTo, setDateTo] = useState(""); const [note, setNote] = useState("");
  const [workingDays, setWorkingDays] = useState<number | null>(null); const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null); const [submitting, setSubmitting] = useState(false);
  useEffect(() => { if (!accessToken || !allowed) return; void Promise.all([
    getEmployees(accessToken, { status: "active", sort: "name" }), listLeaveTypes(accessToken, locale, { status: "active" }),
  ]).then(([nextEmployees, nextTypes]) => { setEmployees(nextEmployees); setTypes(nextTypes); }).catch(() => setError(t("vacation.employeePortal.error.generic"))); }, [accessToken, allowed, locale, t]);
  const calculate = useCallback(async () => { if (!accessToken || !dateFrom || !dateTo || dateTo < dateFrom) { setWorkingDays(null); return; } try { setWorkingDays((await getWorkingDaysBetween(accessToken, dateFrom, dateTo)).workingDays); } catch { setWorkingDays(null); } }, [accessToken, dateFrom, dateTo]);
  useEffect(() => { void calculate(); }, [calculate]);
  async function submit(event: React.FormEvent) { event.preventDefault(); if (!accessToken || submitting) return; setError(null); setSuccess(null); if (!employeeId || !leaveTypeId || !dateFrom || !dateTo) { setError(t("vacation.admin.record.required")); return; } setSubmitting(true); try { await recordAdministrativeAbsence(accessToken, locale, { employeeId, leaveTypeId, dateFrom, dateTo, note: note.trim() || null }); setSuccess(t("vacation.admin.record.success")); setEmployeeId(""); setLeaveTypeId(""); setDateFrom(""); setDateTo(""); setNote(""); setWorkingDays(null); } catch (caught) { setError(caught instanceof ApiError ? caught.problem?.detail ?? caught.message : t("vacation.employeePortal.error.generic")); } finally { setSubmitting(false); } }
  if (!allowed) return <VacationWorkspace title={t("vacation.admin.record")}><p role="alert">{t("vacation.admin.forbidden")}</p></VacationWorkspace>;
  return <VacationWorkspace title={t("vacation.admin.record")} description={t("vacation.admin.record.description")}><div className="mb-4"><Link href="/vacation/admin/requests" className={secondaryButtonClass}>{t("vacation.admin.back")}</Link></div>{success && <p role="status" className="mb-4 rounded border border-emerald-300 bg-emerald-50 p-3">{success}</p>}{error && <p role="alert" className="mb-4 rounded border border-red-300 bg-red-50 p-3">{error}</p>}<form onSubmit={submit} className="max-w-2xl space-y-4 rounded-lg border border-slate-300 bg-white p-5"><label className="block text-sm font-medium">{t("vacation.admin.record.employee")}<select className={inputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}><option value="">{t("vacation.admin.record.chooseEmployee")}</option>{employees.map((employee) => <option key={employee.publicId} value={employee.publicId}>{employee.firstName} {employee.lastName} ({employee.employeeNumber})</option>)}</select></label><label className="block text-sm font-medium">{t("vacation.admin.filter.leaveType")}<select className={inputClass} value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}><option value="">{t("vacation.employeePortal.chooseLeaveType")}</option>{types.map((type) => <option key={type.publicId} value={type.publicId}>{type.name}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">{t("vacation.admin.record.dateFrom")}<input className={inputClass} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label><label className="text-sm font-medium">{t("vacation.admin.record.dateTo")}<input className={inputClass} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label></div><label className="block text-sm font-medium">{t("vacation.admin.record.workingDays")}<output className={`${inputClass} flex items-center bg-slate-100`}>{workingDays ?? "—"}</output></label><label className="block text-sm font-medium">{t("vacation.employeePortal.note")}<textarea className={inputClass} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} /></label><button className="min-h-10 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={submitting}>{submitting ? t("vacation.admin.record.recording") : t("vacation.admin.record")}</button></form></VacationWorkspace>;
}
