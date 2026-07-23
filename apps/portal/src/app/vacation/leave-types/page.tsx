"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GridFilterCell,
  GridFilterRow,
  GridFooter,
  GridStateRows,
  GridToolbarActions,
  nextGridSort,
  SortableGridHeader,
  type GridSort,
} from "@/components/admin-data-grid";
import { useAuth } from "@/components/auth-provider";
import { LeaveTypeForm } from "@/features/vacation/components/leave-type-form";
import { VacationWorkspace } from "@/features/vacation/components/vacation-workspace";
import { useTranslations } from "@/i18n/use-translations";
import { ApiError } from "@/services/auth";
import {
  activateLeaveType,
  createLeaveType,
  deactivateLeaveType,
  getLeaveType,
  listLeaveTypes,
  updateLeaveType,
} from "@/services/vacation";
import type {
  CreateLeaveTypeRequest,
  LeaveType,
  LeaveTypeDetails,
  LeaveTypeSortField,
  UpdateLeaveTypeRequest,
} from "@/types/vacation";
import { leaveTypesManagePermission } from "@/types/vacation";
import {
  exportGridCsv,
  exportGridXlsx,
  type ExportColumn,
} from "@/utils/admin-grid-export";

type PanelMode = "details" | "create" | "edit";
type LeaveTypeGridSortField =
  | LeaveTypeSortField
  | "balance"
  | "approval";
type BooleanFilter = "all" | "yes" | "no";
type StatusFilter = "all" | "active" | "inactive";
type LeaveTypeFilters = {
  code: string;
  name: string;
  balance: BooleanFilter;
  approval: BooleanFilter;
  status: StatusFilter;
  displayOrder: string;
};
const emptyFilters: LeaveTypeFilters = {
  code: "",
  name: "",
  balance: "all",
  approval: "all",
  status: "all",
  displayOrder: "",
};

export default function LeaveTypesPage() {
  const { accessToken, user } = useAuth();
  const { browserLocale, t } = useTranslations();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<GridSort<LeaveTypeGridSortField>>(null);
  const [filters, setFilters] = useState<LeaveTypeFilters>(emptyFilters);
  const [areFiltersVisible, setAreFiltersVisible] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [selectedPublicId, setSelectedPublicId] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("details");
  const [editLeaveType, setEditLeaveType] =
    useState<LeaveTypeDetails | null>(null);
  const [isPanelLoading, setIsPanelLoading] = useState(false);
  const [isStateChanging, setIsStateChanging] = useState(false);
  const [pendingActiveState, setPendingActiveState] = useState<boolean | null>(
    null,
  );
  const [operationError, setOperationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const canManage =
    user?.permissions.includes(leaveTypesManagePermission) ?? false;

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
  ]);

  const displayedLeaveTypes = useMemo(() => {
    const matchesBoolean = (value: boolean, filter: BooleanFilter) =>
      filter === "all" || value === (filter === "yes");
    const rows = leaveTypes.filter((leaveType) => {
      const order = filters.displayOrder.trim();
      return (
        leaveType.code.toLocaleLowerCase().includes(filters.code.trim().toLocaleLowerCase()) &&
        leaveType.name.toLocaleLowerCase().includes(filters.name.trim().toLocaleLowerCase()) &&
        matchesBoolean(leaveType.countsAgainstVacationBalance, filters.balance) &&
        matchesBoolean(leaveType.requiresApproval, filters.approval) &&
        (filters.status === "all" ||
          leaveType.isActive === (filters.status === "active")) &&
        (order === "" || leaveType.displayOrder === Number(order))
      );
    });
    if (!sort) {
      return rows;
    }
    const direction = sort.direction === "asc" ? 1 : -1;
    const value = (row: LeaveType): string | number | boolean => {
      switch (sort.field) {
        case "code": return row.code.toLocaleLowerCase();
        case "name": return row.name.toLocaleLowerCase();
        case "balance": return row.countsAgainstVacationBalance;
        case "approval": return row.requiresApproval;
        case "status": return row.isActive;
        default: return row.displayOrder;
      }
    };
    return [...rows].sort((left, right) => {
      const a = value(left);
      const b = value(right);
      const comparison = a < b ? -1 : a > b ? 1 : 0;
      return comparison !== 0
        ? comparison * direction
        : left.publicId.localeCompare(right.publicId);
    });
  }, [filters, leaveTypes, sort]);

  const activeFilterCount = Object.values(filters).filter(
    (value) => value !== "" && value !== "all",
  ).length;

  const selectedLeaveType = useMemo(
    () =>
      displayedLeaveTypes.find((leaveType) => leaveType.publicId === selectedPublicId) ??
      null,
    [displayedLeaveTypes, selectedPublicId],
  );

  const exportColumns: ExportColumn<LeaveType>[] = [
    { heading: t("vacation.leaveTypes.code"), value: (row) => row.code, width: 22 },
    { heading: t("vacation.leaveTypes.name"), value: (row) => row.name, width: 28 },
    { heading: t("vacation.leaveTypes.exportDescription"), value: (row) => row.description ?? "", width: 36 },
    { heading: t("vacation.leaveTypes.calendarColor"), value: (row) => row.calendarColor ?? "", width: 16 },
    { heading: t("vacation.leaveTypes.balance"), value: (row) => row.countsAgainstVacationBalance ? t("vacation.leaveTypes.yes") : t("vacation.leaveTypes.no"), width: 20 },
    { heading: t("vacation.leaveTypes.approval"), value: (row) => row.requiresApproval ? t("vacation.leaveTypes.yes") : t("vacation.leaveTypes.no"), width: 20 },
    { heading: t("vacation.leaveTypes.status"), value: (row) => row.isActive ? t("vacation.leaveTypes.recordActive") : t("vacation.leaveTypes.recordInactive"), width: 14 },
    { heading: t("vacation.leaveTypes.displayOrder"), value: (row) => row.displayOrder, width: 16 },
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
        await exportGridXlsx(displayedLeaveTypes, exportColumns, "leave-types.xlsx", t("vacation.leaveTypes.exportSheet"));
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
    setOperationError(null);
  }

  function startCreate() {
    setPanelMode("create");
    setEditLeaveType(null);
    setPendingActiveState(null);
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

    const created = await createLeaveType(
      accessToken,
      browserLocale,
      request,
    );
    completeMutation(
      created,
      t("vacation.leaveTypes.createSuccess"),
    );
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
    completeMutation(
      updated,
      t("vacation.leaveTypes.updateSuccess"),
    );
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

  function completeMutation(
    leaveType: LeaveTypeDetails,
    message: string,
  ) {
    setSelectedPublicId(leaveType.publicId);
    setPanelMode("details");
    setEditLeaveType(null);
    setPendingActiveState(null);
    setOperationError(null);
    setSuccessMessage(message);
    setRefreshVersion((version) => version + 1);
    window.requestAnimationFrame(() => {
      document.getElementById("leave-type-panel-heading")?.focus();
    });
  }

  function cancelForm() {
    const focusTargetId =
      panelMode === "create" ? "leave-types-new" : "leave-types-edit";
    setPanelMode("details");
    setEditLeaveType(null);
    setOperationError(null);
    window.requestAnimationFrame(() => {
      document.getElementById(focusTargetId)?.focus();
    });
  }

  return (
    <VacationWorkspace
      title={t("vacation.leaveTypes.title")}
      description={t("vacation.leaveTypes.description")}
      commandBar={
        <LeaveTypesCommandBar
          canManage={canManage}
          isRefreshing={isLoading}
          search={search}
          activeFilterCount={activeFilterCount}
          areFiltersVisible={areFiltersVisible}
          exportDisabled={displayedLeaveTypes.length === 0}
          onClearFilters={() => setFilters(emptyFilters)}
          onExportCsv={() => void exportLeaveTypes("csv")}
          onExportExcel={() => void exportLeaveTypes("xlsx")}
          onNew={startCreate}
          onRefresh={() => setRefreshVersion((version) => version + 1)}
          onSearchChange={setSearch}
          onToggleFilters={() => setAreFiltersVisible((visible) => !visible)}
        />
      }
    >
      <div className="space-y-3">
        {successMessage && (
          <div
            role="status"
            className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            {successMessage}
          </div>
        )}
        {operationError && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {operationError}
          </div>
        )}
        {hasError && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {t("vacation.leaveTypes.error")}
          </div>
        )}
        {exportError && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {displayedLeaveTypes.length === 0 ? t("grid.noExportRows") : t("grid.exportFailure")}
          </div>
        )}

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <LeaveTypesTable
            hasError={hasError}
            isLoading={isLoading}
            leaveTypes={displayedLeaveTypes}
            sort={sort}
            filters={filters}
            areFiltersVisible={areFiltersVisible}
            selectedPublicId={selectedPublicId}
            onFiltersChange={setFilters}
            onSort={(field) => setSort((current) => nextGridSort(current, field))}
            onSelect={selectLeaveType}
          />
          <LeaveTypePanel
            canManage={canManage}
            editLeaveType={editLeaveType}
            isPanelLoading={isPanelLoading}
            isStateChanging={isStateChanging}
            leaveType={selectedLeaveType}
            mode={panelMode}
            pendingActiveState={pendingActiveState}
            onCancel={cancelForm}
            onConfirmStateChange={confirmStateChange}
            onCreate={saveCreate}
            onEdit={startEdit}
            onRequestStateChange={setPendingActiveState}
            onUpdate={saveUpdate}
          />
        </div>
      </div>
    </VacationWorkspace>
  );
}

function LeaveTypesCommandBar({
  canManage,
  isRefreshing,
  search,
  activeFilterCount,
  areFiltersVisible,
  exportDisabled,
  onClearFilters,
  onExportCsv,
  onExportExcel,
  onNew,
  onRefresh,
  onSearchChange,
  onToggleFilters,
}: {
  canManage: boolean;
  isRefreshing: boolean;
  search: string;
  activeFilterCount: number;
  areFiltersVisible: boolean;
  exportDisabled: boolean;
  onClearFilters: () => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
  onNew: () => void;
  onRefresh: () => void;
  onSearchChange: (value: string) => void;
  onToggleFilters: () => void;
}) {
  const { t } = useTranslations();

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      {canManage && (
        <button
          id="leave-types-new"
          type="button"
          onClick={onNew}
          className="inline-flex min-h-9 items-center rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        >
          {t("vacation.leaveTypes.new")}
        </button>
      )}
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

        <GridToolbarActions activeFilterCount={activeFilterCount} areFiltersVisible={areFiltersVisible} exportDisabled={exportDisabled} filtersLabel={t("grid.filters")} showFiltersLabel={t("grid.showFilters")} hideFiltersLabel={t("grid.hideFilters")} clearFiltersLabel={t("grid.clearFilters")} exportLabel={t("grid.export")} exportCsvLabel={t("grid.exportCsv")} exportExcelLabel={t("grid.exportExcel")} onToggleFilters={onToggleFilters} onClearFilters={onClearFilters} onExportCsv={onExportCsv} onExportExcel={onExportExcel} />
      </div>
    </div>
  );
}

function LeaveTypesTable({
  hasError,
  isLoading,
  leaveTypes,
  sort,
  filters,
  areFiltersVisible,
  selectedPublicId,
  onFiltersChange,
  onSort,
  onSelect,
}: {
  hasError: boolean;
  isLoading: boolean;
  leaveTypes: LeaveType[];
  sort: GridSort<LeaveTypeGridSortField>;
  filters: LeaveTypeFilters;
  areFiltersVisible: boolean;
  selectedPublicId: string | null;
  onFiltersChange: (filters: LeaveTypeFilters) => void;
  onSort: (field: LeaveTypeGridSortField) => void;
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
              {(["code", "name", "balance", "approval", "status", "displayOrder"] as const).map((field) => {
                const label = t(
                  field === "balance"
                    ? "vacation.leaveTypes.balance"
                    : field === "approval"
                      ? "vacation.leaveTypes.approval"
                      : field === "displayOrder"
                        ? "vacation.leaveTypes.displayOrder"
                        : `vacation.leaveTypes.${field}`,
                );
                return (
                  <SortableGridHeader key={field} field={field} label={label} sort={sort} sortAscendingLabel={t("grid.sortAscending", { column: label })} sortDescendingLabel={t("grid.sortDescending", { column: label })} clearSortingLabel={t("grid.clearSorting", { column: label })} onSort={onSort} />
                );
              })}
            </tr>
            <GridFilterRow visible={areFiltersVisible}>
              <GridFilterCell><GridTextFilter value={filters.code} label={t("vacation.leaveTypes.codeFilter")} onChange={(code) => onFiltersChange({ ...filters, code })} /></GridFilterCell>
              <GridFilterCell><GridTextFilter value={filters.name} label={t("vacation.leaveTypes.nameFilter")} onChange={(name) => onFiltersChange({ ...filters, name })} /></GridFilterCell>
              <GridFilterCell><GridBooleanFilter value={filters.balance} label={t("vacation.leaveTypes.balanceFilter")} onChange={(balance) => onFiltersChange({ ...filters, balance })} /></GridFilterCell>
              <GridFilterCell><GridBooleanFilter value={filters.approval} label={t("vacation.leaveTypes.approvalFilter")} onChange={(approval) => onFiltersChange({ ...filters, approval })} /></GridFilterCell>
              <GridFilterCell>
                <label><span className="sr-only">{t("vacation.leaveTypes.statusFilter")}</span><select value={filters.status} onChange={(event) => onFiltersChange({ ...filters, status: event.target.value as StatusFilter })} className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"><option value="all">{t("vacation.leaveTypes.filterAll")}</option><option value="active">{t("vacation.leaveTypes.filterActive")}</option><option value="inactive">{t("vacation.leaveTypes.filterInactive")}</option></select></label>
              </GridFilterCell>
              <GridFilterCell><label><span className="sr-only">{t("vacation.leaveTypes.displayOrderFilter")}</span><input type="number" min="0" value={filters.displayOrder} onChange={(event) => onFiltersChange({ ...filters, displayOrder: event.target.value })} className="min-h-9 w-full min-w-24 rounded-md border border-slate-300 px-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label></GridFilterCell>
            </GridFilterRow>
          </thead>
          <tbody className="divide-y divide-slate-200">
            <GridStateRows columnCount={6} isLoading={isLoading} hasError={hasError} isEmpty={leaveTypes.length === 0} loadingLabel={t("vacation.leaveTypes.loading")} emptyTitle={t("vacation.leaveTypes.emptyTitle")} emptyDescription={t("vacation.leaveTypes.emptyDescription")} />

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
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {leaveType.displayOrder}
                  </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <GridFooter countLabel={t("vacation.leaveTypes.records", { count: leaveTypes.length })} selectionLabel={selected ? t("vacation.leaveTypes.selected", { name: selected.name }) : t("vacation.leaveTypes.selectionHint")} />
    </section>
  );
}

function GridTextFilter({ value, label, onChange }: { value: string; label: string; onChange: (value: string) => void }) {
  return <label><span className="sr-only">{label}</span><input type="search" value={value} onChange={(event) => onChange(event.target.value)} className="min-h-9 w-full min-w-28 rounded-md border border-slate-300 px-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>;
}

function GridBooleanFilter({ value, label, onChange }: { value: BooleanFilter; label: string; onChange: (value: BooleanFilter) => void }) {
  const { t } = useTranslations();
  return <label><span className="sr-only">{label}</span><select value={value} onChange={(event) => onChange(event.target.value as BooleanFilter)} className="min-h-9 w-full min-w-24 rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"><option value="all">{t("vacation.leaveTypes.filterAll")}</option><option value="yes">{t("vacation.leaveTypes.yes")}</option><option value="no">{t("vacation.leaveTypes.no")}</option></select></label>;
}

function LeaveTypePanel({
  canManage,
  editLeaveType,
  isPanelLoading,
  isStateChanging,
  leaveType,
  mode,
  pendingActiveState,
  onCancel,
  onConfirmStateChange,
  onCreate,
  onEdit,
  onRequestStateChange,
  onUpdate,
}: {
  canManage: boolean;
  editLeaveType: LeaveTypeDetails | null;
  isPanelLoading: boolean;
  isStateChanging: boolean;
  leaveType: LeaveType | null;
  mode: PanelMode;
  pendingActiveState: boolean | null;
  onCancel: () => void;
  onConfirmStateChange: () => Promise<void>;
  onCreate: (request: CreateLeaveTypeRequest) => Promise<void>;
  onEdit: () => Promise<void>;
  onRequestStateChange: (isActive: boolean | null) => void;
  onUpdate: (request: UpdateLeaveTypeRequest) => Promise<void>;
}) {
  const { t } = useTranslations();
  const title =
    mode === "create"
      ? t("vacation.leaveTypes.createTitle")
      : mode === "edit"
        ? t("vacation.leaveTypes.editTitle")
        : t("vacation.leaveTypes.details");

  return (
    <aside
      aria-label={t("vacation.leaveTypes.detailsLabel")}
      className="max-h-[calc(100vh-10rem)] self-start overflow-y-auto rounded-lg border border-slate-300 bg-white shadow-sm"
    >
      <div className="border-b border-slate-200 px-4 py-3">
        <h2
          id="leave-type-panel-heading"
          tabIndex={-1}
          className="text-sm font-semibold text-slate-950 outline-none"
        >
          {title}
        </h2>
      </div>

      {mode === "create" && (
        <LeaveTypeForm
          mode="create"
          onCancel={onCancel}
          onCreate={onCreate}
          onUpdate={onUpdate}
        />
      )}

      {mode === "edit" && editLeaveType && (
        <LeaveTypeForm
          mode="edit"
          leaveType={editLeaveType}
          onCancel={onCancel}
          onCreate={onCreate}
          onUpdate={onUpdate}
        />
      )}

      {mode === "edit" && isPanelLoading && (
        <p role="status" className="px-4 py-8 text-sm text-slate-500">
          {t("vacation.leaveTypes.loadingDetails")}
        </p>
      )}

      {mode === "details" && !leaveType ? (
        <p className="px-4 py-8 text-sm leading-6 text-slate-500">
          {t("vacation.leaveTypes.selectForDetails")}
        </p>
      ) : mode === "details" && leaveType ? (
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

          {canManage && (
            <div className="space-y-3 border-t border-slate-200 pt-3">
              <div className="flex flex-wrap gap-2">
                <button
                  id="leave-types-edit"
                  type="button"
                  disabled={isPanelLoading || isStateChanging}
                  onClick={() => void onEdit()}
                  className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50"
                >
                  {isPanelLoading
                    ? t("vacation.leaveTypes.loadingDetails")
                    : t("vacation.leaveTypes.edit")}
                </button>
                <button
                  id="leave-types-state-action"
                  type="button"
                  disabled={isStateChanging}
                  onClick={() =>
                    onRequestStateChange(!leaveType.isActive)
                  }
                  className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50"
                >
                  {leaveType.isActive
                    ? t("vacation.leaveTypes.deactivate")
                    : t("vacation.leaveTypes.activate")}
                </button>
              </div>

              {pendingActiveState !== null && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm text-amber-900">
                    {pendingActiveState
                      ? t("vacation.leaveTypes.activateConfirmation")
                      : t("vacation.leaveTypes.deactivateConfirmation")}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={isStateChanging}
                      onClick={() => void onConfirmStateChange()}
                      className="min-h-9 rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-60"
                    >
                      {isStateChanging
                        ? pendingActiveState
                          ? t("vacation.leaveTypes.activating")
                          : t("vacation.leaveTypes.deactivating")
                        : t("vacation.leaveTypes.confirm")}
                    </button>
                    <button
                      type="button"
                      disabled={isStateChanging}
                      onClick={() => onRequestStateChange(null)}
                      className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-60"
                    >
                      {t("vacation.leaveTypes.cancel")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
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
