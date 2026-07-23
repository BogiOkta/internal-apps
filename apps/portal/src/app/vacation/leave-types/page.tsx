"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth-provider";
import { VacationWorkspace } from "@/features/vacation/components/vacation-workspace";
import { useTranslations } from "@/i18n/use-translations";
import { listLeaveTypes } from "@/services/vacation";
import type {
  LeaveType,
  LeaveTypeSortDirection,
  LeaveTypeSortField,
  LeaveTypeStatusFilter,
} from "@/types/vacation";

export default function LeaveTypesPage() {
  const { accessToken } = useAuth();
  const { browserLocale, t } = useTranslations();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<LeaveTypeStatusFilter>("all");
  const [sortBy, setSortBy] = useState<LeaveTypeSortField>("displayOrder");
  const [sortDirection, setSortDirection] =
    useState<LeaveTypeSortDirection>("asc");
  const [selectedPublicId, setSelectedPublicId] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setHasError(false);

    listLeaveTypes(
      accessToken,
      browserLocale,
      {
        search: debouncedSearch || undefined,
        status,
        sortBy,
        sortDirection,
      },
      controller.signal,
    )
      .then((result) => {
        setLeaveTypes(result);
        setSelectedPublicId((currentSelection) =>
          currentSelection &&
          result.some((leaveType) => leaveType.publicId === currentSelection)
            ? currentSelection
            : null,
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLeaveTypes([]);
          setSelectedPublicId(null);
          setHasError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    accessToken,
    browserLocale,
    debouncedSearch,
    refreshVersion,
    sortBy,
    sortDirection,
    status,
  ]);

  const selectedLeaveType = useMemo(
    () =>
      leaveTypes.find((leaveType) => leaveType.publicId === selectedPublicId) ??
      null,
    [leaveTypes, selectedPublicId],
  );

  function selectLeaveType(leaveType: LeaveType) {
    setSelectedPublicId(leaveType.publicId);
  }

  return (
    <VacationWorkspace
      title={t("vacation.leaveTypes.title")}
      description={t("vacation.leaveTypes.description")}
      commandBar={
        <LeaveTypesCommandBar
          isRefreshing={isLoading}
          search={search}
          sortBy={sortBy}
          sortDirection={sortDirection}
          status={status}
          onRefresh={() => setRefreshVersion((version) => version + 1)}
          onSearchChange={setSearch}
          onSortByChange={setSortBy}
          onSortDirectionChange={setSortDirection}
          onStatusChange={setStatus}
        />
      }
    >
      <div className="space-y-3">
        {hasError && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {t("vacation.leaveTypes.error")}
          </div>
        )}

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <LeaveTypesTable
            hasError={hasError}
            isLoading={isLoading}
            leaveTypes={leaveTypes}
            selectedPublicId={selectedPublicId}
            onSelect={selectLeaveType}
          />
          <LeaveTypeDetails leaveType={selectedLeaveType} />
        </div>
      </div>
    </VacationWorkspace>
  );
}

function LeaveTypesCommandBar({
  isRefreshing,
  search,
  sortBy,
  sortDirection,
  status,
  onRefresh,
  onSearchChange,
  onSortByChange,
  onSortDirectionChange,
  onStatusChange,
}: {
  isRefreshing: boolean;
  search: string;
  sortBy: LeaveTypeSortField;
  sortDirection: LeaveTypeSortDirection;
  status: LeaveTypeStatusFilter;
  onRefresh: () => void;
  onSearchChange: (value: string) => void;
  onSortByChange: (value: LeaveTypeSortField) => void;
  onSortDirectionChange: (value: LeaveTypeSortDirection) => void;
  onStatusChange: (value: LeaveTypeStatusFilter) => void;
}) {
  const { t } = useTranslations();

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshIcon />
        {isRefreshing
          ? t("vacation.leaveTypes.refreshing")
          : t("vacation.leaveTypes.refresh")}
      </button>

      <div className="ml-0 flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:ml-auto lg:justify-end">
        <label className="min-w-[210px] flex-1 lg:max-w-xs">
          <span className="sr-only">
            {t("vacation.leaveTypes.searchLabel")}
          </span>
          <input
            type="search"
            maxLength={100}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("vacation.leaveTypes.searchPlaceholder")}
            className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label>
          <span className="sr-only">
            {t("vacation.leaveTypes.statusFilter")}
          </span>
          <select
            value={status}
            onChange={(event) =>
              onStatusChange(event.target.value as LeaveTypeStatusFilter)
            }
            className="min-h-9 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">
              {t("vacation.leaveTypes.filterAll")}
            </option>
            <option value="active">
              {t("vacation.leaveTypes.filterActive")}
            </option>
            <option value="inactive">
              {t("vacation.leaveTypes.filterInactive")}
            </option>
          </select>
        </label>

        <label>
          <span className="sr-only">
            {t("vacation.leaveTypes.sortByLabel")}
          </span>
          <select
            value={sortBy}
            onChange={(event) =>
              onSortByChange(event.target.value as LeaveTypeSortField)
            }
            className="min-h-9 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          >
            <option value="displayOrder">
              {t("vacation.leaveTypes.sortDisplayOrder")}
            </option>
            <option value="code">{t("vacation.leaveTypes.sortCode")}</option>
            <option value="name">{t("vacation.leaveTypes.sortName")}</option>
            <option value="status">
              {t("vacation.leaveTypes.sortStatus")}
            </option>
          </select>
        </label>

        <label>
          <span className="sr-only">
            {t("vacation.leaveTypes.sortDirectionLabel")}
          </span>
          <select
            value={sortDirection}
            onChange={(event) =>
              onSortDirectionChange(
                event.target.value as LeaveTypeSortDirection,
              )
            }
            className="min-h-9 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          >
            <option value="asc">
              {t("vacation.leaveTypes.sortAscending")}
            </option>
            <option value="desc">
              {t("vacation.leaveTypes.sortDescending")}
            </option>
          </select>
        </label>
      </div>
    </div>
  );
}

function LeaveTypesTable({
  hasError,
  isLoading,
  leaveTypes,
  selectedPublicId,
  onSelect,
}: {
  hasError: boolean;
  isLoading: boolean;
  leaveTypes: LeaveType[];
  selectedPublicId: string | null;
  onSelect: (leaveType: LeaveType) => void;
}) {
  const { t } = useTranslations();
  const selected = leaveTypes.find(
    (leaveType) => leaveType.publicId === selectedPublicId,
  );

  return (
    <section
      aria-label={t("vacation.leaveTypes.tableLabel")}
      className="min-w-0 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm"
    >
      <div className="overflow-x-auto">
        <table
          aria-busy={isLoading}
          className="w-full min-w-[760px] border-collapse text-left text-sm"
        >
          <thead className="border-b border-slate-300 bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-3">
                {t("vacation.leaveTypes.code")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("vacation.leaveTypes.name")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("vacation.leaveTypes.balance")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("vacation.leaveTypes.approval")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("vacation.leaveTypes.status")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  {t("vacation.leaveTypes.loading")}
                </td>
              </tr>
            )}

            {!isLoading && !hasError && leaveTypes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center">
                  <p className="font-medium text-slate-900">
                    {t("vacation.leaveTypes.emptyTitle")}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {t("vacation.leaveTypes.emptyDescription")}
                  </p>
                </td>
              </tr>
            )}

            {!isLoading &&
              !hasError &&
              leaveTypes.map((leaveType) => {
                const isSelected = leaveType.publicId === selectedPublicId;

                return (
                  <tr
                    key={leaveType.publicId}
                    onClick={() => onSelect(leaveType)}
                    className={`cursor-pointer hover:bg-slate-50 ${
                      isSelected
                        ? "bg-blue-50 shadow-[inset_3px_0_0_#1d4ed8]"
                        : "bg-white"
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                      {leaveType.code}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        aria-label={t("vacation.leaveTypes.selectRecord", {
                          name: leaveType.name,
                        })}
                        aria-pressed={isSelected}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelect(leaveType);
                        }}
                        className="rounded-sm text-left font-semibold text-slate-950 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                      >
                        {leaveType.name}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <BooleanBadge
                        value={leaveType.countsAgainstVacationBalance}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <BooleanBadge value={leaveType.requiresApproval} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge isActive={leaveType.isActive} />
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="flex min-h-11 flex-col justify-between gap-1 border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600 sm:flex-row sm:items-center">
        <span>
          {t("vacation.leaveTypes.records", { count: leaveTypes.length })}
        </span>
        <span>
          {selected
            ? t("vacation.leaveTypes.selected", { name: selected.name })
            : t("vacation.leaveTypes.selectionHint")}
        </span>
      </div>
    </section>
  );
}

function LeaveTypeDetails({ leaveType }: { leaveType: LeaveType | null }) {
  const { t } = useTranslations();

  return (
    <aside
      aria-label={t("vacation.leaveTypes.detailsLabel")}
      className="self-start rounded-lg border border-slate-300 bg-white shadow-sm"
    >
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-950">
          {t("vacation.leaveTypes.details")}
        </h2>
      </div>

      {!leaveType ? (
        <p className="px-4 py-8 text-sm leading-6 text-slate-500">
          {t("vacation.leaveTypes.selectForDetails")}
        </p>
      ) : (
        <div className="space-y-5 p-4">
          <div>
            <h3 className="text-base font-semibold text-slate-950">
              {leaveType.name}
            </h3>
            <p className="mt-1 font-mono text-xs font-semibold text-slate-500">
              {leaveType.code}
            </p>
          </div>

          <p className="text-sm leading-6 text-slate-600">
            {leaveType.description ?? t("vacation.leaveTypes.noDescription")}
          </p>

          <dl className="space-y-3 text-sm">
            <DetailRow
              label={t("vacation.leaveTypes.calendarColor")}
              value={
                leaveType.calendarColor ? (
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 rounded border border-slate-300"
                      style={{ backgroundColor: leaveType.calendarColor }}
                    />
                    <span>{leaveType.calendarColor}</span>
                  </span>
                ) : (
                  t("vacation.leaveTypes.notSet")
                )
              }
            />
            <DetailRow
              label={t("vacation.leaveTypes.balance")}
              value={
                leaveType.countsAgainstVacationBalance
                  ? t("vacation.leaveTypes.yes")
                  : t("vacation.leaveTypes.no")
              }
            />
            <DetailRow
              label={t("vacation.leaveTypes.approval")}
              value={
                leaveType.requiresApproval
                  ? t("vacation.leaveTypes.yes")
                  : t("vacation.leaveTypes.no")
              }
            />
            <DetailRow
              label={t("vacation.leaveTypes.status")}
              value={
                leaveType.isActive
                  ? t("vacation.leaveTypes.recordActive")
                  : t("vacation.leaveTypes.recordInactive")
              }
            />
            <DetailRow
              label={t("vacation.leaveTypes.displayOrder")}
              value={String(leaveType.displayOrder)}
            />
          </dl>
        </div>
      )}
    </aside>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function BooleanBadge({ value }: { value: boolean }) {
  const { t } = useTranslations();

  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${
        value
          ? "border-blue-200 bg-blue-50 text-blue-800"
          : "border-slate-300 bg-slate-100 text-slate-700"
      }`}
    >
      {value ? t("vacation.leaveTypes.yes") : t("vacation.leaveTypes.no")}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  const { t } = useTranslations();

  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${
        isActive
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-slate-300 bg-slate-100 text-slate-700"
      }`}
    >
      {isActive
        ? t("vacation.leaveTypes.recordActive")
        : t("vacation.leaveTypes.recordInactive")}
    </span>
  );
}

function RefreshIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M15.5 6.5V3m0 0H12M15.5 3A7 7 0 1 0 17 11" />
    </svg>
  );
}
