"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
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
import { OrganizationWorkspace } from "@/features/organization/components/organization-workspace";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  formDangerButtonClassName,
  formPrimaryButtonClassName,
  formSecondaryButtonClassName,
} from "@/components/form-field";
import { portalActionContent } from "@/components/portal-action-icon";
import { PortalNotification } from "@/components/portal-notification";
import { PortalNotificationHost } from "@/components/portal-notification-host";
import { GridPagination } from "@/components/grid-pagination";
import { StatusBadge } from "@/components/status-badge";
import { DepartmentForm } from "@/features/organization/components/department-form";
import { useTranslations } from "@/i18n/use-translations";
import {
  activateDepartment,
  createDepartment,
  deactivateDepartment,
  deleteDepartment,
  getDepartments,
  updateDepartment,
} from "@/services/organization";
import type {
  CreateDepartmentRequest,
  Department,
  DepartmentStatusFilter,
  UpdateDepartmentRequest,
} from "@/types/organization";
import { departmentsManagePermission } from "@/types/organization";
import { exportGridCsv, exportGridXlsx, type ExportColumn } from "@/utils/admin-grid-export";

type DepartmentSortField = "code" | "name" | "status";

export default function DepartmentsPage() {
  const { accessToken, user } = useAuth();
  const { t } = useTranslations();
  const [departmentResult, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<DepartmentStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState<GridSort<DepartmentSortField>>({ field: "code", direction: "asc" });
  const [areFiltersVisible, setAreFiltersVisible] = useState(false);
  const [panelMode, setPanelMode] = useState<"details" | "create" | "edit">("details");
  const [selectedDepartmentPublicId, setSelectedDepartmentPublicId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [isConfirmingStatus, setIsConfirmingStatus] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    setIsLoading(true);
    setHasError(false);
    getDepartments(accessToken, { search: debouncedSearch || undefined, status }, controller.signal)
      .then((result) => {
        setDepartments(result);
        setSelectedDepartmentPublicId((currentSelection) =>
          currentSelection && result.some((department) => department.publicId === currentSelection)
            ? currentSelection
            : null,
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setDepartments([]);
          setSelectedDepartmentPublicId(null);
          setHasError(true);
        }
      })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    return () => controller.abort();
  }, [accessToken, debouncedSearch, status, refreshVersion]);

  const departments = useMemo(
    () => [...departmentResult].sort((left, right) => compareDepartments(left, right, sort)),
    [departmentResult, sort],
  );
  const totalPages = Math.max(1, Math.ceil(departments.length / pageSize));
  const visibleDepartments = useMemo(
    () => departments.slice((page - 1) * pageSize, page * pageSize),
    [departments, page, pageSize],
  );
  const selectedDepartment = useMemo(
    () => departments.find((department) => department.publicId === selectedDepartmentPublicId) ?? null,
    [departments, selectedDepartmentPublicId],
  );
  const canManage = user?.permissions.includes(departmentsManagePermission) ?? false;
  const activeFilterCount = status === "all" ? 0 : 1;

  useEffect(() => setPage(1), [debouncedSearch, status, sort, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  async function create(request: CreateDepartmentRequest) {
    if (!accessToken) return;
    const department = await createDepartment(accessToken, request);
    setSelectedDepartmentPublicId(department.publicId);
    setPanelMode("details");
    setFeedback(t("organization.departments.createSuccess"));
    setRefreshVersion((value) => value + 1);
  }

  async function update(request: UpdateDepartmentRequest) {
    if (!accessToken || !selectedDepartment) return;
    await updateDepartment(accessToken, selectedDepartment.publicId, request);
    setPanelMode("details");
    setFeedback(t("organization.departments.updateSuccess"));
    setRefreshVersion((value) => value + 1);
  }

  async function changeStatus() {
    if (!accessToken || !selectedDepartment) return;
    setWriteError(null);
    try {
      if (selectedDepartment.isActive) {
        await deactivateDepartment(accessToken, selectedDepartment.publicId);
      } else {
        await activateDepartment(accessToken, selectedDepartment.publicId);
      }
      setFeedback(selectedDepartment.isActive
        ? t("organization.departments.deactivateSuccess")
        : t("organization.departments.activateSuccess"));
      setIsConfirmingStatus(false);
      setRefreshVersion((value) => value + 1);
    } catch {
      setWriteError(t("organization.departments.saveFailed"));
    }
  }

  async function remove() {
    if (!accessToken || !selectedDepartment || isDeleting) return;
    setWriteError(null);
    setIsDeleting(true);
    try {
      await deleteDepartment(accessToken, selectedDepartment.publicId);
      setSelectedDepartmentPublicId(null);
      setPanelMode("details");
      setIsConfirmingDelete(false);
      setFeedback(t("organization.departments.deleteSuccess"));
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      const code = error instanceof Error && "problem" in error
        ? (error as { problem?: { code?: string } }).problem?.code
        : undefined;
      setWriteError(
        code === "department_delete_conflict"
          ? t("organization.departments.deleteReferenced")
          : t("organization.departments.deleteFailed"),
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function exportDepartments(format: "csv" | "xlsx") {
    setExportError(false);
    if (departments.length === 0) {
      setExportError(true);
      return;
    }
    const columns: ExportColumn<Department>[] = [
      { heading: t("organization.departments.code"), value: (row) => row.code, width: 18 },
      { heading: t("organization.departments.name"), value: (row) => row.name, width: 32 },
      { heading: t("organization.departments.status"), value: (row) => row.isActive ? t("organization.departments.active") : t("organization.departments.inactive"), width: 14 },
    ];
    try {
      if (format === "csv") {
        exportGridCsv(departments, columns, "departments.csv");
      } else {
        await exportGridXlsx(departments, columns, "departments.xlsx", t("organization.departments.exportSheet"));
      }
    } catch {
      setExportError(true);
    }
  }

  return (
    <OrganizationWorkspace
      title={t("organization.departments.title")}
      description={t("organization.departments.description")}
      sectionActions={
        canManage ? (
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              setWriteError(null);
              setPanelMode("create");
            }}
            className={formPrimaryButtonClassName()}
          >
            {portalActionContent("create", t("organization.departments.new"))}
          </button>
        ) : undefined
      }
      sectionSecondaryActions={
        <button
          type="button"
          onClick={() => setRefreshVersion((value) => value + 1)}
          disabled={isLoading}
          className={formSecondaryButtonClassName()}
        >
          {portalActionContent(
            "refresh",
            isLoading
              ? t("organization.departments.refreshing")
              : t("organization.departments.refresh"),
          )}
        </button>
      }
      contentFillsViewport
    >
      <PortalNotificationHost>
        {feedback ? (
          <PortalNotification
            variant="success"
            message={feedback}
            dismissLabel={t("common.dismissNotification")}
            onDismiss={() => setFeedback(null)}
          />
        ) : null}
        {writeError ? (
          <PortalNotification
            variant="error"
            message={writeError}
            dismissLabel={t("common.dismissNotification")}
            onDismiss={() => setWriteError(null)}
          />
        ) : null}
        {exportError ? (
          <PortalNotification
            variant="error"
            message={
              departments.length === 0
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
          ariaLabel={t("organization.departments.tableLabel")}
          fillViewport
          toolbar={
            <AdministrativeGridToolbar
              search={search}
              searchLabel={t("organization.departments.searchLabel")}
              searchPlaceholder={t("organization.departments.searchPlaceholder")}
              onSearchChange={setSearch}
              activeFilterCount={activeFilterCount}
              areFiltersVisible={areFiltersVisible}
              exportDisabled={departments.length === 0}
              filtersLabel={t("grid.filters")}
              showFiltersLabel={t("grid.showFilters")}
              hideFiltersLabel={t("grid.hideFilters")}
              clearFiltersLabel={t("grid.clearFilters")}
              exportLabel={t("grid.export")}
              exportCsvLabel={t("grid.exportCsv")}
              exportExcelLabel={t("grid.exportExcel")}
              onToggleFilters={() => setAreFiltersVisible((visible) => !visible)}
              onClearFilters={() => setStatus("all")}
              onExportCsv={() => void exportDepartments("csv")}
              onExportExcel={() => void exportDepartments("xlsx")}
            />
          }
          viewport={
            <table aria-busy={isLoading} className="w-full min-w-[620px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-slate-300 bg-slate-100 text-xs font-semibold text-slate-600">
                <tr>
                  <SortableGridHeader field="code" label={t("organization.departments.code")} sort={sort} sortAscendingLabel={t("grid.sortAscending", { column: t("organization.departments.code") })} sortDescendingLabel={t("grid.sortDescending", { column: t("organization.departments.code") })} clearSortingLabel={t("grid.clearSorting", { column: t("organization.departments.code") })} onSort={(field) => setSort((current) => nextGridSort(current, field))} />
                  <SortableGridHeader field="name" label={t("organization.departments.name")} sort={sort} sortAscendingLabel={t("grid.sortAscending", { column: t("organization.departments.name") })} sortDescendingLabel={t("grid.sortDescending", { column: t("organization.departments.name") })} clearSortingLabel={t("grid.clearSorting", { column: t("organization.departments.name") })} onSort={(field) => setSort((current) => nextGridSort(current, field))} />
                  <SortableGridHeader field="status" label={t("organization.departments.status")} sort={sort} sortAscendingLabel={t("grid.sortAscending", { column: t("organization.departments.status") })} sortDescendingLabel={t("grid.sortDescending", { column: t("organization.departments.status") })} clearSortingLabel={t("grid.clearSorting", { column: t("organization.departments.status") })} onSort={(field) => setSort((current) => nextGridSort(current, field))} />
                </tr>
                <GridFilterRow visible={areFiltersVisible}>
                  <GridFilterCell />
                  <GridFilterCell />
                  <GridFilterCell>
                    <label>
                      <span className="sr-only">{t("organization.departments.statusFilter")}</span>
                      <select
                        value={status}
                        onChange={(event) => setStatus(event.target.value as DepartmentStatusFilter)}
                        className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                      >
                        <option value="all">{t("organization.departments.allStatuses")}</option>
                        <option value="active">{t("organization.departments.active")}</option>
                        <option value="inactive">{t("organization.departments.inactive")}</option>
                      </select>
                    </label>
                  </GridFilterCell>
                </GridFilterRow>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {hasError && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-red-700">
                      {t("organization.departments.error")}
                    </td>
                  </tr>
                )}
                <GridStateRows
                  columnCount={3}
                  isLoading={isLoading}
                  hasError={hasError}
                  isEmpty={departments.length === 0}
                  loadingLabel={t("organization.departments.loading")}
                  emptyTitle={t("organization.departments.emptyTitle")}
                  emptyDescription={t("organization.departments.emptyDescription")}
                />
                {!isLoading &&
                  !hasError &&
                  visibleDepartments.map((department) => {
                    const isSelected = department.publicId === selectedDepartmentPublicId;
                    return (
                      <tr
                        key={department.publicId}
                        aria-selected={isSelected}
                        onClick={() => {
                          setIsConfirmingStatus(false);
                          setIsConfirmingDelete(false);
                          setWriteError(null);
                          setPanelMode("details");
                          setSelectedDepartmentPublicId(department.publicId);
                        }}
                        className={`cursor-pointer hover:bg-slate-50 ${isSelected ? "bg-blue-50 shadow-[inset_3px_0_0_#1d4ed8]" : "bg-white"}`}
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">{department.code}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            aria-pressed={isSelected}
                            onClick={(event) => {
                              event.stopPropagation();
                              setPanelMode("details");
                              setSelectedDepartmentPublicId(department.publicId);
                            }}
                            className="rounded-sm text-left font-semibold text-slate-950 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                          >
                            {department.name}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <DepartmentStatus isActive={department.isActive} />
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
              totalCount={departments.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              labels={{
                range: (from, to, total) => t("grid.visibleRange", { from, to, total }),
                pageSize: t("grid.pageSize"),
                first: t("grid.firstPage"),
                previous: t("grid.previousPage"),
                next: t("grid.nextPage"),
                last: t("grid.lastPage"),
              }}
            />
          }
          detailsPanel={
            <div aria-label={t("organization.departments.details")}>
              <h2 className="mb-4 text-lg font-semibold text-slate-950">
                {panelMode === "create"
                  ? t("organization.departments.new")
                  : panelMode === "edit"
                    ? t("organization.departments.edit")
                    : t("organization.departments.details")}
              </h2>
              {panelMode === "create" ? (
                <DepartmentForm mode="create" onCancel={() => setPanelMode("details")} onCreate={create} onUpdate={update} />
              ) : panelMode === "edit" && selectedDepartment ? (
                <DepartmentForm
                  mode="edit"
                  department={selectedDepartment}
                  onCancel={() => setPanelMode("details")}
                  onCreate={create}
                  onUpdate={update}
                />
              ) : selectedDepartment ? (
                <div className="space-y-3 text-sm">
                  <Detail label={t("organization.departments.code")} value={selectedDepartment.code} />
                  <Detail label={t("organization.departments.name")} value={selectedDepartment.name} />
                  <Detail
                    label={t("organization.departments.status")}
                    value={
                      selectedDepartment.isActive
                        ? t("organization.departments.active")
                        : t("organization.departments.inactive")
                    }
                  />
                  {canManage && (
                    <div className="space-y-2 pt-2">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setPanelMode("edit")} className={formPrimaryButtonClassName()}>
                          {t("organization.departments.edit")}
                        </button>
                        <button type="button" onClick={() => setIsConfirmingStatus(true)} className={formSecondaryButtonClassName()}>
                          {selectedDepartment.isActive
                            ? t("organization.departments.deactivate")
                            : t("organization.departments.activate")}
                        </button>
                        <button type="button" onClick={() => setIsConfirmingDelete(true)} className={formDangerButtonClassName()}>
                          {t("organization.departments.delete")}
                        </button>
                      </div>
                      {isConfirmingStatus && (
                        <ConfirmDialog
                          message={
                            selectedDepartment.isActive
                              ? t("organization.departments.deactivateConfirmation")
                              : t("organization.departments.activateConfirmation")
                          }
                          confirmLabel={t("organization.departments.confirm")}
                          cancelLabel={t("organization.departments.cancel")}
                          onConfirm={() => void changeStatus()}
                          onCancel={() => setIsConfirmingStatus(false)}
                        />
                      )}
                      {isConfirmingDelete && (
                        <ConfirmDialog
                          destructive
                          message={t("organization.departments.deleteConfirmation")}
                          confirmLabel={t("organization.departments.delete")}
                          cancelLabel={t("organization.departments.cancel")}
                          pending={isDeleting}
                          onConfirm={() => void remove()}
                          onCancel={() => setIsConfirmingDelete(false)}
                        />
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-600">{t("organization.departments.selectForDetails")}</p>
              )}
            </div>
          }
        />
      </AdministrationPageBody>
    </OrganizationWorkspace>
  );
}

function DepartmentStatus({ isActive }: { isActive: boolean }) {
  const { t } = useTranslations();
  return (
    <StatusBadge
      tone={isActive ? "active" : "inactive"}
      label={isActive ? t("organization.departments.active") : t("organization.departments.inactive")}
    />
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <dl><dt className="font-medium text-slate-500">{label}</dt><dd className="mt-0.5 text-slate-950">{value}</dd></dl>;
}

function compareDepartments(left: Department, right: Department, sort: GridSort<DepartmentSortField>) {
  const activeSort = sort ?? { field: "code" as const, direction: "asc" as const };
  const value = (department: Department) => ({ code: department.code, name: department.name, status: department.isActive ? "Active" : "Inactive" })[activeSort.field];
  const comparison = value(left).localeCompare(value(right), undefined, { numeric: true, sensitivity: "base" });
  const ordered = activeSort.direction === "desc" ? -comparison : comparison;
  return ordered || left.code.localeCompare(right.code, undefined, { numeric: true, sensitivity: "base" }) || left.publicId.localeCompare(right.publicId);
}
