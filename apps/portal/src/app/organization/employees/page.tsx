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
import { GridPagination } from "@/components/grid-pagination";
import { useAuth } from "@/components/auth-provider";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CompanyAdministrationWorkspace } from "@/components/company-administration-workspace";
import {
  formDangerButtonClassName,
  formPrimaryButtonClassName,
  formSecondaryButtonClassName,
} from "@/components/form-field";
import { portalActionContent } from "@/components/portal-action-icon";
import { PortalNotification } from "@/components/portal-notification";
import { useTranslations } from "@/i18n/use-translations";
import {
  activateEmployee,
  createEmployee,
  deactivateEmployee,
  deleteEmployee,
  getDepartments,
  getEmployees,
  updateEmployee,
} from "@/services/organization";
import type {
  Department,
  Employee,
  EmployeeStatusFilter,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
} from "@/types/organization";
import { employeesManagePermission } from "@/types/organization";
import { EmployeeForm } from "@/features/vacation/components/employee-form";
import {
  exportGridCsv,
  exportGridXlsx,
  type ExportColumn,
} from "@/utils/admin-grid-export";
import { formatPortalDate } from "@/utils/portal-date-format";

type EmployeeSortField =
  | "employeeNumber"
  | "name"
  | "department"
  | "email"
  | "status";

export default function EmployeesPage() {
  const { accessToken, user } = useAuth();
  const { t } = useTranslations();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employeeResult, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [departmentPublicId, setDepartmentPublicId] = useState("");
  const [status, setStatus] = useState<EmployeeStatusFilter>("all");
  const [employmentEndDateState, setEmploymentEndDateState] = useState<"all" | "missing" | "present">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [panelMode, setPanelMode] = useState<"details" | "create" | "edit">("details");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [isConfirmingStatus, setIsConfirmingStatus] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sort, setSort] = useState<GridSort<EmployeeSortField> | null>(null);
  const [areFiltersVisible, setAreFiltersVisible] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [hasDepartmentError, setHasDepartmentError] = useState(false);
  const [selectedEmployeePublicId, setSelectedEmployeePublicId] = useState<
    string | null
  >(null);

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
    setHasDepartmentError(false);

    getDepartments(accessToken, { sort: "name" }, controller.signal)
      .then(setDepartments)
      .catch(() => {
        if (!controller.signal.aborted) {
          setDepartments([]);
          setHasDepartmentError(true);
        }
      });

    return () => controller.abort();
  }, [accessToken, refreshVersion]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setHasError(false);

    getEmployees(
      accessToken,
      {
        search: debouncedSearch || undefined,
        departmentPublicId: departmentPublicId || undefined,
        status,
        sort: undefined,
      },
      controller.signal,
    )
      .then((result) => {
        setEmployees(result);
        setSelectedEmployeePublicId((currentSelection) =>
          currentSelection &&
          result.some((employee) => employee.publicId === currentSelection)
            ? currentSelection
            : null,
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setEmployees([]);
          setSelectedEmployeePublicId(null);
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
    debouncedSearch,
    departmentPublicId,
    status,
    refreshVersion,
  ]);

  const employees = useMemo(() => {
    const filtered = employeeResult
      .filter((employee) => employmentEndDateState === "all" || (employmentEndDateState === "missing") === (employee.employmentEndDate === null));
    return sort ? [...filtered].sort((left, right) => compareEmployees(left, right, sort)) : filtered;
  }, [employeeResult, employmentEndDateState, sort]);
  const totalPages = Math.max(1, Math.ceil(employees.length / pageSize));
  const visibleEmployees = useMemo(() => employees.slice((page - 1) * pageSize, page * pageSize), [employees, page, pageSize]);
  const selectedEmployee = useMemo(
    () =>
      employees.find(
        (employee) => employee.publicId === selectedEmployeePublicId,
      ) ?? null,
    [employees, selectedEmployeePublicId],
  );
  const canManage = user?.permissions.includes(employeesManagePermission) ?? false;
  const activeFilterCount = [departmentPublicId, status === "all" ? "" : status,
    employmentEndDateState === "all" ? "" : employmentEndDateState].filter(Boolean).length;

  useEffect(() => { setPage(1); }, [debouncedSearch, departmentPublicId, status, employmentEndDateState, sort, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  async function create(request: CreateEmployeeRequest) {
    if (!accessToken) return;
    const employee = await createEmployee(accessToken, request);
    setSelectedEmployeePublicId(employee.publicId);
    setPanelMode("details");
    setFeedback(t("vacation.employees.createSuccess"));
    setRefreshVersion((value) => value + 1);
  }

  async function update(request: UpdateEmployeeRequest) {
    if (!accessToken || !selectedEmployee) return;
    await updateEmployee(accessToken, selectedEmployee.publicId, request);
    setPanelMode("details");
    setFeedback(t("vacation.employees.updateSuccess"));
    setRefreshVersion((value) => value + 1);
  }

  async function changeStatus() {
    if (!accessToken || !selectedEmployee) return;
    setWriteError(null);
    try {
      if (selectedEmployee.employmentStatus === "Active")
        await deactivateEmployee(accessToken, selectedEmployee.publicId);
      else await activateEmployee(accessToken, selectedEmployee.publicId);
      setFeedback(selectedEmployee.employmentStatus === "Active"
        ? t("vacation.employees.deactivateSuccess")
        : t("vacation.employees.activateSuccess"));
      setRefreshVersion((value) => value + 1);
      setIsConfirmingStatus(false);
    } catch {
      setWriteError(t("vacation.employees.saveFailed"));
    }
  }

  async function remove() {
    if (!accessToken || !selectedEmployee || isDeleting) return;
    setWriteError(null);
    setIsDeleting(true);
    try {
      await deleteEmployee(accessToken, selectedEmployee.publicId);
      setSelectedEmployeePublicId(null);
      setPanelMode("details");
      setIsConfirmingDelete(false);
      setFeedback(t("vacation.employees.deleteSuccess"));
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      const code = error instanceof Error && "problem" in error && (error as { problem?: { code?: string } }).problem?.code;
      const dependencies = error instanceof Error && "problem" in error
        ? (error as { problem?: { dependencies?: string[] } }).problem?.dependencies
        : undefined;
      setWriteError(code === "employee_delete_conflict"
        ? deleteConflictMessage(dependencies, t)
        : t("vacation.employees.deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
  }

  function selectEmployee(employee: Employee) {
    setIsConfirmingStatus(false);
    setIsConfirmingDelete(false);
    setWriteError(null);
    setSelectedEmployeePublicId(employee.publicId);
  }

  const exportColumns: ExportColumn<Employee>[] = [
    { heading: t("vacation.employees.employeeNumber"), value: (row) => row.employeeNumber, width: 18 },
    { heading: t("vacation.employees.name"), value: (row) => [row.firstName, row.lastName].join(" "), width: 28 },
    { heading: t("vacation.employees.middleName"), value: (row) => row.middleName ?? "", width: 20 },
    { heading: t("vacation.employees.department"), value: (row) => row.departmentName, width: 24 },
    { heading: t("vacation.employees.email"), value: (row) => row.email ?? "", width: 32 },
    {
      heading: t("vacation.employees.status"),
      value: (row) =>
        row.employmentStatus === "Active"
          ? t("vacation.employees.active")
          : t("vacation.employees.inactive"),
      width: 14,
    },
    { heading: t("vacation.employees.employmentStartDate"), value: (row) => row.employmentStartDate ? formatPortalDate(row.employmentStartDate) : t("vacation.employees.notProvided"), width: 16 },
    { heading: t("vacation.employees.employmentEndDate"), value: (row) => row.employmentEndDate ? formatPortalDate(row.employmentEndDate) : t("vacation.employees.notProvided"), width: 16 },
  ];

  async function exportEmployees(format: "csv" | "xlsx") {
    setExportError(false);
    if (employees.length === 0) {
      setExportError(true);
      return;
    }
    try {
      if (format === "csv") {
        exportGridCsv(employees, exportColumns, "employees.csv");
      } else {
        await exportGridXlsx(
          employees,
          exportColumns,
          "employees.xlsx",
          t("vacation.employees.exportSheet"),
        );
      }
    } catch {
      setExportError(true);
    }
  }

  const commandBar = (
    <div className="flex flex-wrap items-center gap-2">
      {canManage && (
        <button
          type="button"
          onClick={() => {
            setFeedback(null);
            setWriteError(null);
            setPanelMode("create");
          }}
          className={formPrimaryButtonClassName()}
        >
          {portalActionContent("create", t("vacation.employees.new"))}
        </button>
      )}
      <button
        type="button"
        onClick={() => setRefreshVersion((version) => version + 1)}
        disabled={isLoading}
        className={formSecondaryButtonClassName()}
      >
        {portalActionContent(
          "refresh",
          isLoading ? t("vacation.employees.refreshing") : t("vacation.employees.refresh"),
        )}
      </button>
    </div>
  );

  const gridToolbar = (
    <EmployeeGridToolbar
      search={search}
      activeFilterCount={activeFilterCount}
      areFiltersVisible={areFiltersVisible}
      exportDisabled={employees.length === 0}
      onClearFilters={() => {
        setDepartmentPublicId(""); setStatus("all"); setEmploymentEndDateState("all");
      }}
      onExportCsv={() => void exportEmployees("csv")}
      onExportExcel={() => void exportEmployees("xlsx")}
      onSearchChange={setSearch}
      onToggleFilters={() => setAreFiltersVisible((visible) => !visible)}
    />
  );

  return (
    <CompanyAdministrationWorkspace
      title={t("vacation.employees.title")}
      description={t("vacation.employees.description")}
      headerActions={commandBar}
      contentFillsViewport
    >
      <AdministrationPageBody>
        <AdministrativeGridShell
          ariaLabel={t("vacation.employees.tableLabel")}
          fillViewport
          toolbar={gridToolbar}
          viewport={
            <table
              aria-busy={isLoading}
              className="w-full min-w-[1160px] border-collapse text-left text-sm"
            >
              <thead className="sticky top-0 z-10 border-b border-slate-300 bg-slate-100 text-xs font-semibold text-slate-600">
                <tr>
                  <SortableGridHeader
                    field="employeeNumber"
                    label={t("vacation.employees.employeeNumber")}
                    sort={sort}
                    sortAscendingLabel={t("grid.sortAscending", { column: t("vacation.employees.employeeNumber") })}
                    sortDescendingLabel={t("grid.sortDescending", { column: t("vacation.employees.employeeNumber") })}
                    clearSortingLabel={t("grid.clearSorting", { column: t("vacation.employees.employeeNumber") })}
                    onSort={(field) => setSort((current) => nextGridSort(current, field))}
                  />
                  <SortableGridHeader
                    field="name"
                    label={t("vacation.employees.name")}
                    sort={sort}
                    sortAscendingLabel={t("grid.sortAscending", { column: t("vacation.employees.name") })}
                    sortDescendingLabel={t("grid.sortDescending", { column: t("vacation.employees.name") })}
                    clearSortingLabel={t("grid.clearSorting", { column: t("vacation.employees.name") })}
                    onSort={(field) => setSort((current) => nextGridSort(current, field))}
                  />
                  <th scope="col" className="w-40 px-4 py-2">{t("vacation.employees.middleName")}</th>
                  <SortableGridHeader
                    field="department"
                    label={t("vacation.employees.department")}
                    sort={sort}
                    sortAscendingLabel={t("grid.sortAscending", { column: t("vacation.employees.department") })}
                    sortDescendingLabel={t("grid.sortDescending", { column: t("vacation.employees.department") })}
                    clearSortingLabel={t("grid.clearSorting", { column: t("vacation.employees.department") })}
                    onSort={(field) => setSort((current) => nextGridSort(current, field))}
                  />
                  <SortableGridHeader
                    field="email"
                    label={t("vacation.employees.email")}
                    sort={sort}
                    sortAscendingLabel={t("grid.sortAscending", { column: t("vacation.employees.email") })}
                    sortDescendingLabel={t("grid.sortDescending", { column: t("vacation.employees.email") })}
                    clearSortingLabel={t("grid.clearSorting", { column: t("vacation.employees.email") })}
                    onSort={(field) => setSort((current) => nextGridSort(current, field))}
                  />
                  <SortableGridHeader
                    field="status"
                    label={t("vacation.employees.status")}
                    sort={sort}
                    sortAscendingLabel={t("grid.sortAscending", { column: t("vacation.employees.status") })}
                    sortDescendingLabel={t("grid.sortDescending", { column: t("vacation.employees.status") })}
                    clearSortingLabel={t("grid.clearSorting", { column: t("vacation.employees.status") })}
                    onSort={(field) => setSort((current) => nextGridSort(current, field))}
                  />
                  <th scope="col" className="w-36 px-4 py-2">{t("vacation.employees.employmentStartDate")}</th>
                  <th scope="col" className="w-36 px-4 py-2">{t("vacation.employees.employmentEndDate")}</th>
                </tr>
                <GridFilterRow visible={areFiltersVisible}>
                  <GridFilterCell />
                  <GridFilterCell />
                  <GridFilterCell />
                  <GridFilterCell>
                    <ClearableSelect value={departmentPublicId} defaultValue="" disabled={hasDepartmentError} label={t("vacation.employees.departmentFilter")} clearLabel={t("vacation.employees.clearDepartmentFilter")} onChange={setDepartmentPublicId}>
                        <option value="">{t("vacation.employees.allDepartments")}</option>
                        {departments.map((department) => (
                          <option key={department.publicId} value={department.publicId}>{department.name}</option>
                        ))}
                    </ClearableSelect>
                  </GridFilterCell>
                  <GridFilterCell />
                  <GridFilterCell><ClearableSelect value={status} defaultValue="all" label={t("vacation.employees.statusFilter")} clearLabel={t("vacation.employees.clearStatusFilter")} onChange={(value) => setStatus(value as EmployeeStatusFilter)}><option value="all">{t("vacation.employees.allStatuses")}</option><option value="active">{t("vacation.employees.active")}</option><option value="inactive">{t("vacation.employees.inactive")}</option></ClearableSelect></GridFilterCell>
                  <GridFilterCell />
                  <GridFilterCell><ClearableSelect value={employmentEndDateState} defaultValue="all" label={t("vacation.employees.employmentEndDateState")} clearLabel={t("vacation.employees.clearEmploymentEndDateFilter")} onChange={(value) => setEmploymentEndDateState(value as "all" | "missing" | "present")}><option value="all">{t("vacation.employees.allEndDateStates")}</option><option value="missing">{t("vacation.employees.withoutEmploymentEndDate")}</option><option value="present">{t("vacation.employees.withEmploymentEndDate")}</option></ClearableSelect></GridFilterCell>
                  <GridFilterCell />
                </GridFilterRow>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <GridStateRows columnCount={8} isLoading={isLoading} hasError={hasError} isEmpty={employees.length === 0} loadingLabel={t("vacation.employees.loading")} emptyTitle={t("vacation.employees.emptyTitle")} emptyDescription={t("vacation.employees.emptyDescription")} />

                {!isLoading &&
                  !hasError &&
                  visibleEmployees.map((employee) => {
                    const isSelected =
                      employee.publicId === selectedEmployeePublicId;
                    const fullName = [employee.firstName, employee.lastName].join(" ");

                    return (
                      <tr
                        key={employee.publicId}
                        aria-selected={isSelected}
                        onClick={() => selectEmployee(employee)}
                        className={`cursor-pointer hover:bg-slate-50 ${
                          isSelected
                            ? "bg-blue-50 shadow-[inset_3px_0_0_#1d4ed8]"
                            : "bg-white"
                        }`}
                      >
                        <td title={employee.employeeNumber} className="max-w-28 truncate whitespace-nowrap px-3 py-3 font-medium text-slate-700">
                          {employee.employeeNumber}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <button type="button" aria-pressed={isSelected} onClick={(event) => { event.stopPropagation(); selectEmployee(employee); }} className="rounded-sm text-left font-semibold text-slate-950 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2">
                            {fullName}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{employee.middleName ?? t("vacation.employees.notProvided")}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {employee.departmentName}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {employee.email ?? t("vacation.employees.notProvided")}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <EmploymentStatus status={employee.employmentStatus} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{employee.employmentStartDate ? formatPortalDate(employee.employmentStartDate) : t("vacation.employees.notProvided")}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{employee.employmentEndDate ? formatPortalDate(employee.employmentEndDate) : t("vacation.employees.notProvided")}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          }
          pagination={<GridPagination page={page} pageSize={pageSize} totalCount={employees.length} onPageChange={setPage} onPageSizeChange={setPageSize} labels={{ range: (from, to, total) => t("grid.visibleRange", { from, to, total }), pageSize: t("grid.pageSize"), first: t("grid.firstPage"), previous: t("grid.previousPage"), next: t("grid.nextPage"), last: t("grid.lastPage") }} />}
          detailsPanel={
            <div aria-label={t("vacation.employees.details")}>
          <h2 className="mb-4 text-lg font-semibold text-slate-950">{panelMode === "create" ? t("vacation.employees.new") : panelMode === "edit" ? t("vacation.employees.edit") : t("vacation.employees.details")}</h2>
          {panelMode === "create" ? (
            <EmployeeForm key="create" mode="create" departments={departments} onCancel={() => setPanelMode("details")} onCreate={create} onUpdate={update} />
          ) : panelMode === "edit" && selectedEmployee ? (
            <EmployeeForm key={`edit-${selectedEmployee.publicId}`} mode="edit" employee={selectedEmployee} departments={departments} onCancel={() => setPanelMode("details")} onCreate={create} onUpdate={update} />
          ) : selectedEmployee ? (
            <div className="space-y-3 text-sm">
              <Detail label={t("vacation.employees.employeeNumber")} value={selectedEmployee.employeeNumber} />
              <Detail label={t("vacation.employees.name")} value={[selectedEmployee.firstName, selectedEmployee.lastName].join(" ")} />
              <Detail label={t("vacation.employees.middleName")} value={selectedEmployee.middleName ?? t("vacation.employees.notProvided")} />
              <Detail label={t("vacation.employees.employmentStartDate")} value={selectedEmployee.employmentStartDate ? formatPortalDate(selectedEmployee.employmentStartDate) : t("vacation.employees.notProvided")} />
              <Detail label={t("vacation.employees.employmentEndDate")} value={selectedEmployee.employmentEndDate ? formatPortalDate(selectedEmployee.employmentEndDate) : t("vacation.employees.notProvided")} />
              <Detail label={t("vacation.employees.department")} value={selectedEmployee.departmentName} />
              <Detail label={t("vacation.employees.email")} value={selectedEmployee.email ?? t("vacation.employees.notProvided")} />
              <Detail label={t("vacation.employees.status")} value={selectedEmployee.employmentStatus === "Active" ? t("vacation.employees.active") : t("vacation.employees.inactive")} />
              {canManage && <div className="space-y-2 pt-2"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setPanelMode("edit")} className={formPrimaryButtonClassName()}>{t("vacation.employees.edit")}</button><button type="button" onClick={() => setIsConfirmingStatus(true)} className={formSecondaryButtonClassName()}>{selectedEmployee.employmentStatus === "Active" ? t("vacation.employees.deactivate") : t("vacation.employees.activate")}</button><button type="button" onClick={() => setIsConfirmingDelete(true)} className={formDangerButtonClassName()}>{t("vacation.employees.delete")}</button></div>{isConfirmingStatus && <ConfirmDialog message={selectedEmployee.employmentStatus === "Active" ? t("vacation.employees.deactivateConfirmation") : t("vacation.employees.activateConfirmation")} confirmLabel={t("vacation.employees.confirm")} cancelLabel={t("vacation.employees.cancel")} onConfirm={() => void changeStatus()} onCancel={() => setIsConfirmingStatus(false)} />}{isConfirmingDelete && <ConfirmDialog destructive message={t("vacation.employees.deleteConfirmation")} confirmLabel={t("vacation.employees.delete")} cancelLabel={t("vacation.employees.cancel")} pending={isDeleting} onConfirm={() => void remove()} onCancel={() => setIsConfirmingDelete(false)} />}</div>}
            </div>
          ) : <p className="text-sm text-slate-600">{t("vacation.employees.selectForDetails")}</p>}
            </div>
          }
          detailsNotification={
            feedback ||
            writeError ||
            hasDepartmentError ||
            hasError ||
            exportError ? (
              <>
                {feedback && (
                  <PortalNotification
                    variant="success"
                    message={feedback}
                    dismissLabel={t("common.dismissNotification")}
                    onDismiss={() => setFeedback(null)}
                  />
                )}
                {writeError && (
                  <PortalNotification
                    variant="error"
                    message={writeError}
                    dismissLabel={t("common.dismissNotification")}
                    onDismiss={() => setWriteError(null)}
                  />
                )}
                {hasDepartmentError && (
                  <PortalNotification
                    variant="warning"
                    message={t("vacation.employees.departmentError")}
                    dismissLabel={t("common.dismissNotification")}
                    onDismiss={() => setHasDepartmentError(false)}
                  />
                )}
                {hasError && (
                  <PortalNotification
                    variant="error"
                    message={t("vacation.employees.error")}
                    dismissLabel={t("common.dismissNotification")}
                    onDismiss={() => setHasError(false)}
                  />
                )}
                {exportError && (
                  <PortalNotification
                    variant="error"
                    message={
                      employees.length === 0
                        ? t("grid.noExportRows")
                        : t("grid.exportFailure")
                    }
                    dismissLabel={t("common.dismissNotification")}
                    onDismiss={() => setExportError(false)}
                  />
                )}
              </>
            ) : undefined
          }
        />
      </AdministrationPageBody>
    </CompanyAdministrationWorkspace>
  );
}

function EmployeeGridToolbar({
  search,
  activeFilterCount,
  areFiltersVisible,
  exportDisabled,
  onClearFilters,
  onExportCsv,
  onExportExcel,
  onSearchChange,
  onToggleFilters,
}: {
  search: string;
  activeFilterCount: number;
  areFiltersVisible: boolean;
  exportDisabled: boolean;
  onClearFilters: () => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
  onSearchChange: (value: string) => void;
  onToggleFilters: () => void;
}) {
  const { t } = useTranslations();

  return <AdministrativeGridToolbar search={search} searchLabel={t("vacation.employees.searchLabel")} searchPlaceholder={t("vacation.employees.searchPlaceholder")} onSearchChange={onSearchChange} activeFilterCount={activeFilterCount} areFiltersVisible={areFiltersVisible} exportDisabled={exportDisabled} filtersLabel={t("grid.filters")} showFiltersLabel={t("grid.showFilters")} hideFiltersLabel={t("grid.hideFilters")} clearFiltersLabel={t("grid.clearFilters")} exportLabel={t("grid.export")} exportCsvLabel={t("grid.exportCsv")} exportExcelLabel={t("grid.exportExcel")} onToggleFilters={onToggleFilters} onClearFilters={onClearFilters} onExportCsv={onExportCsv} onExportExcel={onExportExcel} />;
}

function EmploymentStatus({
  status,
}: {
  status: Employee["employmentStatus"];
}) {
  const { t } = useTranslations();
  const isActive = status === "Active";

  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${
        isActive
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-slate-300 bg-slate-100 text-slate-700"
      }`}
    >
      {isActive
        ? t("vacation.employees.active")
        : t("vacation.employees.inactive")}
    </span>
  );
}

function deleteConflictMessage(dependencies: string[] | undefined, t: (key: never) => string) {
  const names: Record<string, string> = {
    "Identity user link": t("vacation.employees.dependencyUserLink" as never),
    "Vacation leave request": t("vacation.employees.dependencyLeaveRequests" as never),
    "Vacation leave balance": t("vacation.employees.dependencyLeaveBalance" as never),
    "Vacation leave policy": t("vacation.employees.dependencyLeavePolicy" as never),
    "Vacation leave balance history": t("vacation.employees.dependencyLeaveBalanceHistory" as never),
    "Employee audit history": t("vacation.employees.dependencyAuditHistory" as never),
  };
  const safeNames = dependencies?.map((dependency) => names[dependency]).filter(Boolean) ?? [];
  return safeNames.length
    ? `${t("vacation.employees.deleteConflictHeading" as never)}\n\n${t("vacation.employees.deleteConflictUses" as never)}\n${safeNames.map((name) => `• ${name}`).join("\n")}\n\n${t("vacation.employees.deleteConflictGuidance" as never)}`
    : `${t("vacation.employees.deleteReferenced" as never)} ${t("vacation.employees.deleteConflictGuidance" as never)}`;
}

function compareEmployees(left: Employee, right: Employee, sort: Exclude<GridSort<EmployeeSortField>, null>) {
  const activeSort = sort;
  const value = (employee: Employee) => ({
    employeeNumber: employee.employeeNumber,
    name: `${employee.firstName} ${employee.lastName}`,
    department: employee.departmentName,
    email: employee.email ?? "",
    status: employee.employmentStatus,
  })[activeSort.field];
  const comparison = value(left).localeCompare(value(right), undefined, { numeric: true, sensitivity: "base" });
  const ordered = activeSort.direction === "desc" ? -comparison : comparison;
  return ordered || left.employeeNumber.localeCompare(right.employeeNumber, undefined, { numeric: true, sensitivity: "base" }) || left.publicId.localeCompare(right.publicId);
}

function ClearableSelect({ value, defaultValue, disabled, label, clearLabel, onChange, children }: {
  value: string; defaultValue: string; disabled?: boolean; label: string; clearLabel: string;
  onChange: (value: string) => void; children: ReactNode;
}) {
  return <div className="flex min-w-0 items-center gap-1"><label className="min-w-0 flex-1"><span className="sr-only">{label}</span><select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="min-h-9 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 text-sm">{children}</select></label>{value !== defaultValue && <button type="button" disabled={disabled} onClick={() => onChange(defaultValue)} aria-label={clearLabel} className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50">×</button>}</div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <dl><dt className="font-medium text-slate-500">{label}</dt><dd className="mt-0.5 text-slate-950">{value}</dd></dl>;
}
