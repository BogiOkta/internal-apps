"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  FormField,
  formControlClassName,
  formDangerButtonClassName,
  formPrimaryButtonClassName,
  formSecondaryButtonClassName,
} from "@/components/form-field";
import { PortalNotification } from "@/components/portal-notification";
import { PortalNotificationHost } from "@/components/portal-notification-host";
import {
  formatDate,
  formatDateTime,
  problemMessage,
  statusLabel,
} from "@/features/vacation/components/employee-vacation-dashboard";
import { VacationStatusBadge } from "@/features/vacation/components/vacation-status-badge";
import { requestStatusLabel, sourceLabel } from "@/features/vacation/components/admin-vacation-request-list";
import { VacationWorkspace } from "@/features/vacation/components/vacation-workspace";
import { useTranslations } from "@/i18n/use-translations";
import { ApiError } from "@/services/auth";
import {
  approveAdminVacationRequest,
  cancelAdminVacationRequest,
  deleteAdminVacationRequest,
  getAdminVacationRequest,
  getAdminVacationRequestHistory,
  rejectAdminVacationRequest,
} from "@/services/vacation";
import { VACATION_REQUEST_DELETED_NOTICE_KEY } from "@/features/vacation/vacation-request-utils";
import {
  vacationRequestsDeletePermission,
  vacationRequestsManagePermission,
  type VacationRequest,
  type VacationRequestHistory,
} from "@/types/vacation";

export function AdminVacationRequestDetails({ requestId }: { requestId: string }) {
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const { locale, t } = useTranslations();
  const allowed = user?.permissions.includes(vacationRequestsManagePermission) ?? false;
  const canDelete =
    user?.permissions.includes(vacationRequestsDeletePermission) ?? false;
  const [request, setRequest] = useState<VacationRequest | null>(null);
  const [history, setHistory] = useState<VacationRequestHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [action, setAction] = useState<AdminAction | null>(null);
  const [comment, setComment] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteReasonError, setDeleteReasonError] = useState<string | null>(null);
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
    if (action === "delete") {
      const reason = deleteReason.trim();
      if (reason.length < 1 || reason.length > 500) {
        setDeleteReasonError(t("vacation.admin.action.delete.reasonRequired"));
        return;
      }
      setDeleteReasonError(null);
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);
      try {
        await deleteAdminVacationRequest(accessToken, locale, request.publicId, {
          reason,
        });
        window.sessionStorage.setItem(VACATION_REQUEST_DELETED_NOTICE_KEY, "1");
        setRequest(null);
        setHistory([]);
        setAction(null);
        setDeleteReason("");
        router.push("/vacation/admin/requests");
      } catch (caught) {
        setError(problemMessage(
          caught instanceof ApiError ? caught.problem?.code ?? "generic" : "generic", t));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

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
    breadcrumbRecordLabel={t("vacation.admin.detailsTitle")}
    description={t("vacation.admin.detailsDescription")}>
    <PortalNotificationHost>
      {success ? (
        <PortalNotification
          variant="success"
          message={success}
          dismissLabel={t("common.dismissNotification")}
          onDismiss={() => setSuccess(null)}
        />
      ) : null}
      {error ? (
        <PortalNotification
          variant="error"
          message={error}
          dismissLabel={t("common.dismissNotification")}
          onDismiss={() => setError(null)}
        />
      ) : null}
    </PortalNotificationHost>
    <div className="mb-4"><Link href="/vacation/admin/requests" className={formSecondaryButtonClassName()}>
      {t("vacation.admin.back")}
    </Link></div>
    {isLoading ? <div className="h-72 animate-pulse rounded-lg bg-slate-200" />
      : request && <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)]">
        <article className="rounded-lg border border-slate-300 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-xl font-semibold">{request.employeeName}</h2>
              <p className="mt-1 text-sm text-slate-500">{request.employeeNumber}</p></div>
            <VacationStatusBadge status={request.status} label={requestStatusLabel(request, t)} />
          </div>
          <dl className="mt-6 grid gap-5 sm:grid-cols-2">
            <Detail label={t("vacation.admin.column.leaveType")} value={request.leaveTypeName} />
            <Detail label={t("vacation.employeePortal.dateRange")}
              value={`${formatDate(request.dateFrom, locale)} – ${formatDate(request.dateTo, locale)}`} />
            <Detail label={t("vacation.employeePortal.workingDays")} value={String(request.workingDays)} />
            <Detail label={t("vacation.admin.column.source")} value={sourceLabel(request.source, t)} />
            <Detail label={t("vacation.employeePortal.submitted")} value={formatDateTime(request.submittedAt, locale)} />
            <Detail label={t("vacation.employeePortal.note")}
              value={request.employeeNote ?? t("vacation.employeePortal.notProvided")} />
            {request.decisionNote && <Detail label={t("vacation.employeePortal.decisionNote")}
              value={request.decisionNote} />}
          </dl>
          <AdminActions request={request} canDelete={canDelete} action={action}
            comment={comment} deleteReason={deleteReason}
            deleteReasonError={deleteReasonError} isSubmitting={isSubmitting} t={t}
            onChoose={(nextAction) => {
              setAction(nextAction);
              setComment("");
              setDeleteReason("");
              setDeleteReasonError(null);
              setError(null);
            }}
            onComment={setComment}
            onDeleteReason={(value) => {
              setDeleteReason(value);
              setDeleteReasonError(null);
            }}
            onSubmit={() => void submitAction()}
            onClose={() => {
              setAction(null);
              setComment("");
              setDeleteReason("");
              setDeleteReasonError(null);
            }} />
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

type AdminAction = "approve" | "reject" | "cancel" | "delete";

function AdminActions({ request, canDelete, action, comment, deleteReason,
  deleteReasonError, isSubmitting, t, onChoose, onComment, onDeleteReason, onSubmit,
  onClose }: {
  request: VacationRequest;
  canDelete: boolean;
  action: AdminAction | null;
  comment: string;
  deleteReason: string;
  deleteReasonError: string | null;
  isSubmitting: boolean;
  t: ReturnType<typeof useTranslations>["t"];
  onChoose: (action: AdminAction) => void;
  onComment: (comment: string) => void;
  onDeleteReason: (reason: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const transitionActions: Exclude<AdminAction, "delete">[] =
    request.source === "ADMINISTRATIVE_ENTRY"
      ? request.status === "APPROVED" ? ["cancel"] : []
      : request.status === "SUBMITTED"
      ? ["approve", "reject", "cancel"]
      : request.status === "APPROVED" ? ["cancel"] : [];
  const showDelete =
    canDelete &&
    (request.status === "REJECTED" || request.status === "CANCELLED");
  if (transitionActions.length === 0 && !showDelete) return null;

  return <div className="mt-6 border-t border-slate-200 pt-5">
    {!action ? <div className="flex flex-wrap gap-2">
      {transitionActions.map((item) => <button key={item} type="button"
        onClick={() => onChoose(item)}
        className={item === "approve"
          ? formPrimaryButtonClassName()
          : formSecondaryButtonClassName()}>
        {t(`vacation.admin.action.${item}.button`)}
      </button>)}
      {showDelete ? <button type="button" onClick={() => onChoose("delete")}
        className={formDangerButtonClassName()}>
        {t("vacation.admin.action.delete.button")}
      </button> : null}
    </div> : action === "delete" ? <ConfirmDialog
      title={t("vacation.admin.action.delete.title")}
      message={t("vacation.admin.action.delete.warning")}
      confirmLabel={isSubmitting
        ? t("vacation.admin.action.delete.loading")
        : t("vacation.admin.action.delete.confirm")}
      cancelLabel={t("vacation.admin.action.keep")}
      pending={isSubmitting}
      confirmDisabled={deleteReason.trim().length < 1 || deleteReason.trim().length > 500}
      destructive
      onConfirm={onSubmit}
      onCancel={onClose}
    >
      <FormField
        id="admin-delete-reason"
        label={t("vacation.admin.action.delete.reason")}
        required
        error={deleteReasonError ?? undefined}
      >
        <textarea id="admin-delete-reason" value={deleteReason} maxLength={500} rows={3}
          required disabled={isSubmitting}
          onChange={(event) => onDeleteReason(event.target.value)}
          className={`${formControlClassName()} resize-y`} />
      </FormField>
    </ConfirmDialog> : <ConfirmDialog
      title={t(`vacation.admin.action.${action}.title`)}
      message={t(`vacation.admin.action.${action}.warning`)}
      confirmLabel={isSubmitting
        ? t(`vacation.admin.action.${action}.loading`)
        : t(`vacation.admin.action.${action}.confirm`)}
      cancelLabel={t("vacation.admin.action.keep")}
      pending={isSubmitting}
      onConfirm={onSubmit}
      onCancel={onClose}
    >
      <FormField id="admin-action-comment" label={t("vacation.admin.action.comment")}>
        <textarea id="admin-action-comment" value={comment} maxLength={1000} rows={3}
          disabled={isSubmitting} onChange={(event) => onComment(event.target.value)}
          className={`${formControlClassName()} resize-y`} />
      </FormField>
    </ConfirmDialog>}
  </div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
    <dd className="mt-1 text-sm">{value}</dd></div>;
}
