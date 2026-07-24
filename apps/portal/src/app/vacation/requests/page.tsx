"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  Empty,
  ErrorState,
  primaryButtonClass,
  problemMessage,
  RequestTable,
} from "@/features/vacation/components/employee-vacation-dashboard";
import { VacationWorkspace } from "@/features/vacation/components/vacation-workspace";
import { useTranslations } from "@/i18n/use-translations";
import { ApiError } from "@/services/auth";
import { listMyVacationRequests } from "@/services/vacation";
import type { VacationRequest, VacationRequestStatus } from "@/types/vacation";

export default function VacationRequestsPage() {
  const { accessToken } = useAuth();
  const { locale, t } = useTranslations();
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [status, setStatus] = useState<"all" | VacationRequestStatus>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!accessToken) return;
    setIsLoading(true); setErrorCode(null);
    try {
      setRequests(await listMyVacationRequests(accessToken, locale, signal));
    } catch (error) {
      if (!signal?.aborted) setErrorCode(error instanceof ApiError
        ? error.problem?.code ?? "generic" : "generic");
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [accessToken, locale]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const visible = useMemo(() => requests
    .filter((request) => status === "all" || request.status === status)
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt)),
  [requests, status]);

  return <VacationWorkspace title={t("vacation.employeePortal.requestsTitle")}
    description={t("vacation.employeePortal.requestsDescription")}
    commandBar={<Link href="/vacation/requests/new" className={primaryButtonClass}>
      {t("vacation.employeePortal.newRequest")}
    </Link>}>
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <label className="block text-sm font-medium">
        {t("vacation.employeePortal.filterStatus")}
        <select value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          className="mt-1 block min-h-10 rounded-md border border-slate-300 bg-white px-3 focus:outline-none focus:ring-2 focus:ring-blue-600">
          <option value="all">{t("vacation.employeePortal.status.all")}</option>
          <option value="SUBMITTED">{t("vacation.employeePortal.status.submitted")}</option>
          <option value="APPROVED">{t("vacation.employeePortal.status.approved")}</option>
          <option value="REJECTED">{t("vacation.employeePortal.status.rejected")}</option>
          <option value="CANCELLED">{t("vacation.employeePortal.status.cancelled")}</option>
        </select>
      </label>
      <p className="text-sm text-slate-600">
        {t("vacation.employeePortal.resultCount", { count: visible.length })}
      </p>
    </div>
    {errorCode ? <ErrorState message={problemMessage(errorCode, t)}
      onRetry={() => void load()} />
      : isLoading ? <div className="h-52 animate-pulse rounded-lg bg-slate-200" />
        : visible.length === 0 ? <Empty text={t("vacation.employeePortal.noRequests")} />
          : <RequestTable requests={visible} />}
  </VacationWorkspace>;
}
