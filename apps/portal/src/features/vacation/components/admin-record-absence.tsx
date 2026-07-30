"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  FormField,
  formControlClassName,
  formPrimaryButtonClassName,
  formSecondaryButtonClassName,
} from "@/components/form-field";
import { PortalDateInput } from "@/components/portal-date-input";
import { VacationWorkspace } from "@/features/vacation/components/vacation-workspace";
import { useTranslations } from "@/i18n/use-translations";
import { ApiError } from "@/services/auth";
import { getEmployees } from "@/services/organization";
import {
  getWorkingDaysBetween,
  listLeaveTypes,
  recordAdministrativeAbsence,
} from "@/services/vacation";
import {
  vacationRequestsManagePermission,
  type LeaveType,
} from "@/types/vacation";
import type { Employee } from "@/types/organization";

export function AdminRecordAbsence() {
  const { accessToken, user } = useAuth();
  const { locale, t } = useTranslations();
  const allowed =
    user?.permissions.includes(vacationRequestsManagePermission) ?? false;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [note, setNote] = useState("");
  const [workingDays, setWorkingDays] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!accessToken || !allowed) return;
    void Promise.all([
      getEmployees(accessToken, { status: "active", sort: "name" }),
      listLeaveTypes(accessToken, locale, { status: "active" }),
    ])
      .then(([nextEmployees, nextTypes]) => {
        setEmployees(nextEmployees);
        setTypes(nextTypes);
      })
      .catch(() => setError(t("vacation.employeePortal.error.generic")));
  }, [accessToken, allowed, locale, t]);

  const calculate = useCallback(async () => {
    if (!accessToken || !dateFrom || !dateTo || dateTo < dateFrom) {
      setWorkingDays(null);
      return;
    }
    try {
      setWorkingDays(
        (await getWorkingDaysBetween(accessToken, dateFrom, dateTo))
          .workingDays,
      );
    } catch {
      setWorkingDays(null);
    }
  }, [accessToken, dateFrom, dateTo]);

  useEffect(() => {
    void calculate();
  }, [calculate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || submitting) return;
    setError(null);
    setSuccess(null);
    if (!employeeId || !leaveTypeId || !dateFrom || !dateTo) {
      setError(t("vacation.admin.record.required"));
      return;
    }
    setSubmitting(true);
    try {
      await recordAdministrativeAbsence(accessToken, locale, {
        employeeId,
        leaveTypeId,
        dateFrom,
        dateTo,
        note: note.trim() || null,
      });
      setSuccess(t("vacation.admin.record.success"));
      setEmployeeId("");
      setLeaveTypeId("");
      setDateFrom("");
      setDateTo("");
      setNote("");
      setWorkingDays(null);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? (caught.problem?.detail ?? caught.message)
          : t("vacation.employeePortal.error.generic"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!allowed) {
    return (
      <VacationWorkspace title={t("vacation.admin.record")}>
        <p role="alert">{t("vacation.admin.forbidden")}</p>
      </VacationWorkspace>
    );
  }

  return (
    <VacationWorkspace
      title={t("vacation.admin.record")}
      description={t("vacation.admin.record.description")}
    >
      <div className="mb-4">
        <Link
          href="/vacation/admin/requests"
          className={formSecondaryButtonClassName()}
        >
          {t("vacation.admin.back")}
        </Link>
      </div>
      {success && (
        <p
          role="status"
          className="mb-4 rounded border border-emerald-300 bg-emerald-50 p-3 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100"
        >
          {success}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100"
        >
          {error}
        </p>
      )}
      <form
        onSubmit={submit}
        className="max-w-2xl space-y-4 rounded-lg border border-slate-300 bg-white p-5 dark:border-slate-600 dark:bg-slate-900"
      >
        <FormField
          id="record-employee"
          label={t("vacation.admin.record.employee")}
          required
        >
          <select
            id="record-employee"
            className={formControlClassName()}
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
          >
            <option value="">{t("vacation.admin.record.chooseEmployee")}</option>
            {employees.map((employee) => (
              <option key={employee.publicId} value={employee.publicId}>
                {employee.firstName} {employee.lastName} (
                {employee.employeeNumber})
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          id="record-leave-type"
          label={t("vacation.admin.filter.leaveType")}
          required
        >
          <select
            id="record-leave-type"
            className={formControlClassName()}
            value={leaveTypeId}
            onChange={(event) => setLeaveTypeId(event.target.value)}
          >
            <option value="">{t("vacation.employeePortal.chooseLeaveType")}</option>
            {types.map((type) => (
              <option key={type.publicId} value={type.publicId}>
                {type.name}
              </option>
            ))}
          </select>
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="record-date-from"
            label={t("vacation.admin.record.dateFrom")}
            required
            hint={t("dateInput.hint")}
          >
            <PortalDateInput
              id="record-date-from"
              value={dateFrom || null}
              nullable={false}
              disabled={submitting}
              onChange={(value) => setDateFrom(value ?? "")}
              invalidLabel={t("dateInput.invalid")}
              incompleteLabel={t("dateInput.incomplete")}
              todayLabel={t("dateInput.today")}
              clearLabel={t("dateInput.clear")}
              openCalendarLabel={t("dateInput.openCalendar")}
              previousMonthLabel={t("dateInput.previousMonth")}
              nextMonthLabel={t("dateInput.nextMonth")}
            />
          </FormField>
          <FormField
            id="record-date-to"
            label={t("vacation.admin.record.dateTo")}
            required
            hint={t("dateInput.hint")}
          >
            <PortalDateInput
              id="record-date-to"
              value={dateTo || null}
              nullable={false}
              disabled={submitting}
              onChange={(value) => setDateTo(value ?? "")}
              invalidLabel={t("dateInput.invalid")}
              incompleteLabel={t("dateInput.incomplete")}
              todayLabel={t("dateInput.today")}
              clearLabel={t("dateInput.clear")}
              openCalendarLabel={t("dateInput.openCalendar")}
              previousMonthLabel={t("dateInput.previousMonth")}
              nextMonthLabel={t("dateInput.nextMonth")}
            />
          </FormField>
        </div>
        <FormField
          id="record-working-days"
          label={t("vacation.admin.record.workingDays")}
        >
          <output
            id="record-working-days"
            className={`${formControlClassName({ readOnly: true })} flex items-center`}
          >
            {workingDays ?? "—"}
          </output>
        </FormField>
        <FormField id="record-note" label={t("vacation.employeePortal.note")}>
          <textarea
            id="record-note"
            className={`${formControlClassName()} min-h-20 resize-y`}
            maxLength={1000}
            value={note}
            disabled={submitting}
            onChange={(event) => setNote(event.target.value)}
          />
        </FormField>
        <button
          type="submit"
          className={formPrimaryButtonClassName()}
          disabled={submitting}
        >
          {submitting
            ? t("vacation.admin.record.recording")
            : t("vacation.admin.record")}
        </button>
      </form>
    </VacationWorkspace>
  );
}
