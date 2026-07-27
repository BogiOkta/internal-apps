"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  fieldDescriptionIds,
  FormField,
  formControlClassName,
} from "@/components/form-field";
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
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting || !accessToken) return;
    const nextErrors: typeof errors = {};
    if (!form.date) nextErrors.date = t("businessCalendar.validation.date");
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

  async function remove(day: NonWorkingDay) {
    if (!accessToken || !window.confirm(t("businessCalendar.deleteConfirm", { name: day.name }))) return;
    setFeedback(null);
    try {
      await deleteNonWorkingDay(accessToken, day.publicId);
      if (editingId === day.publicId) resetForm();
      await load();
      setFeedback({ kind: "success", text: t("businessCalendar.deleted") });
    } catch {
      setFeedback({ kind: "error", text: t("businessCalendar.deleteError") });
    }
  }

  if (!allowed) return <AppShell title={t("businessCalendar.title")}>
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
      {t("businessCalendar.forbidden")}
    </div>
  </AppShell>;

  return <AppShell title={t("businessCalendar.title")} description={t("businessCalendar.description")}>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section>
        <label className="mb-4 block max-w-44 text-sm font-medium text-slate-800">
          {t("businessCalendar.year")}
          <input type="number" min={1} max={9999} value={year}
            onChange={(event) => {
              setFeedback(null);
              setYear(Number(event.target.value));
            }}
            className={`mt-1.5 ${formControlClassName()}`} />
        </label>
        {feedback && <div role={feedback.kind === "error" ? "alert" : "status"}
          className={`mb-4 rounded-md border p-3 text-sm ${feedback.kind === "error"
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-green-200 bg-green-50 text-green-800"}`}>{feedback.text}</div>}
        {isLoading ? <p role="status" className="rounded-md border p-6 text-slate-600">{t("common.loading")}</p>
          : days.length === 0 ? <p className="rounded-md border border-dashed p-6 text-slate-600">{t("businessCalendar.empty")}</p>
            : <div className="overflow-x-auto rounded-md border border-slate-300 bg-white">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>
                  <th className="px-4 py-3">{t("businessCalendar.date")}</th>
                  <th className="px-4 py-3">{t("businessCalendar.name")}</th>
                  <th className="px-4 py-3">{t("businessCalendar.descriptionField")}</th>
                  <th className="px-4 py-3">{t("businessCalendar.actions")}</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-200">{days.map((day) => <tr key={day.publicId}>
                  <td className="px-4 py-3 whitespace-nowrap">{formatPortalDate(day.date)}</td>
                  <td className="px-4 py-3 font-medium">{day.name}</td>
                  <td className="px-4 py-3 text-slate-600">{day.description || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><button type="button" className="mr-3 text-blue-700 underline"
                    onClick={() => { setEditingId(day.publicId); setForm({ date: day.date, name: day.name, description: day.description }); setErrors({}); }}>{t("businessCalendar.edit")}</button>
                    <button type="button" className="text-red-700 underline" onClick={() => void remove(day)}>{t("businessCalendar.delete")}</button></td>
                </tr>)}</tbody>
              </table>
            </div>}
      </section>
      <form onSubmit={submit} className="h-fit space-y-4 rounded-md border border-slate-300 bg-white p-5">
        <h2 className="text-lg font-semibold">{t(editingId ? "businessCalendar.editTitle" : "businessCalendar.createTitle")}</h2>
        <FormField id="non-working-date" label={t("businessCalendar.date")} required error={errors.date}>
          <input id="non-working-date" type="date" value={form.date} disabled={isSubmitting}
            aria-invalid={Boolean(errors.date)} aria-describedby={fieldDescriptionIds("non-working-date", Boolean(errors.date))}
            onChange={(event) => setForm({ ...form, date: event.target.value })} className={formControlClassName({ invalid: Boolean(errors.date) })} />
        </FormField>
        <FormField id="non-working-name" label={t("businessCalendar.name")} required error={errors.name}>
          <input id="non-working-name" maxLength={200} value={form.name} disabled={isSubmitting}
            aria-invalid={Boolean(errors.name)} aria-describedby={fieldDescriptionIds("non-working-name", Boolean(errors.name))}
            onChange={(event) => setForm({ ...form, name: event.target.value })} className={formControlClassName({ invalid: Boolean(errors.name) })} />
        </FormField>
        <FormField id="non-working-description" label={t("businessCalendar.descriptionField")}>
          <textarea id="non-working-description" maxLength={1000} value={form.description ?? ""} disabled={isSubmitting}
            onChange={(event) => setForm({ ...form, description: event.target.value })} className={`${formControlClassName()} min-h-24 resize-y`} />
        </FormField>
        <div className="flex gap-2">
          <button type="submit" disabled={isSubmitting} className="min-h-10 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-60">
            {isSubmitting ? t("businessCalendar.saving") : t("businessCalendar.save")}
          </button>
          {editingId && <button type="button" disabled={isSubmitting} onClick={resetForm} className="min-h-10 rounded-md border border-slate-300 px-4 text-sm">{t("businessCalendar.cancel")}</button>}
        </div>
      </form>
    </div>
  </AppShell>;
}
