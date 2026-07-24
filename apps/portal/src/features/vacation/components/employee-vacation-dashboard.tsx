"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppCalendar } from "@/components/calendar";
import { useAuth } from "@/components/auth-provider";
import { VacationStatusBadge } from "@/features/vacation/components/vacation-status-badge";
import { VacationWorkspace } from "@/features/vacation/components/vacation-workspace";
import {
  toVacationCalendarEvent,
  vacationProblemTranslationKeys,
} from "@/features/vacation/vacation-request-utils";
import type { TranslationKey } from "@/i18n/translations";
import { useTranslations } from "@/i18n/use-translations";
import { ApiError } from "@/services/auth";
import {
  listMyVacationBalances,
  listMyVacationLeaveTypes,
  listMyVacationRequests,
} from "@/services/vacation";
import type {
  VacationBalance,
  VacationLeaveTypeOption,
  VacationRequest,
  VacationRequestStatus,
} from "@/types/vacation";

type Translate = ReturnType<typeof useTranslations>["t"];

export function EmployeeVacationDashboard() {
  const { accessToken } = useAuth();
  const { locale, t } = useTranslations();
  const router = useRouter();
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [balances, setBalances] = useState<VacationBalance[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<VacationLeaveTypeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!accessToken) return;
    setIsLoading(true);
    setErrorCode(null);
    try {
      const [nextRequests, nextBalances, nextLeaveTypes] = await Promise.all([
        listMyVacationRequests(accessToken, locale, signal),
        listMyVacationBalances(accessToken, locale, signal),
        listMyVacationLeaveTypes(accessToken, locale, signal),
      ]);
      setRequests(nextRequests);
      setBalances(nextBalances);
      setLeaveTypes(nextLeaveTypes);
    } catch (error) {
      if (!signal?.aborted) {
        setErrorCode(error instanceof ApiError
          ? error.problem?.code ?? "generic"
          : "generic");
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [accessToken, locale]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const counts = useMemo(() => {
    const result: Record<VacationRequestStatus, number> = {
      SUBMITTED: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0,
    };
    requests.forEach((request) => { result[request.status] += 1; });
    return result;
  }, [requests]);
  const currentYear = new Date().getFullYear();
  const requiredTypes = leaveTypes.filter((type) => type.requiresBalance);
  const requiredLeaveTypeIds = new Set(
    requiredTypes.map((leaveType) => leaveType.publicId),
  );
  const currentBalances = balances.filter(
    (balance) =>
      balance.year === currentYear &&
      requiredLeaveTypeIds.has(balance.leaveTypePublicId),
  );
  const upcoming = [...requests]
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
    .slice(0, 6);

  return (
    <VacationWorkspace title={t("vacation.employeePortal.title")}
      description={t("vacation.employeePortal.description")}
      commandBar={<Link href="/vacation/requests/new" className={primaryButtonClass}>
        {t("vacation.employeePortal.newRequest")}
      </Link>}>
      {errorCode === "current_user_employee_not_linked" ? <UnlinkedState />
        : errorCode ? <ErrorState message={problemMessage(errorCode, t)}
          onRetry={() => void load()} />
          : <div className="space-y-8">
            <section aria-labelledby="balance-heading">
              <Heading id="balance-heading" title={t("vacation.employeePortal.balanceTitle")} />
              {isLoading ? <Skeleton />
                : requiredTypes.length === 0
                  ? <Empty text={t("vacation.employeePortal.noBalanceTypes")} />
                  : currentBalances.length === 0
                    ? <Empty text={t("vacation.employeePortal.noBalances")} />
                    : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {currentBalances.map((balance) => <BalanceCard
                        key={balance.publicId} balance={balance} />)}
                    </div>}
            </section>
            <section aria-labelledby="summary-heading">
              <Heading id="summary-heading" title={t("vacation.employeePortal.summaryTitle")} />
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {(["SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"] as const)
                  .map((status) => <article key={status}
                    className="rounded-lg border border-slate-300 bg-white p-4">
                    <VacationStatusBadge status={status} label={statusLabel(status, t)} />
                    <p className="mt-3 text-2xl font-semibold">{counts[status]}</p>
                  </article>)}
              </div>
            </section>
            <section aria-labelledby="requests-heading">
              <div className="mb-3 flex items-center justify-between gap-4">
                <Heading id="requests-heading" title={t("vacation.employeePortal.recentTitle")} />
                <Link href="/vacation/requests"
                  className="text-sm font-semibold text-blue-700 hover:underline">
                  {t("vacation.employeePortal.viewAll")}
                </Link>
              </div>
              {isLoading ? <Skeleton /> : upcoming.length === 0
                ? <Empty text={t("vacation.employeePortal.noRequests")} />
                : <RequestTable requests={upcoming} />}
            </section>
            <section id="calendar" aria-labelledby="calendar-heading" className="scroll-mt-20">
              <Heading id="calendar-heading" title={t("vacation.employeePortal.calendarTitle")} />
              <AppCalendar events={requests.map(toVacationCalendarEvent)}
                isLoading={isLoading}
                onEventClick={(event) =>
                  router.push(`/vacation/requests/${event.resource!.publicId}`)}
                labels={{
                  emptyTitle: t("vacation.employeePortal.calendarEmpty"),
                  emptyDescription: t("vacation.employeePortal.calendarEmptyDescription"),
                  status: {
                    submitted: statusLabel("SUBMITTED", t),
                    approved: statusLabel("APPROVED", t),
                    rejected: statusLabel("REJECTED", t),
                    cancelled: statusLabel("CANCELLED", t),
                  },
                }} />
            </section>
          </div>}
    </VacationWorkspace>
  );
}

export const primaryButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50";

export function statusLabel(status: VacationRequestStatus, t: Translate) {
  return t(`vacation.employeePortal.status.${status.toLowerCase()}` as TranslationKey);
}
export function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" })
    .format(new Date(`${value}T00:00:00`));
}
export function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" })
    .format(new Date(value));
}
export function problemMessage(code: string, t: Translate) {
  return t((vacationProblemTranslationKeys[code] ??
    "vacation.employeePortal.error.generic") as TranslationKey);
}

export function RequestTable({ requests }: { requests: VacationRequest[] }) {
  const { locale, t } = useTranslations();
  return <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
    <table className="w-full min-w-[760px] text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>
        {["type", "dates", "days", "status", "submitted", "details"].map((key) =>
          <th key={key} className="px-4 py-3">
            {t(`vacation.employeePortal.column.${key}` as TranslationKey)}
          </th>)}
      </tr></thead>
      <tbody className="divide-y divide-slate-200">{requests.map((request) =>
        <tr key={request.publicId}>
          <td className="px-4 py-3 font-medium">{request.leaveTypeName}</td>
          <td className="px-4 py-3">{formatDate(request.dateFrom, locale)} – {formatDate(request.dateTo, locale)}</td>
          <td className="px-4 py-3">{request.workingDays}</td>
          <td className="px-4 py-3"><VacationStatusBadge status={request.status}
            label={statusLabel(request.status, t)} /></td>
          <td className="px-4 py-3">{formatDateTime(request.submittedAt, locale)}</td>
          <td className="px-4 py-3"><Link className="font-semibold text-blue-700 hover:underline"
            href={`/vacation/requests/${request.publicId}`}>
            {t("vacation.employeePortal.details")}
          </Link></td>
        </tr>)}</tbody>
    </table>
  </div>;
}

function BalanceCard({ balance }: { balance: VacationBalance }) {
  const { t } = useTranslations();
  const values = [
    ["entitlement", balance.entitlementDays],
    ["carryOver", balance.carryOverDays],
    ["adjustment", balance.adjustmentDays],
    ["used", balance.usedDays],
  ] as const;
  return <article className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
    <h3 className="font-semibold">{balance.leaveTypeName}</h3>
    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
      {values.map(([key, value]) => <div key={key}><dt className="text-slate-500">
        {t(`vacation.employeePortal.${key}` as TranslationKey)}
      </dt><dd className="mt-0.5 font-semibold">{value}</dd></div>)}
      <div className="col-span-2 border-t border-slate-200 pt-3">
        <dt className="text-slate-500">{t("vacation.employeePortal.remaining")}</dt>
        <dd className="text-xl font-semibold text-blue-800">{balance.availableDays}</dd>
      </div>
    </dl>
  </article>;
}
function Heading({ id, title }: { id: string; title: string }) {
  return <h2 id={id} className="mb-3 text-lg font-semibold">{title}</h2>;
}
export function Empty({ text }: { text: string }) {
  return <div role="status" className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">{text}</div>;
}
function Skeleton() {
  return <div aria-hidden="true" className="h-40 animate-pulse rounded-lg bg-slate-200" />;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslations();
  return <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-5 text-red-900">
    <p>{message}</p><button type="button" onClick={onRetry}
      className="mt-3 min-h-10 rounded-md border border-red-400 px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-600">
      {t("vacation.employeePortal.retry")}
    </button>
  </div>;
}
function UnlinkedState() {
  const { t } = useTranslations();
  return <div role="status" className="mx-auto max-w-2xl rounded-lg border border-amber-300 bg-amber-50 p-6">
    <h2 className="text-lg font-semibold">{t("vacation.employeePortal.unlinkedTitle")}</h2>
    <p className="mt-2 text-sm leading-6">{t("vacation.employeePortal.unlinkedDescription")}</p>
  </div>;
}
