"use client";

import { useState, type FormEvent } from "react";
import { FormField, formControlClassName } from "@/components/form-field";
import { PortalDateInput } from "@/components/portal-date-input";
import { useTranslations } from "@/i18n/use-translations";
import { ApiError } from "@/services/auth";
import type { CreateEmployeeRequest, Department, Employee, UpdateEmployeeRequest } from "@/types/organization";

type Props = {
  mode: "create" | "edit"; employee?: Employee; departments: Department[];
  onCancel: () => void; onCreate: (request: CreateEmployeeRequest) => Promise<void>;
  onUpdate: (request: UpdateEmployeeRequest) => Promise<void>;
};

export function EmployeeForm({ mode, employee, departments, onCancel, onCreate, onUpdate }: Props) {
  const { t } = useTranslations();
  const [employeeNumber, setEmployeeNumber] = useState(employee?.employeeNumber ?? "");
  const [firstName, setFirstName] = useState(employee?.firstName ?? "");
  const [middleName, setMiddleName] = useState(employee?.middleName ?? "");
  const [lastName, setLastName] = useState(employee?.lastName ?? "");
  const [email, setEmail] = useState(employee?.email ?? "");
  const [employmentStartDate, setEmploymentStartDate] = useState(employee?.employmentStartDate ?? "");
  const [employmentEndDate, setEmploymentEndDate] = useState(employee?.employmentEndDate ?? "");
  const [departmentPublicId, setDepartmentPublicId] = useState(employee?.departmentPublicId ?? "");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [startDateValid, setStartDateValid] = useState(true);
  const [endDateValid, setEndDateValid] = useState(true);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null);
    if (!employeeNumber.trim() || !firstName.trim() || !lastName.trim() || !departmentPublicId) {
      setError(t("vacation.employees.validationRequired")); return;
    }
    if (!startDateValid || !endDateValid) { setError(t("dateInput.invalid")); return; }
    if (employmentStartDate && employmentEndDate && employmentEndDate < employmentStartDate) {
      setError(t("dateInput.endBeforeStart")); return;
    }
    setSaving(true);
    try {
      const common = {
        firstName: firstName.trim(), middleName: middleName.trim() || null,
        lastName: lastName.trim(), email: email.trim() || null,
        employmentStartDate: employmentStartDate || null,
        employmentEndDate: employmentEndDate || null, departmentPublicId,
      };
      if (mode === "create") await onCreate({ ...common, employeeNumber: employeeNumber.trim(), isActive });
      else await onUpdate(common);
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.problem?.code : undefined;
      setError(code === "employee_number_conflict" ? t("vacation.employees.duplicateNumber")
        : code === "employee_email_conflict" ? t("vacation.employees.duplicateEmail")
        : code === "invalid_department" ? t("vacation.employees.invalidDepartment")
        : t("vacation.employees.saveFailed"));
    } finally { setSaving(false); }
  }

  const input = (id: string, label: string, value: string, setValue: (value: string) => void,
    maxLength: number, options?: { type?: string; readOnly?: boolean; hint?: string; required?: boolean }) =>
    <FormField id={id} label={label} required={options?.required ?? true} hint={options?.hint}>
      <input id={id} aria-describedby={options?.hint ? `${id}-hint` : undefined}
        type={options?.type} value={value} readOnly={options?.readOnly} maxLength={maxLength}
        onChange={(event) => setValue(event.target.value)}
        className={formControlClassName({ readOnly: options?.readOnly })} />
    </FormField>;

  return <form onSubmit={submit} className="space-y-4">
    {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {input("employee-number", t("vacation.employees.employeeNumber"), employeeNumber, setEmployeeNumber, 30,
      { readOnly: mode === "edit", hint: mode === "edit" ? t("vacation.employees.codeReadOnly") : undefined })}
    {input("employee-first-name", t("vacation.employees.firstName"), firstName, setFirstName, 100)}
    {input("employee-middle-name", t("vacation.employees.middleName"), middleName, setMiddleName, 100, { required: false })}
    {input("employee-last-name", t("vacation.employees.lastName"), lastName, setLastName, 100)}
    {input("employee-email", t("vacation.employees.email"), email, setEmail, 254, { type: "email", required: false })}
    <FormField id="employee-employment-start-date" label={t("vacation.employees.employmentStartDate")} required={false} hint={t("dateInput.hint")}>
      <PortalDateInput id="employee-employment-start-date" value={employmentStartDate || null} onChange={(value) => setEmploymentStartDate(value ?? "")} onValidityChange={setStartDateValid} ariaDescribedBy="employee-employment-start-date-hint" invalidLabel={t("dateInput.invalid")} incompleteLabel={t("dateInput.incomplete")} todayLabel={t("dateInput.today")} clearLabel={t("dateInput.clear")} openCalendarLabel={t("dateInput.openCalendar")} previousMonthLabel={t("dateInput.previousMonth")} nextMonthLabel={t("dateInput.nextMonth")} />
    </FormField>
    <FormField id="employee-employment-end-date" label={t("vacation.employees.employmentEndDate")} required={false} hint={t("dateInput.hint")}>
      <PortalDateInput id="employee-employment-end-date" value={employmentEndDate || null} onChange={(value) => setEmploymentEndDate(value ?? "")} onValidityChange={setEndDateValid} ariaDescribedBy="employee-employment-end-date-hint" invalidLabel={t("dateInput.invalid")} incompleteLabel={t("dateInput.incomplete")} todayLabel={t("dateInput.today")} clearLabel={t("dateInput.clear")} openCalendarLabel={t("dateInput.openCalendar")} previousMonthLabel={t("dateInput.previousMonth")} nextMonthLabel={t("dateInput.nextMonth")} />
    </FormField>
    <FormField id="employee-department" label={t("vacation.employees.department")} required>
      <select id="employee-department"
        value={departmentPublicId} onChange={(event) => setDepartmentPublicId(event.target.value)}
        className={formControlClassName()}><option value="">{t("vacation.employees.chooseDepartment")}</option>
        {departments.map((department) => <option key={department.publicId} value={department.publicId}>{department.name}</option>)}</select>
    </FormField>
    {mode === "create" && <label className="flex items-center gap-2 text-sm"><input type="checkbox"
      checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />{t("vacation.employees.initiallyActive")}</label>}
    <div className="flex gap-2"><button disabled={saving} className="min-h-9 rounded-md bg-blue-700 px-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? t("vacation.employees.saving") : t("vacation.employees.save")}</button><button type="button" onClick={onCancel} className="min-h-9 rounded-md border border-slate-300 px-3 text-sm font-medium">{t("vacation.employees.cancel")}</button></div>
  </form>;
}
