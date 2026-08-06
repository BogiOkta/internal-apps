"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AdministrativeGridShell,
  GridFilterCell,
  GridFilterRow,
  GridStateRows,
  nextGridSort,
  SortableGridHeader,
  type GridSort,
} from "@/components/admin-data-grid";
import { AdministrationPageBody } from "@/components/administration-page-body";
import { AdministrativeGridToolbar } from "@/components/administrative-grid-toolbar";
import { useAuth } from "@/components/auth-provider";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  formControlClassName,
  formDangerButtonClassName,
  formPrimaryButtonClassName,
  formSecondaryButtonClassName,
} from "@/components/form-field";
import { portalActionContent } from "@/components/portal-action-icon";
import { PortalNotification } from "@/components/portal-notification";
import { PortalNotificationHost } from "@/components/portal-notification-host";
import { StatusBadge } from "@/components/status-badge";
import { GridPagination } from "@/components/grid-pagination";
import { LeaveTypeForm } from "@/features/vacation/components/leave-type-form";
import { VacationWorkspace } from "@/features/vacation/components/vacation-workspace";
import { useTranslations } from "@/i18n/use-translations";
import { ApiError } from "@/services/auth";
import {
  activateLeaveType,
  createLeaveType,
  deactivateLeaveType,
  deleteLeaveType,
  getLeaveType,
  listLeaveTypes,
  updateLeaveType,
} from "@/services/vacation";
import type {
  CreateLeaveTypeRequest,
  LeaveType,
  LeaveTypeDetails,
  UpdateLeaveTypeRequest,
} from "@/types/vacation";
import { leaveTypesDeletePermission, leaveTypesManagePermission } from "@/types/vacation";
import {
  exportGridCsv,
  exportGridXlsx,
  type ExportColumn,
} from "@/utils/admin-grid-export";

type PanelMode = "details" | "create" | "edit";
type LeaveTypeSortField =
  | "code"
  | "name"
  | "balance"
  | "requiresBalance"
  | "approval"
  | "status";
type BooleanFilter = "all" | "yes" | "no";
type StatusFilter = "all" | "active" | "inactive";
type LeaveTypeFilters = {
  code: string;
  name: string;
  balance: BooleanFilter;
  requiresBalance: BooleanFilter;
  approval: BooleanFilter;
  status: StatusFilter;
};

const emptyFilters: LeaveTypeFilters = {
  code: "",
  name: "",
  balance: "all",
  requiresBalance: "all",
  approval: "all",
  status: "all",
};

const columnCount = 7;

export default function LeaveTypesPage() {
  const { accessToken, user } = useAuth();
  const { browserLocale, t } = useTranslations();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<GridSort<LeaveTypeSortField>>({
    field: "code",
    direction: "asc",
  });
  const [filters, setFilters] = useState<LeaveTypeFilters>(emptyFilters);
  const [areFiltersVisible, setAreFiltersVisible] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [exportError, setExportError] = useState(false);
  const [selectedPublicId, setSelectedPublicId] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("details");
  const [editLeaveType, setEditLeaveType] = useState<LeaveTypeDetails | null>(null);
  const [isPanelLoading, setIsPanelLoading] = useState(false);
  const [isStateChanging, setIsStateChanging] = useState(false);
  const [pendingActiveState, setPendingActiveState] = useState<boolean | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const canManage = user?.permissions.includes(leaveTypesManagePermission) ?? false;
  const canDelete = user?.permissions.includes(leaveTypesDeletePermission) ?? false;

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
      { search: debouncedSearch || undefined },
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
  }, [accessToken, browserLocale, debouncedSearch, refreshVersion]);

  const displayedLeaveTypes = useMemo(() => {
    const matchesBoolean = (value: boolean, filter: BooleanFilter) =>
      filter === "all" || value === (filter === "yes");
    const rows = leaveTypes.filter(
      (leaveType) =>
        leaveType.code
          .toLocaleLowerCase()
          .includes(filters.code.trim().toLocaleLowerCase()) &&
        leaveType.name
          .toLocaleLowerCase()
          .includes(filters.name.trim().toLocaleLowerCase()) &&
        matchesBoolean(leaveType.countsAgainstVacationBalance, filters.balance) &&
        matchesBoolean(leaveType.requiresBalance, filters.requiresBalance) &&
        matchesBoolean(leaveType.requiresApproval, filters.approval) &&
        (filters.status === "all" ||
          leaveType.isActive === (filters.status === "active")),
    );

    return [...rows].sort((left, right) => compareLeaveTypes(left, right, sort));
  }, [filters, leaveTypes, sort]);

  const totalPages = Math.max(1, Math.ceil(displayedLeaveTypes.length / pageSize));
  const visibleLeaveTypes = useMemo(
    () => displayedLeaveTypes.slice((page - 1) * pageSize, page * pageSize),
    [displayedLeaveTypes, page, pageSize],
  );
  const activeFilterCount = Object.values(filters).filter(
    (value) => value !== "" && value !== "all",
  ).length;
  const selectedLeaveType = useMemo(
    () =>
      displayedLeaveTypes.find(
        (leaveType) => leaveType.publicId === selectedPublicId,
      ) ?? null,
    [displayedLeaveTypes, selectedPublicId],
  );

  useEffect(() => setPage(1), [debouncedSearch, filters, sort, pageSize]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const exportColumns: ExportColumn<LeaveType>[] = [
    { heading: t("vacation.leaveTypes.code"), value: (row) => row.code, width: 22 },
    { heading: t("vacation.leaveTypes.name"), value: (row) => row.name, width: 28 },
    {
      heading: t("vacation.leaveTypes.exportDescription"),
      value: (row) => row.description ?? "",
      width: 36,
    },
    {
      heading: t("vacation.leaveTypes.calendarColor"),
      value: (row) => row.calendarColor ?? "",
      width: 16,
    },
    {
      heading: t("vacation.leaveTypes.balance"),
      value: (row) => yesNo(row.countsAgainstVacationBalance, t),
      width: 20,
    },
    {
      heading: t("vacation.leaveTypes.requiresBalance"),
      value: (row) => yesNo(row.requiresBalance, t),
      width: 20,
    },
    {
      heading: t("vacation.leaveTypes.approval"),
      value: (row) => yesNo(row.requiresApproval, t),
      width: 20,
    },
    {
      heading: t("vacation.leaveTypes.status"),
      value: (row) =>
        row.isActive
          ? t("vacation.leaveTypes.recordActive")
          : t("vacation.leaveTypes.recordInactive"),
      width: 14,
    },
    {
      heading: t("vacation.leaveTypes.displayOrder"),
      value: (row) => row.displayOrder,
      width: 16,
    },
  ];

  async function exportLeaveTypes(format: "csv" | "xlsx") {
    setExportError(false);
    if (displayedLeaveTypes.length === 0) {
      setExportError(true);
      return;
    }
    try {
      if (format === "csv") {
        exportGridCsv(displayedLeaveTypes, exportColumns, "leave-types.csv");
      } else {
        await exportGridXlsx(
          displayedLeaveTypes,
          exportColumns,
          "leave-types.xlsx",
          t("vacation.leaveTypes.exportSheet"),
        );
      }
    } catch {
      setExportError(true);
    }
  }

  function selectLeaveType(leaveType: LeaveType) {
    setSelectedPublicId(leaveType.publicId);
    setPanelMode("details");
    setEditLeaveType(null);
    setPendingActiveState(null);
    setIsConfirmingDelete(false);
    setOperationError(null);
  }

  function startCreate() {
    setPanelMode("create");
    setEditLeaveType(null);
    setPendingActiveState(null);
    setIsConfirmingDelete(false);
    setOperationError(null);
    setSuccessMessage(null);
  }

  async function startEdit() {
    if (!accessToken || !selectedLeaveType || !canManage) {
      return;
    }

    setIsPanelLoading(true);
    setOperationError(null);
    setSuccessMessage(null);
    try {
      const details = await getLeaveType(
        accessToken,
        browserLocale,
        selectedLeaveType.publicId,
      );
      setEditLeaveType(details);
      setPanelMode("edit");
    } catch (error) {
      setOperationError(
        error instanceof ApiError && error.status === 403
          ? t("vacation.leaveTypes.forbidden")
          : t("vacation.leaveTypes.loadDetailsFailed"),
      );
    } finally {
      setIsPanelLoading(false);
    }
  }

  async function saveCreate(request: CreateLeaveTypeRequest) {
    if (!accessToken) {
      throw new Error("Authentication is required.");
    }

    const created = await createLeaveType(accessToken, browserLocale, request);
    completeMutation(created, t("vacation.leaveTypes.createSuccess"));
  }

  async function saveUpdate(request: UpdateLeaveTypeRequest) {
    if (!accessToken || !editLeaveType) {
      throw new Error("A leave type must be selected.");
    }

    const updated = await updateLeaveType(
      accessToken,
      browserLocale,
      editLeaveType.publicId,
      request,
    );
    completeMutation(updated, t("vacation.leaveTypes.updateSuccess"));
  }

  async function confirmStateChange() {
    if (
      !accessToken ||
      !selectedLeaveType ||
      pendingActiveState === null ||
      !canManage
    ) {
      return;
    }

    setIsStateChanging(true);
    setOperationError(null);
    try {
      const updated = pendingActiveState
        ? await activateLeaveType(
            accessToken,
            browserLocale,
            selectedLeaveType.publicId,
          )
        : await deactivateLeaveType(
            accessToken,
            browserLocale,
            selectedLeaveType.publicId,
          );
      completeMutation(
        updated,
        pendingActiveState
          ? t("vacation.leaveTypes.activateSuccess")
          : t("vacation.leaveTypes.deactivateSuccess"),
      );
    } catch (error) {
      setOperationError(
        error instanceof ApiError && error.status === 403
          ? t("vacation.leaveTypes.forbidden")
          : t("vacation.leaveTypes.stateChangeFailed"),
      );
    } finally {
      setIsStateChanging(false);
    }
  }

  async function remove() {
    if (!accessToken || !selectedLeaveType || !canDelete || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setOperationError(null);
    try {
      await deleteLeaveType(accessToken, selectedLeaveType.publicId);
      setSelectedPublicId(null);
      setEditLeaveType(null);
      setPanelMode("details");
      setIsConfirmingDelete(false);
      setSuccessMessage(t("vacation.leaveTypes.deleteSuccess"));
      setRefreshVersion((version) => version + 1);
    } catch (error) {
      const problemCode =
        error instanceof ApiError ? error.problem?.code : undefined;
      setOperationError(
        problemCode === "leave_type_delete_conflict"
          ? t("vacation.leaveTypes.deleteReferenced")
          : problemCode === "leave_type_system_protected"
            ? t("vacation.leaveTypes.deleteSystemProtected")
          : error instanceof ApiError && error.status === 403
            ? t("vacation.leaveTypes.forbidden")
            : t("vacation.leaveTypes.deleteFailed"),
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function completeMutation(leaveType: LeaveTypeDetails, message: string) {
    setSelectedPublicId(leaveType.publicId);
    setPanelMode("details");
    setEditLeaveType(null);
    setPendingActiveState(null);
    setIsConfirmingDelete(false);
    setOperationError(null);
    setSuccessMessage(message);
    setRefreshVersion((version) => version + 1);
  }

  function cancelForm() {
    setPanelMode("details");
    setEditLeaveType(null);
    setOperationError(null);
  }

  return (
    <VacationWorkspace
      title={t("vacation.leaveTypes.title")}
      description={t("vacation.leaveTypes.description")}
      sectionActions={
        canManage && (
          <button
            type="button"
            onClick={startCreate}
            className={formPrimaryButtonClassName()}
          >
            {portalActionContent("create", t("vacation.leaveTypes.new"))}
          </button>
        )
      }
      sectionSecondaryActions={
        <button
          type="button"
          onClick={() => setRefreshVersion((version) => version + 1)}
          disabled={isLoading}
          className={formSecondaryButtonClassName()}
        >
          {portalActionContent(
            "refresh",
            isLoading
              ? t("vacation.leaveTypes.refreshing")
              : t("vacation.leaveTypes.refresh"),
          )}
        </button>
      }
      contentFillsViewport
    >
      <PortalNotificationHost>
        {successMessage ? (
          <PortalNotification
            variant="success"
            message={successMessage}
            dismissLabel={t("common.dismissNotification")}
            onDismiss={() => setSuccessMessage(null)}
          />
        ) : null}
        {operationError ? (
          <PortalNotification
            variant="error"
            message={operationError}
            dismissLabel={t("common.dismissNotification")}
            onDismiss={() => setOperationError(null)}
          />
        ) : null}
        {exportError ? (
          <PortalNotification
            variant="error"
            message={
              displayedLeaveTypes.length === 0
                ? t("grid.noExportRows")
                : t("grid.exportFailure")
            }
            dismissLabel={t("common.dismissNotification")}
            onDismiss={() => setExportError(false)}
          />
        ) : null}
      </PortalNotificationHost>
      <AdministrationPageBody>
        <AdministrativeGridShell
          ariaLabel={t("vacation.leaveTypes.tableLabel")}
          fillViewport
          toolbar={
            <AdministrativeGridToolbar
              search={search}
              searchLabel={t("vacation.leaveTypes.searchLabel")}
              searchPlaceholder={t("vacation.leaveTypes.searchPlaceholder")}
              onSearchChange={setSearch}
              activeFilterCount={activeFilterCount}
              areFiltersVisible={areFiltersVisible}
              exportDisabled={displayedLeaveTypes.length === 0}
              filtersLabel={t("grid.filters")}
              showFiltersLabel={t("grid.showFilters")}
              hideFiltersLabel={t("grid.hideFilters")}
              clearFiltersLabel={t("grid.clearFilters")}
              exportLabel={t("grid.export")}
              exportCsvLabel={t("grid.exportCsv")}
              exportExcelLabel={t("grid.exportExcel")}
              onToggleFilters={() =>
                setAreFiltersVisible((visible) => !visible)
              }
              onClearFilters={() => setFilters(emptyFilters)}
              onExportCsv={() => void exportLeaveTypes("csv")}
              onExportExcel={() => void exportLeaveTypes("xlsx")}
            />
          }
          viewport={
            <table
              aria-busy={isLoading}
              className="w-full min-w-[980px] border-collapse text-left text-sm"
            >
              <thead className="sticky top-0 z-10 border-b border-slate-300 bg-slate-100 text-xs font-semibold text-slate-600">
                <tr>
                  {(
                    [
                      ["code", t("vacation.leaveTypes.code")],
                      ["name", t("vacation.leaveTypes.name")],
                      ["balance", t("vacation.leaveTypes.balance")],
                      ["requiresBalance", t("vacation.leaveTypes.requiresBalance")],
                      ["approval", t("vacation.leaveTypes.approval")],
                      ["status", t("vacation.leaveTypes.status")],
                    ] as const
                  ).map(([field, label]) => (
                    <SortableGridHeader
                      key={field}
                      field={field}
                      label={label}
                      sort={sort}
                      sortAscendingLabel={t("grid.sortAscending", { column: label })}
                      sortDescendingLabel={t("grid.sortDescending", { column: label })}
                      clearSortingLabel={t("grid.clearSorting", { column: label })}
                      onSort={(sortField) =>
                        setSort((current) => nextGridSort(current, sortField))
                      }
                    />
                  ))}
                  <th scope="col" className="px-4 py-2">
                    {t("vacation.leaveTypes.actions")}
                  </th>
                </tr>
                <GridFilterRow visible={areFiltersVisible}>
                  <GridFilterCell>
                    <GridTextFilter
                      value={filters.code}
                      label={t("vacation.leaveTypes.codeFilter")}
                      onChange={(code) => setFilters({ ...filters, code })}
                    />
                  </GridFilterCell>
                  <GridFilterCell>
                    <GridTextFilter
                      value={filters.name}
                      label={t("vacation.leaveTypes.nameFilter")}
                      onChange={(name) => setFilters({ ...filters, name })}
                    />
                  </GridFilterCell>
                  <GridFilterCell>
                    <GridBooleanFilter
                      value={filters.balance}
                      label={t("vacation.leaveTypes.balanceFilter")}
                      onChange={(balance) => setFilters({ ...filters, balance })}
                    />
                  </GridFilterCell>
                  <GridFilterCell>
                    <GridBooleanFilter
                      value={filters.requiresBalance}
                      label={t("vacation.leaveTypes.requiresBalanceFilter")}
                      onChange={(requiresBalance) =>
                        setFilters({ ...filters, requiresBalance })
                      }
                    />
                  </GridFilterCell>
                  <GridFilterCell>
                    <GridBooleanFilter
                      value={filters.approval}
                      label={t("vacation.leaveTypes.approvalFilter")}
                      onChange={(approval) => setFilters({ ...filters, approval })}
                    />
                  </GridFilterCell>
                  <GridFilterCell>
                    <label>
                      <span className="sr-only">
                        {t("vacation.leaveTypes.statusFilter")}
                      </span>
                      <select
                        value={filters.status}
                        onChange={(event) =>
                          setFilters({
                            ...filters,
                            status: event.target.value as StatusFilter,
                          })
                        }
                        className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
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
                  </GridFilterCell>
                  <GridFilterCell />
                </GridFilterRow>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {hasError && (
                  <tr>
                    <td
                      colSpan={columnCount}
                      className="px-4 py-10 text-center text-red-700"
                    >
                      {t("vacation.leaveTypes.error")}
                    </td>
                  </tr>
                )}
                <GridStateRows
                  columnCount={columnCount}
                  isLoading={isLoading}
                  hasError={hasError}
                  isEmpty={displayedLeaveTypes.length === 0}
                  loadingLabel={t("vacation.leaveTypes.loading")}
                  emptyTitle={t("vacation.leaveTypes.emptyTitle")}
                  emptyDescription={t("vacation.leaveTypes.emptyDescription")}
                />
                {!isLoading &&
                  !hasError &&
                  visibleLeaveTypes.map((leaveType) => {
                    const isSelected = leaveType.publicId === selectedPublicId;

                    return (
                      <tr
                        key={leaveType.publicId}
                        aria-selected={isSelected}
                        onClick={() => selectLeaveType(leaveType)}
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
                              selectLeaveType(leaveType);
                            }}
                            className="rounded-sm text-left font-semibold text-slate-950 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                          >
                            {leaveType.name}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <YesNoBadge value={leaveType.countsAgainstVacationBalance} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <YesNoBadge value={leaveType.requiresBalance} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <YesNoBadge value={leaveType.requiresApproval} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <ActiveStatusBadge isActive={leaveType.isActive} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              selectLeaveType(leaveType);
                            }}
                            className="rounded-sm text-sm font-medium text-blue-700 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                          >
                            {t("vacation.leaveTypes.details")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          }
          pagination={
            <GridPagination
              page={page}
              pageSize={pageSize}
              totalCount={displayedLeaveTypes.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              labels={{
                range: (from, to, total) =>
                  t("grid.visibleRange", { from, to, total }),
                pageSize: t("grid.pageSize"),
                first: t("grid.firstPage"),
                previous: t("grid.previousPage"),
                next: t("grid.nextPage"),
                last: t("grid.lastPage"),
              }}
            />
          }
          detailsPanel={
            <div aria-label={t("vacation.leaveTypes.detailsLabel")}>
              <h2 className="mb-4 text-lg font-semibold text-slate-950">
                {panelMode === "create"
                  ? t("vacation.leaveTypes.createTitle")
                  : panelMode === "edit"
                    ? t("vacation.leaveTypes.editTitle")
                    : t("vacation.leaveTypes.details")}
              </h2>

              {panelMode === "create" ? (
                <LeaveTypeForm
                  mode="create"
                  onCancel={cancelForm}
                  onCreate={saveCreate}
                  onUpdate={saveUpdate}
                />
              ) : panelMode === "edit" && editLeaveType ? (
                <LeaveTypeForm
                  mode="edit"
                  leaveType={editLeaveType}
                  onCancel={cancelForm}
                  onCreate={saveCreate}
                  onUpdate={saveUpdate}
                />
              ) : panelMode === "edit" ? (
                <p role="status" className="text-sm text-slate-500">
                  {t("vacation.leaveTypes.loadingDetails")}
                </p>
              ) : selectedLeaveType ? (
                <div className="space-y-4 text-sm">
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">
                      {selectedLeaveType.name}
                    </h3>
                    <p className="mt-1 font-mono text-xs font-semibold text-slate-500">
                      {selectedLeaveType.code}
                    </p>
                  </div>

                  <p className="leading-6 text-slate-600">
                    {selectedLeaveType.description ??
                      t("vacation.leaveTypes.noDescription")}
                  </p>

                  <dl className="space-y-3">
                    <Detail
                      label={t("vacation.leaveTypes.calendarColor")}
                      value={
                        selectedLeaveType.calendarColor ? (
                          <span className="inline-flex items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="h-4 w-4 rounded border border-slate-300"
                              style={{
                                backgroundColor: selectedLeaveType.calendarColor,
                              }}
                            />
                            <span>{selectedLeaveType.calendarColor}</span>
                          </span>
                        ) : (
                          t("vacation.leaveTypes.notSet")
                        )
                      }
                    />
                    <Detail
                      label={t("vacation.leaveTypes.balance")}
                      value={yesNo(
                        selectedLeaveType.countsAgainstVacationBalance,
                        t,
                      )}
                    />
                    <Detail
                      label={t("vacation.leaveTypes.requiresBalance")}
                      value={yesNo(selectedLeaveType.requiresBalance, t)}
                    />
                    <Detail
                      label={t("vacation.leaveTypes.approval")}
                      value={yesNo(selectedLeaveType.requiresApproval, t)}
                    />
                    <Detail
                      label={t("vacation.leaveTypes.status")}
                      value={
                        selectedLeaveType.isActive
                          ? t("vacation.leaveTypes.recordActive")
                          : t("vacation.leaveTypes.recordInactive")
                      }
                    />
                    <Detail
                      label={t("vacation.leaveTypes.displayOrder")}
                      value={String(selectedLeaveType.displayOrder)}
                    />
                    <Detail
                      label={t("vacation.leaveTypes.usage")}
                      value={
                        selectedLeaveType.isInUse
                          ? t("vacation.leaveTypes.usageInUse")
                          : t("vacation.leaveTypes.usageUnused")
                      }
                    />
                  </dl>

                  {(canManage || canDelete) && (
                    <div className="space-y-3 border-t border-slate-200 pt-3">
                      <div className="flex flex-wrap gap-2">
                        {canManage && (
                          <>
                        <button
                          type="button"
                          disabled={isPanelLoading || isStateChanging || isDeleting}
                          onClick={() => void startEdit()}
                          className={formPrimaryButtonClassName()}
                        >
                          {isPanelLoading
                            ? t("vacation.leaveTypes.loadingDetails")
                            : t("vacation.leaveTypes.edit")}
                        </button>
                        <button
                          type="button"
                          disabled={isStateChanging || isDeleting}
                          onClick={() => {
                            setIsConfirmingDelete(false);
                            setPendingActiveState(!selectedLeaveType.isActive);
                          }}
                          className={formSecondaryButtonClassName()}
                        >
                          {selectedLeaveType.isActive
                            ? t("vacation.leaveTypes.deactivate")
                            : t("vacation.leaveTypes.activate")}
                        </button>
                          </>
                        )}
                        {canDelete && (
                        <button
                          type="button"
                          disabled={isStateChanging || isDeleting}
                          onClick={() => {
                            setPendingActiveState(null);
                            setIsConfirmingDelete(true);
                          }}
                          className={formDangerButtonClassName()}
                        >
                          {t("vacation.leaveTypes.delete")}
                        </button>
                        )}
                      </div>

                      {canManage && pendingActiveState !== null && (
                        <ConfirmDialog
                          message={
                            pendingActiveState
                              ? t("vacation.leaveTypes.activateConfirmation")
                              : t("vacation.leaveTypes.deactivateConfirmation")
                          }
                          confirmLabel={
                            isStateChanging
                              ? pendingActiveState
                                ? t("vacation.leaveTypes.activating")
                                : t("vacation.leaveTypes.deactivating")
                              : t("vacation.leaveTypes.confirm")
                          }
                          cancelLabel={t("vacation.leaveTypes.cancel")}
                          pending={isStateChanging}
                          onConfirm={() => void confirmStateChange()}
                          onCancel={() => setPendingActiveState(null)}
                        />
                      )}

                      {canDelete && isConfirmingDelete && (
                        <ConfirmDialog
                          destructive
                          message={t("vacation.leaveTypes.deleteConfirmation")}
                          confirmLabel={
                            isDeleting
                              ? t("vacation.leaveTypes.deleting")
                              : t("vacation.leaveTypes.delete")
                          }
                          cancelLabel={t("vacation.leaveTypes.cancel")}
                          pending={isDeleting}
                          onConfirm={() => void remove()}
                          onCancel={() => setIsConfirmingDelete(false)}
                        />
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  {t("vacation.leaveTypes.selectForDetails")}
                </p>
              )}
            </div>
          }
        />
      </AdministrationPageBody>
    </VacationWorkspace>
  );
}

function yesNo(value: boolean, t: ReturnType<typeof useTranslations>["t"]) {
  return value ? t("vacation.leaveTypes.yes") : t("vacation.leaveTypes.no");
}

function GridTextFilter({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${formControlClassName()} min-h-9 min-w-28 px-2`}
      />
    </label>
  );
}

function GridBooleanFilter({
  value,
  label,
  onChange,
}: {
  value: BooleanFilter;
  label: string;
  onChange: (value: BooleanFilter) => void;
}) {
  const { t } = useTranslations();
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as BooleanFilter)}
        className="min-h-9 w-full min-w-24 rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
      >
        <option value="all">{t("vacation.leaveTypes.filterAll")}</option>
        <option value="yes">{t("vacation.leaveTypes.yes")}</option>
        <option value="no">{t("vacation.leaveTypes.no")}</option>
      </select>
    </label>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function YesNoBadge({ value }: { value: boolean }) {
  const { t } = useTranslations();

  return (
    <StatusBadge
      tone={value ? "positive" : "inactive"}
      label={value ? t("vacation.leaveTypes.yes") : t("vacation.leaveTypes.no")}
    />
  );
}

function ActiveStatusBadge({ isActive }: { isActive: boolean }) {
  const { t } = useTranslations();

  return (
    <StatusBadge
      tone={isActive ? "active" : "inactive"}
      label={
        isActive
          ? t("vacation.leaveTypes.recordActive")
          : t("vacation.leaveTypes.recordInactive")
      }
    />
  );
}

function compareLeaveTypes(
  left: LeaveType,
  right: LeaveType,
  sort: GridSort<LeaveTypeSortField>,
) {
  const activeSort = sort ?? { field: "code" as const, direction: "asc" as const };
  const value = (leaveType: LeaveType): string | number | boolean =>
    ({
      code: leaveType.code.toLocaleLowerCase(),
      name: leaveType.name.toLocaleLowerCase(),
      balance: leaveType.countsAgainstVacationBalance,
      requiresBalance: leaveType.requiresBalance,
      approval: leaveType.requiresApproval,
      status: leaveType.isActive,
    })[activeSort.field];

  const leftValue = value(left);
  const rightValue = value(right);
  const comparison =
    typeof leftValue === "string" && typeof rightValue === "string"
      ? leftValue.localeCompare(rightValue, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      : leftValue < rightValue
        ? -1
        : leftValue > rightValue
          ? 1
          : 0;
  const ordered = activeSort.direction === "desc" ? -comparison : comparison;
  return (
    ordered ||
    left.displayOrder - right.displayOrder ||
    left.code.localeCompare(right.code, undefined, {
      numeric: true,
      sensitivity: "base",
    }) ||
    left.publicId.localeCompare(right.publicId)
  );
}
