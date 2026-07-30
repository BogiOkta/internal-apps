"use client";

import { useCallback, useEffect, useState } from "react";
import { CompanyAdministrationWorkspace } from "@/components/company-administration-workspace";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  fieldDescriptionIds,
  FormField,
  formControlClassName,
  formPrimaryButtonClassName,
  formSecondaryButtonClassName,
} from "@/components/form-field";
import { portalActionContent } from "@/components/portal-action-icon";
import { PortalDateInput } from "@/components/portal-date-input";
import { PortalNotification } from "@/components/portal-notification";
import { useAuth } from "@/components/auth-provider";
import { useTranslations } from "@/i18n/use-translations";
import { formatPortalDate } from "@/utils/portal-date-format";
import {
  createNonWorkingDay,
  deleteNonWorkingDay,
  listNonWorkingDays,
  updateNonWorkingDay,
} from "@/services/business-calendar";
import { ApiError } from "@/services/auth";
import {
  businessCalendarManagePermission,
  type NonWorkingDay,
  type SaveNonWorkingDayRequest,
} from "@/types/business-calendar";

type FormState = SaveNonWorkingDayRequest;
const emptyForm: FormState = { date: "", name: "", description: null };

export default function NonWorkingDaysPage() {
  const { accessToken, user } = useAuth();
  const { t } = useTranslations();
  const allowed =
    user?.permissions.includes(businessCalendarManagePermission) ?? false;
  const [year, setYear] = useState(new Date().getFullYear());
  const [days, setDays] = useState<NonWorkingDay[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateValid, setDateValid] = useState(true);
  const [dateInputVersion, setDateInputVersion] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<NonWorkingDay | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!accessToken || !allowed) return;
    setIsLoading(true);
    try {
      const result = await listNonWorkingDays(accessToken, year, signal);
      setDays([...result].sort((left, right) => left.date.localeCompare(right.date)));
    } catch {
      if (!signal?.aborted) setFeedback({ kind: "error", text: t("businessCalendar.loadError") });
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [accessToken, allowed, t, year]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setDateValid(true);
    setDateInputVersion((version) => version + 1);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting || !accessToken) return;
    const nextErrors: typeof errors = {};
    if (!form.date) nextErrors.date = t("businessCalendar.validation.date");
    else if (!dateValid) nextErrors.date = t("dateInput.invalid");
    if (!form.name.trim()) nextErrors.name = t("businessCalendar.validation.name");
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setIsSubmitting(true);
    setFeedback(null);
    const body = { ...form, name: form.name.trim(), description: form.description?.trim() || null };
    try {
      if (editingId) await updateNonWorkingDay(accessToken, editingId, body);
      else await createNonWorkingDay(accessToken, body);
      setFeedback({ kind: "success", text: t(editingId ? "businessCalendar.updated" : "businessCalendar.created") });
      resetForm();
      await load();
    } catch (error) {
      const code = error instanceof ApiError ? error.problem?.code : undefined;
      setFeedback({
        kind: "error",
        text: t(code === "non_working_day_date_conflict"
          ? "businessCalendar.duplicateDate"
          : "businessCalendar.saveError"),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!accessToken || !pendingDelete || isDeleting) return;
    setFeedback(null);
    setIsDeleting(true);
    try {
      await deleteNonWorkingDay(accessToken, pendingDelete.publicId);
      if (editingId === pendingDelete.publicId) resetForm();
      await load();
      setFeedback({ kind: "success", text: t("businessCalendar.deleted") });
      setPendingDelete(null);
    } catch {
      setFeedback({ kind: "error", text: t("businessCalendar.deleteError") });
    } finally {
      setIsDeleting(false);
    }
  }

  if (!allowed) {
    return (
      <CompanyAdministrationWorkspace title={t("businessCalendar.title")}>
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
          {t("businessCalendar.forbidden")}
        </div>
      </CompanyAdministrationWorkspace>
    );
  }

  return (
    <CompanyAdministrationWorkspace
      title={t("businessCalendar.title")}
      description={t("businessCalendar.description")}
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              resetForm();
              setFeedback(null);
            }}
            className={formPrimaryButtonClassName()}
          >
            {portalActionContent("create", t("businessCalendar.createTitle"))}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={isLoading}
            className={formSecondaryButtonClassName()}
          >
            {portalActionContent(
              "refresh",
              isLoading ? t("businessCalendar.refreshing") : t("businessCalendar.refresh"),
            )}
          </button>
        </div>
      }
    >
      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <section
            aria-label={t("businessCalendar.title")}
            className="min-w-0 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm"
          >
            <div className="flex flex-wrap items-end gap-3 border-b border-slate-300 bg-slate-50 px-4 py-3">
              <FormField id="non-working-year" label={t("businessCalendar.year")}>
                <input
                  id="non-working-year"
                  type="number"
                  min={1}
                  max={9999}
                  value={year}
                  onChange={(event) => {
                    setFeedback(null);
                    setYear(Number(event.target.value));
                  }}
                  className={`${formControlClassName()} max-w-44`}
                />
              </FormField>
            </div>

            {isLoading ? (
              <p role="status" className="px-4 py-10 text-center text-slate-600">
                {t("common.loading")}
              </p>
            ) : days.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="font-medium text-slate-900">{t("businessCalendar.empty")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-slate-300 bg-slate-100 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-4 py-3">{t("businessCalendar.date")}</th>
                      <th className="px-4 py-3">{t("businessCalendar.name")}</th>
                      <th className="px-4 py-3">{t("businessCalendar.descriptionField")}</th>
                      <th className="px-4 py-3">{t("businessCalendar.actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {days.map((day) => {
                      const isSelected = editingId === day.publicId;
                      return (
                        <tr
                          key={day.publicId}
                          aria-selected={isSelected}
                          className={isSelected ? "bg-blue-50 shadow-[inset_3px_0_0_#1d4ed8]" : "bg-white"}
                        >
                          <td className="whitespace-nowrap px-4 py-3">{formatPortalDate(day.date)}</td>
                          <td className="px-4 py-3 font-medium text-slate-950">{day.name}</td>
                          <td className="px-4 py-3 text-slate-600">{day.description || "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded-sm text-sm font-medium text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-600"
                                onClick={() => {
                                  setEditingId(day.publicId);
                                  setForm({
                                    date: day.date,
                                    name: day.name,
                                    description: day.description,
                                  });
                                  setErrors({});
                                  setFeedback(null);
                                }}
                              >
                                {t("businessCalendar.edit")}
                              </button>
                              <button
                                type="button"
                                className="rounded-sm text-sm font-medium text-red-700 hover:underline focus:outline-none focus:ring-2 focus:ring-red-600"
                                onClick={() => setPendingDelete(day)}
                              >
                                {t("businessCalendar.delete")}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="min-h-[24rem] rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
            <div className="space-y-4">
              <form onSubmit={submit} className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-950">
                  {t(editingId ? "businessCalendar.editTitle" : "businessCalendar.createTitle")}
                </h2>
                <FormField
                  id="non-working-date"
                  label={t("businessCalendar.date")}
                  required
                  hint={t("dateInput.hint")}
                  error={errors.date}
                >
                  <PortalDateInput
                    key={dateInputVersion}
                    id="non-working-date"
                    value={form.date || null}
                    disabled={isSubmitting}
                    nullable={false}
                    onChange={(value) => {
                      setForm({ ...form, date: value ?? "" });
                      if (errors.date) setErrors({ ...errors, date: undefined });
                    }}
                    onValidityChange={setDateValid}
                    ariaDescribedBy={fieldDescriptionIds("non-working-date", Boolean(errors.date), true)}
                    invalidLabel={t("dateInput.invalid")}
                    incompleteLabel={t("dateInput.incomplete")}
                    todayLabel={t("dateInput.today")}
                    clearLabel={t("dateInput.clear")}
                    openCalendarLabel={t("dateInput.openCalendar")}
                    previousMonthLabel={t("dateInput.previousMonth")}
                    nextMonthLabel={t("dateInput.nextMonth")}
                  />
                </FormField>
                <FormField id="non-working-name" label={t("businessCalendar.name")} required error={errors.name}>
                  <input
                    id="non-working-name"
                    maxLength={200}
                    value={form.name}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={fieldDescriptionIds("non-working-name", Boolean(errors.name))}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    className={formControlClassName({ invalid: Boolean(errors.name) })}
                  />
                </FormField>
                <FormField id="non-working-description" label={t("businessCalendar.descriptionField")}>
                  <textarea
                    id="non-working-description"
                    maxLength={1000}
                    value={form.description ?? ""}
                    disabled={isSubmitting}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    className={`${formControlClassName()} min-h-24 resize-y`}
                  />
                </FormField>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={isSubmitting} className={formPrimaryButtonClassName()}>
                    {isSubmitting ? t("businessCalendar.saving") : t("businessCalendar.save")}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={resetForm}
                      className={formSecondaryButtonClassName()}
                    >
                      {t("businessCalendar.cancel")}
                    </button>
                  )}
                </div>
              </form>
              {pendingDelete && (
                <ConfirmDialog
                  destructive
                  message={t("businessCalendar.deleteConfirm", { name: pendingDelete.name })}
                  confirmLabel={t("businessCalendar.delete")}
                  cancelLabel={t("businessCalendar.cancel")}
                  pending={isDeleting}
                  onConfirm={() => void confirmDelete()}
                  onCancel={() => setPendingDelete(null)}
                />
              )}
              {feedback && (
                <PortalNotification
                  variant={feedback.kind === "error" ? "error" : "success"}
                  message={feedback.text}
                  dismissLabel={t("common.dismissNotification")}
                  onDismiss={() => setFeedback(null)}
                />
              )}
            </div>
          </aside>
      </div>
    </CompanyAdministrationWorkspace>
  );
}
