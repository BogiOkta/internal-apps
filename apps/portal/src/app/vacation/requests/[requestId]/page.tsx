"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  FormField,
  formControlClassName,
  formSecondaryButtonClassName,
} from "@/components/form-field";
import {
  formatDate,
  formatDateTime,
  problemMessage,
  statusLabel,
} from "@/features/vacation/components/employee-vacation-dashboard";
import { VacationStatusBadge } from "@/features/vacation/components/vacation-status-badge";
import { VacationWorkspace } from "@/features/vacation/components/vacation-workspace";
import { isCancellationEligible } from "@/features/vacation/vacation-request-utils";
import { useTranslations } from "@/i18n/use-translations";
import { ApiError } from "@/services/auth";
import {
  cancelMyVacationRequest,
  getMyVacationRequest,
  getMyVacationRequestHistory,
} from "@/services/vacation";
import type { VacationRequest, VacationRequestHistory } from "@/types/vacation";

export default function VacationRequestDetailsPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const { accessToken } = useAuth();
  const { locale, t } = useTranslations();
  const [request, setRequest] = useState<VacationRequest | null>(null);
  const [history, setHistory] = useState<VacationRequestHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [comment, setComment] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!accessToken || !requestId) return;
    setIsLoading(true); setError(null);
    try {
      const [nextRequest, nextHistory] = await Promise.all([
        getMyVacationRequest(accessToken, locale, requestId, signal),
        getMyVacationRequestHistory(accessToken, locale, requestId, signal),
      ]);
      setRequest(nextRequest); setHistory(nextHistory);
    } catch (caught) {
      if (!signal?.aborted) setError(problemMessage(
        caught instanceof ApiError ? caught.problem?.code ?? "generic" : "generic", t));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [accessToken, locale, requestId, t]);
  useEffect(() => {
    const controller = new AbortController();
    if (window.location.search.includes("created=1")) {
      setSuccess(t("vacation.employeePortal.createSuccess"));
      window.history.replaceState(null, "", window.location.pathname);
    }
    void load(controller.signal);
    return () => controller.abort();
  }, [load, t]);

  async function cancelRequest() {
    if (!accessToken || !request) return;
    setIsCancelling(true); setError(null);
    try {
      await cancelMyVacationRequest(accessToken, locale, request.publicId, {
        comment: comment.trim() || null,
      });
      setSuccess(t("vacation.employeePortal.cancelSuccess"));
      setIsConfirming(false); setComment("");
      await load();
    } catch (caught) {
      setError(problemMessage(
        caught instanceof ApiError ? caught.problem?.code ?? "generic" : "generic", t));
    } finally {
      setIsCancelling(false);
    }
  }

  return <VacationWorkspace title={t("vacation.employeePortal.detailsTitle")}
    description={t("vacation.employeePortal.detailsDescription")}>
    <div className="mb-4"><Link href="/vacation/requests" className={formSecondaryButtonClassName()}>
      {t("vacation.employeePortal.backToRequests")}
    </Link></div>
    {success && <div role="status" className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">{success}</div>}
    {error && <div role="alert" className="mb-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error}</div>}
    {isLoading ? <div className="h-72 animate-pulse rounded-lg bg-slate-200" />
      : request && <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)]">
        <article className="rounded-lg border border-slate-300 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-xl font-semibold">{request.leaveTypeName}</h2>
            <VacationStatusBadge status={request.status} label={statusLabel(request.status, t)} />
          </div>
          <dl className="mt-6 grid gap-5 sm:grid-cols-2">
            <Detail label={t("vacation.employeePortal.dateRange")}
              value={`${formatDate(request.dateFrom, locale)} – ${formatDate(request.dateTo, locale)}`} />
            <Detail label={t("vacation.employeePortal.workingDays")}
              value={String(request.workingDays)} />
            <Detail label={t("vacation.employeePortal.submitted")}
              value={formatDateTime(request.submittedAt, locale)} />
            {request.decidedAt && <Detail label={t("vacation.employeePortal.decided")}
              value={formatDateTime(request.decidedAt, locale)} />}
            {request.cancelledAt && <Detail label={t("vacation.employeePortal.cancelled")}
              value={formatDateTime(request.cancelledAt, locale)} />}
            <Detail label={t("vacation.employeePortal.note")}
              value={request.employeeNote ?? t("vacation.employeePortal.notProvided")} />
            {request.decisionNote && <Detail label={t("vacation.employeePortal.decisionNote")}
              value={request.decisionNote} />}
          </dl>
          {isCancellationEligible(request.status) && <div className="mt-6 border-t border-slate-200 pt-5">
            {!isConfirming ? <button type="button" onClick={() => setIsConfirming(true)}
              className={formSecondaryButtonClassName()}>{t("vacation.employeePortal.cancelRequest")}</button>
              : <ConfirmDialog
                title={t("vacation.employeePortal.cancelConfirmTitle")}
                message={request.status === "APPROVED"
                  ? t("vacation.employeePortal.cancelApprovedWarning")
                  : t("vacation.employeePortal.cancelWarning")}
                confirmLabel={isCancelling
                  ? t("vacation.employeePortal.cancelling")
                  : t("vacation.employeePortal.confirmCancel")}
                cancelLabel={t("vacation.employeePortal.keepRequest")}
                pending={isCancelling}
                onConfirm={() => void cancelRequest()}
                onCancel={() => setIsConfirming(false)}
              >
                <FormField id="cancel-comment" label={t("vacation.employeePortal.cancelComment")}>
                  <textarea id="cancel-comment" value={comment} maxLength={1000} rows={3}
                    disabled={isCancelling} onChange={(event) => setComment(event.target.value)}
                    className={`${formControlClassName()} resize-y`} />
                </FormField>
              </ConfirmDialog>}
          </div>}
        </article>
        <aside className="rounded-lg border border-slate-300 bg-white p-6" aria-labelledby="history-heading">
          <h2 id="history-heading" className="text-lg font-semibold">{t("vacation.employeePortal.history")}</h2>
          <ol className="mt-5 space-y-5">
            {history.map((entry) => <li key={entry.publicId}
              className="relative border-l-2 border-slate-300 pl-5">
              <span aria-hidden="true" className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-blue-700" />
              <VacationStatusBadge status={entry.newStatus}
                label={statusLabel(entry.newStatus, t)} />
              <p className="mt-2 text-sm text-slate-600">{formatDateTime(entry.changedAt, locale)}</p>
              <p className="mt-1 text-sm">{entry.changedByDisplayName ||
                t("vacation.employeePortal.actorNeutral")}</p>
              {entry.comment && <p className="mt-1 text-sm text-slate-700">{entry.comment}</p>}
            </li>)}
          </ol>
        </aside>
      </div>}
  </VacationWorkspace>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
    <dd className="mt-1 text-sm text-slate-900">{value}</dd></div>;
}
