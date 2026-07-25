"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { DateRangePicker, type DateRangeValue } from "@/components/date-range";
import { FormField, fieldDescriptionIds, formControlClassName } from "@/components/form-field";
import {
  primaryButtonClass,
  problemMessage,
  secondaryButtonClass,
} from "@/features/vacation/components/employee-vacation-dashboard";
import { VacationWorkspace } from "@/features/vacation/components/vacation-workspace";
import { toApiDate } from "@/features/vacation/vacation-request-utils";
import { useTranslations } from "@/i18n/use-translations";
import { ApiError } from "@/services/auth";
import {
  createMyVacationRequest,
  getWorkingDaysBetween,
  listMyVacationBalances,
  listMyVacationLeaveTypes,
} from "@/services/vacation";
import type { VacationBalance, VacationLeaveTypeOption } from "@/types/vacation";

export default function NewVacationRequestPage() {
  const { accessToken } = useAuth();
  const { locale, t } = useTranslations();
  const router = useRouter();
  const [leaveTypes, setLeaveTypes] = useState<VacationLeaveTypeOption[]>([]);
  const [balances, setBalances] = useState<VacationBalance[]>([]);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [range, setRange] = useState<DateRangeValue>({ from: null, to: null });
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [estimate, setEstimate] = useState<number | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    Promise.all([
      listMyVacationLeaveTypes(accessToken, locale, controller.signal),
      listMyVacationBalances(accessToken, locale, controller.signal),
    ]).then(([types, nextBalances]) => {
      setLeaveTypes(types); setBalances(nextBalances);
    }).catch((caught) => {
      if (!controller.signal.aborted) setError(problemMessage(
        caught instanceof ApiError ? caught.problem?.code ?? "generic" : "generic", t));
    }).finally(() => {
      if (!controller.signal.aborted) setIsLoading(false);
    });
    return () => controller.abort();
  }, [accessToken, locale, t]);

  useEffect(() => {
    if (!accessToken || !range.from || !range.to || range.to < range.from) {
      setEstimate(null);
      return;
    }
    const controller = new AbortController();
    setEstimate(null);
    getWorkingDaysBetween(
      accessToken,
      toApiDate(range.from),
      toApiDate(range.to),
      controller.signal,
    ).then((result) => setEstimate(result.workingDays))
      .catch((caught) => {
        if (!controller.signal.aborted) setError(problemMessage(
          caught instanceof ApiError ? caught.problem?.code ?? "generic" : "generic", t));
      });
    return () => controller.abort();
  }, [accessToken, range.from, range.to, t]);

  const selectedType = leaveTypes.find((type) => type.publicId === leaveTypeId);
  const matchingBalance = useMemo(() => {
    if (!selectedType?.requiresBalance || !range.from) return undefined;
    return balances.find((balance) =>
      balance.leaveTypePublicId === selectedType.publicId &&
      balance.year === range.from!.getFullYear());
  }, [balances, range.from, selectedType]);

  function validate() {
    if (!leaveTypeId) return t("vacation.employeePortal.validation.leaveType");
    if (!range.from || !range.to) return t("vacation.employeePortal.validation.dates");
    if (range.to < range.from) return t("vacation.employeePortal.error.invalidRange");
    if (range.from.getFullYear() !== range.to.getFullYear())
      return t("vacation.employeePortal.error.crossYear");
    if (estimate === 0)
      return t("vacation.employeePortal.error.noWorkingDays");
    if (note.trim().length > 1000)
      return t("vacation.employeePortal.validation.noteLength");
    return null;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    if (!accessToken || !range.from || !range.to) return;
    setIsSubmitting(true); setError(null);
    try {
      const created = await createMyVacationRequest(accessToken, locale, {
        leaveTypeId,
        dateFrom: toApiDate(range.from),
        dateTo: toApiDate(range.to),
        note: note.trim() || null,
      });
      router.push(`/vacation/requests/${created.publicId}?created=1`);
    } catch (caught) {
      setError(problemMessage(
        caught instanceof ApiError ? caught.problem?.code ?? "generic" : "generic", t));
    } finally {
      setIsSubmitting(false);
    }
  }

  return <VacationWorkspace title={t("vacation.employeePortal.createTitle")}
    description={t("vacation.employeePortal.createDescription")}>
    <form onSubmit={submit} className="mx-auto max-w-4xl space-y-6">
      {error && <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error}</div>}
      <FormField id="leave-type" label={t("vacation.employeePortal.leaveType")} required>
        <select id="leave-type" value={leaveTypeId}
          disabled={isLoading || isSubmitting}
          onChange={(event) => setLeaveTypeId(event.target.value)}
          className={formControlClassName()}>
          <option value="">{t("vacation.employeePortal.chooseLeaveType")}</option>
          {leaveTypes.map((type) => <option key={type.publicId} value={type.publicId}>
            {type.name}
          </option>)}
        </select>
      </FormField>
      <div>
        <h2 className="mb-2 text-sm font-medium">{t("vacation.employeePortal.dateRange")} *</h2>
        <DateRangePicker value={range} onChange={setRange} locale={locale}
          disabled={isSubmitting}
          summary={<RangeSummary estimate={estimate} type={selectedType}
            balance={matchingBalance} />} />
      </div>
      <FormField id="request-note" label={t("vacation.employeePortal.note")}
        hint={t("vacation.employeePortal.noteHint")}>
        <textarea id="request-note" value={note} maxLength={1000}
          disabled={isSubmitting} rows={4}
          aria-describedby={fieldDescriptionIds("request-note", false, true)}
          onChange={(event) => setNote(event.target.value)}
          className={`${formControlClassName()} resize-y`} />
      </FormField>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={isLoading || isSubmitting}
          className={primaryButtonClass}>
          {isSubmitting ? t("vacation.employeePortal.submitting")
            : t("vacation.employeePortal.submit")}
        </button>
        <Link href="/vacation" className={secondaryButtonClass}>
          {t("vacation.employeePortal.back")}
        </Link>
      </div>
    </form>
  </VacationWorkspace>;
}

function RangeSummary({ estimate, type, balance }: {
  estimate: number | null;
  type?: VacationLeaveTypeOption;
  balance?: VacationBalance;
}) {
  const { t } = useTranslations();
  return <div className="space-y-1 text-sm">
    <p>{estimate === null ? t("vacation.employeePortal.estimateEmpty")
      : t("vacation.employeePortal.estimate", { count: estimate })}</p>
    {type?.requiresBalance && (balance
      ? <><p>{t("vacation.employeePortal.available", { count: balance.availableDays })}</p>
        {estimate !== null && estimate > balance.availableDays &&
          <p className="font-medium text-amber-800">
            {t("vacation.employeePortal.balanceWarning")}
          </p>}</>
      : <p className="text-amber-800">{t("vacation.employeePortal.noMatchingBalance")}</p>)}
  </div>;
}
