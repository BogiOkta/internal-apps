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
  approveAdminVacationRequest,
  cancelAdminVacationRequest,
  getAdminVacationRequest,
  getAdminVacationRequestHistory,
  rejectAdminVacationRequest,
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
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [action, setAction] = useState<AdminAction | null>(null);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  async function submitAction() {
    if (!accessToken || !request || !action || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const body = { comment: comment.trim() || null };
      if (action === "approve") {
        await approveAdminVacationRequest(accessToken, locale, request.publicId, body);
      } else if (action === "reject") {
        await rejectAdminVacationRequest(accessToken, locale, request.publicId, body);
      } else {
        await cancelAdminVacationRequest(accessToken, locale, request.publicId, body);
      }
      setSuccess(t(`vacation.admin.action.${action}.success`));
      setAction(null);
      setComment("");
      await load();
    } catch (caught) {
      setError(problemMessage(
        caught instanceof ApiError ? caught.problem?.code ?? "generic" : "generic", t));
    } finally {
      setIsSubmitting(false);
    }
  }

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
    {success && <div role="status" className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">{success}</div>}
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
          <AdminActions request={request} action={action} comment={comment}
            isSubmitting={isSubmitting} t={t}
            onChoose={(nextAction) => { setAction(nextAction); setComment(""); setError(null); }}
            onComment={setComment} onSubmit={() => void submitAction()}
            onClose={() => { setAction(null); setComment(""); }} />
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

type AdminAction = "approve" | "reject" | "cancel";

function AdminActions({ request, action, comment, isSubmitting, t, onChoose,
  onComment, onSubmit, onClose }: {
  request: VacationRequest;
  action: AdminAction | null;
  comment: string;
  isSubmitting: boolean;
  t: ReturnType<typeof useTranslations>["t"];
  onChoose: (action: AdminAction) => void;
  onComment: (comment: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const actions: AdminAction[] = request.status === "SUBMITTED"
    ? ["approve", "reject", "cancel"]
    : request.status === "APPROVED" ? ["cancel"] : [];
  if (actions.length === 0) return null;

  return <div className="mt-6 border-t border-slate-200 pt-5">
    {!action ? <div className="flex flex-wrap gap-2">
      {actions.map((item) => <button key={item} type="button"
        onClick={() => onChoose(item)}
        className={item === "approve"
          ? "min-h-10 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white"
          : secondaryButtonClass}>
        {t(`vacation.admin.action.${item}.button`)}
      </button>)}
    </div> : <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
      <h3 className="font-semibold">{t(`vacation.admin.action.${action}.title`)}</h3>
      <p className="mt-1 text-sm">{t(`vacation.admin.action.${action}.warning`)}</p>
      <label className="mt-3 block text-sm font-medium">
        {t("vacation.admin.action.comment")}
        <textarea value={comment} maxLength={1000} rows={3}
          disabled={isSubmitting} onChange={(event) => onComment(event.target.value)}
          className="mt-1 block w-full resize-y rounded-md border border-slate-300 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-600" />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onSubmit} disabled={isSubmitting}
          className="min-h-10 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-50">
          {isSubmitting
            ? t(`vacation.admin.action.${action}.loading`)
            : t(`vacation.admin.action.${action}.confirm`)}
        </button>
        <button type="button" onClick={onClose} disabled={isSubmitting}
          className={secondaryButtonClass}>{t("vacation.admin.action.keep")}</button>
      </div>
    </div>}
  </div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
    <dd className="mt-1 text-sm">{value}</dd></div>;
}
