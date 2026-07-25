"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  Empty,
  ErrorState,
  formatDate,
  formatDateTime,
  problemMessage,
  statusLabel,
} from "@/features/vacation/components/employee-vacation-dashboard";
import { VacationStatusBadge } from "@/features/vacation/components/vacation-status-badge";
import { VacationWorkspace } from "@/features/vacation/components/vacation-workspace";
import type { TranslationKey } from "@/i18n/translations";
import { useTranslations } from "@/i18n/use-translations";
import { ApiError } from "@/services/auth";
import { listAdminVacationRequests, listLeaveTypes } from "@/services/vacation";
import {
  vacationRequestsManagePermission,
  type LeaveType,
  type PagedVacationRequests,
  type VacationRequest,
  type VacationRequestStatus,
} from "@/types/vacation";

const pageSize = 25;
const inputClass = "mt-1 block min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600";

export function AdminVacationRequestList() {
  const { accessToken, user } = useAuth();
  const { locale, t } = useTranslations();
  const allowed = user?.permissions.includes(vacationRequestsManagePermission) ?? false;
  const [result, setResult] = useState<PagedVacationRequests | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [status, setStatus] = useState<"all" | VacationRequestStatus>("all");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!accessToken || !allowed) return;
    setIsLoading(true);
    setErrorCode(null);
    try {
      const selectedYear = Number(year);
      const [requests, types] = await Promise.all([
        listAdminVacationRequests(accessToken, locale, {
          status: status === "all" ? undefined : status,
          leaveTypeId: leaveTypeId || undefined,
          search: search || undefined,
          dateFrom: `${selectedYear}-01-01`,
          dateTo: `${selectedYear}-12-31`,
          page,
          pageSize,
        }, signal),
        listLeaveTypes(accessToken, locale, { status: "all" }, signal),
      ]);
      setResult(requests);
      setLeaveTypes(types);
    } catch (error) {
      if (!signal?.aborted) setErrorCode(error instanceof ApiError
        ? error.problem?.code ?? "generic" : "generic");
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [accessToken, allowed, leaveTypeId, locale, page, search, status, year]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: current - 1999 }, (_, index) => current - index);
  }, []);
  const totalPages = Math.max(1, Math.ceil((result?.totalCount ?? 0) / pageSize));

  function resetPage(action: () => void) {
    setPage(1);
    action();
  }

  if (!allowed) return <VacationWorkspace title={t("vacation.admin.title")}>
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
      {t("vacation.admin.forbidden")}
    </div>
  </VacationWorkspace>;

  return <VacationWorkspace title={t("vacation.admin.title")}
    description={t("vacation.admin.description")}>
    <form className="mb-5 grid gap-3 rounded-lg border border-slate-300 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        resetPage(() => setSearch(searchInput.trim()));
      }}>
      <Filter label={t("vacation.admin.filter.status")}>
        <select className={inputClass} value={status}
          onChange={(event) => resetPage(() => setStatus(event.target.value as typeof status))}>
          {["all", "submitted", "approved", "rejected", "cancelled"].map((value) =>
            <option key={value} value={value === "all" ? "all" : value.toUpperCase()}>
              {t(`vacation.employeePortal.status.${value}` as TranslationKey)}
            </option>)}
        </select>
      </Filter>
      <Filter label={t("vacation.admin.filter.leaveType")}>
        <select className={inputClass} value={leaveTypeId}
          onChange={(event) => resetPage(() => setLeaveTypeId(event.target.value))}>
          <option value="">{t("vacation.admin.filter.allLeaveTypes")}</option>
          {leaveTypes.map((type) => <option key={type.publicId} value={type.publicId}>
            {type.name}
          </option>)}
        </select>
      </Filter>
      <Filter label={t("vacation.admin.filter.employee")}>
        <div className="flex gap-2">
          <input className={inputClass} value={searchInput} maxLength={100}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t("vacation.admin.filter.employeePlaceholder")} />
          <button className="mt-1 min-h-10 rounded-md bg-blue-700 px-3 text-sm font-semibold text-white"
            type="submit">{t("vacation.admin.filter.search")}</button>
        </div>
      </Filter>
      <Filter label={t("vacation.admin.filter.year")}>
        <select className={inputClass} value={year}
          onChange={(event) => resetPage(() => setYear(event.target.value))}>
          {years.map((value) => <option key={value}>{value}</option>)}
        </select>
      </Filter>
    </form>
    {errorCode ? <ErrorState message={problemMessage(errorCode, t)} onRetry={() => void load()} />
      : isLoading ? <div className="h-60 animate-pulse rounded-lg bg-slate-200" />
        : !result?.items.length ? <Empty text={t("vacation.admin.empty")} />
          : <><div className="hidden overflow-x-auto rounded-lg border border-slate-300 bg-white md:block">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>
                {["employee", "leaveType", "dateRange", "workingDays", "submitted", "status", "details"].map((key) =>
                  <th key={key} className="px-4 py-3">{t(`vacation.admin.column.${key}` as TranslationKey)}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-200">
                {result.items.map((request) => <RequestRow key={request.publicId} request={request} />)}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 md:hidden">
            {result.items.map((request) => <RequestCard key={request.publicId} request={request} />)}
          </div></>}
    {!errorCode && result && <div className="mt-4 flex items-center justify-between gap-3 text-sm">
      <span>{t("vacation.admin.results", { count: result.totalCount })}</span>
      <div className="flex items-center gap-2">
        <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}
          className="min-h-10 rounded-md border border-slate-300 bg-white px-3 font-semibold disabled:opacity-50">
          {t("vacation.admin.previous")}
        </button>
        <span>{t("vacation.admin.page", { page, total: totalPages })}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}
          className="min-h-10 rounded-md border border-slate-300 bg-white px-3 font-semibold disabled:opacity-50">
          {t("vacation.admin.next")}
        </button>
      </div>
    </div>}
  </VacationWorkspace>;
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium">{label}{children}</label>;
}

function RequestRow({ request }: { request: VacationRequest }) {
  const { locale, t } = useTranslations();
  return <tr>
    <td className="px-4 py-3"><span className="font-medium">{request.employeeName}</span>
      <span className="block text-xs text-slate-500">{request.employeeNumber}</span></td>
    <td className="px-4 py-3">{request.leaveTypeName}</td>
    <td className="px-4 py-3">{formatDate(request.dateFrom, locale)} – {formatDate(request.dateTo, locale)}</td>
    <td className="px-4 py-3">{request.workingDays}</td>
    <td className="px-4 py-3">{formatDateTime(request.submittedAt, locale)}</td>
    <td className="px-4 py-3"><VacationStatusBadge status={request.status} label={statusLabel(request.status, t)} /></td>
    <td className="px-4 py-3"><DetailsLink request={request} /></td>
  </tr>;
}

function RequestCard({ request }: { request: VacationRequest }) {
  const { locale, t } = useTranslations();
  return <article className="rounded-lg border border-slate-300 bg-white p-4">
    <div className="flex items-start justify-between gap-3">
      <div><h2 className="font-semibold">{request.employeeName}</h2>
        <p className="text-xs text-slate-500">{request.employeeNumber}</p></div>
      <VacationStatusBadge status={request.status} label={statusLabel(request.status, t)} />
    </div>
    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
      <CardDetail label={t("vacation.admin.column.leaveType")} value={request.leaveTypeName} />
      <CardDetail label={t("vacation.admin.column.workingDays")} value={String(request.workingDays)} />
      <div className="col-span-2"><CardDetail label={t("vacation.admin.column.dateRange")}
        value={`${formatDate(request.dateFrom, locale)} – ${formatDate(request.dateTo, locale)}`} /></div>
      <div className="col-span-2"><CardDetail label={t("vacation.admin.column.submitted")}
        value={formatDateTime(request.submittedAt, locale)} /></div>
    </dl>
    <div className="mt-4"><DetailsLink request={request} /></div>
  </article>;
}

function CardDetail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs uppercase text-slate-500">{label}</dt>
    <dd className="mt-1">{value}</dd></div>;
}

function DetailsLink({ request }: { request: VacationRequest }) {
  const { t } = useTranslations();
  return <Link href={`/vacation/admin/requests/${request.publicId}`}
    className="font-semibold text-blue-700 hover:underline">{t("vacation.employeePortal.details")}</Link>;
}
