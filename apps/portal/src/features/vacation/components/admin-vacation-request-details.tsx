"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  formatDate,
  formatDateTime,
  problemMessage,
  secondaryButtonClass,
  statusLabel,
} from "@/features/vacation/components/employee-vacation-dashboard";
import { VacationStatusBadge } from "@/features/vacation/components/vacation-status-badge";
import { VacationWorkspace } from "@/features/vacation/components/vacation-workspace";
import { useTranslations } from "@/i18n/use-translations";
import { ApiError } from "@/services/auth";
import {
  getAdminVacationRequest,
  getAdminVacationRequestHistory,
} from "@/services/vacation";
import {
  vacationRequestsManagePermission,
  type VacationRequest,
  type VacationRequestHistory,
} from "@/types/vacation";

export function AdminVacationRequestDetails({ requestId }: { requestId: string }) {
  const { accessToken, user } = useAuth();
  const { locale, t } = useTranslations();
  const allowed = user?.permissions.includes(vacationRequestsManagePermission) ?? false;
  const [request, setRequest] = useState<VacationRequest | null>(null);
  const [history, setHistory] = useState<VacationRequestHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!accessToken || !allowed) return;
    setIsLoading(true);
    setError(null);
    try {
      const [nextRequest, nextHistory] = await Promise.all([
        getAdminVacationRequest(accessToken, locale, requestId, signal),
        getAdminVacationRequestHistory(accessToken, locale, requestId, signal),
      ]);
      setRequest(nextRequest);
      setHistory(nextHistory);
    } catch (caught) {
      if (!signal?.aborted) setError(problemMessage(
        caught instanceof ApiError ? caught.problem?.code ?? "generic" : "generic", t));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [accessToken, allowed, locale, requestId, t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (!allowed) return <VacationWorkspace title={t("vacation.admin.detailsTitle")}>
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
      {t("vacation.admin.forbidden")}
    </div>
  </VacationWorkspace>;

  return <VacationWorkspace title={t("vacation.admin.detailsTitle")}
    description={t("vacation.admin.detailsDescription")}>
    <div className="mb-4"><Link href="/vacation/admin/requests" className={secondaryButtonClass}>
      {t("vacation.admin.back")}
    </Link></div>
    {error && <div role="alert" className="mb-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error}</div>}
    {isLoading ? <div className="h-72 animate-pulse rounded-lg bg-slate-200" />
      : request && <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)]">
        <article className="rounded-lg border border-slate-300 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-xl font-semibold">{request.employeeName}</h2>
              <p className="mt-1 text-sm text-slate-500">{request.employeeNumber}</p></div>
            <VacationStatusBadge status={request.status} label={statusLabel(request.status, t)} />
          </div>
          <dl className="mt-6 grid gap-5 sm:grid-cols-2">
            <Detail label={t("vacation.admin.column.leaveType")} value={request.leaveTypeName} />
            <Detail label={t("vacation.employeePortal.dateRange")}
              value={`${formatDate(request.dateFrom, locale)} – ${formatDate(request.dateTo, locale)}`} />
            <Detail label={t("vacation.employeePortal.workingDays")} value={String(request.workingDays)} />
            <Detail label={t("vacation.employeePortal.submitted")} value={formatDateTime(request.submittedAt, locale)} />
            <Detail label={t("vacation.employeePortal.note")}
              value={request.employeeNote ?? t("vacation.employeePortal.notProvided")} />
            {request.decisionNote && <Detail label={t("vacation.employeePortal.decisionNote")}
              value={request.decisionNote} />}
          </dl>
        </article>
        <aside className="rounded-lg border border-slate-300 bg-white p-6">
          <h2 className="text-lg font-semibold">{t("vacation.employeePortal.history")}</h2>
          <ol className="mt-5 space-y-5">{history.map((entry) =>
            <li key={entry.publicId} className="border-l-2 border-slate-300 pl-5">
              <VacationStatusBadge status={entry.newStatus} label={statusLabel(entry.newStatus, t)} />
              <p className="mt-2 text-sm text-slate-600">{formatDateTime(entry.changedAt, locale)}</p>
              <p className="mt-1 text-sm">{entry.changedByDisplayName || t("vacation.employeePortal.actorNeutral")}</p>
              {entry.comment && <p className="mt-1 text-sm text-slate-700">{entry.comment}</p>}
            </li>)}</ol>
        </aside>
      </div>}
  </VacationWorkspace>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
    <dd className="mt-1 text-sm">{value}</dd></div>;
}
