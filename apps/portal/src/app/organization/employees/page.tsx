"use client";

import { useEffect, useMemo, useState } from "react";
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
import { GridPagination } from "@/components/grid-pagination";
import { useAuth } from "@/components/auth-provider";
import { CompanyAdministrationWorkspace } from "@/components/company-administration-workspace";
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
  EmployeeSort,
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
  const [sort, setSort] = useState<GridSort<EmployeeSortField>>(null);
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
        sort: sort
          ? ((sort.direction === "desc" ? `-${sort.field}` : sort.field) as EmployeeSort)
          : undefined,
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
    sort,
  ]);

  const employees = useMemo(() => employeeResult.filter((employee) =>
    employmentEndDateState === "all" || (employmentEndDateState === "missing") === (employee.employmentEndDate === null),
  ), [employeeResult, employmentEndDateState]);
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
    { heading: t("vacation.employees.email"), value: (row) => row.email ?? "", width: 32 },
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
    <EmployeeCommandBar
      isRefreshing={isLoading}
      search={search}
      canManage={canManage}
      activeFilterCount={activeFilterCount}
      areFiltersVisible={areFiltersVisible}
      exportDisabled={employees.length === 0}
      onClearFilters={() => {
        setDepartmentPublicId(""); setStatus("all"); setEmploymentEndDateState("all");
      }}
      onNew={() => { setFeedback(null); setWriteError(null); setPanelMode("create"); }}
      onExportCsv={() => void exportEmployees("csv")}
      onExportExcel={() => void exportEmployees("xlsx")}
      onRefresh={() => setRefreshVersion((version) => version + 1)}
      onSearchChange={setSearch}
      onToggleFilters={() => setAreFiltersVisible((visible) => !visible)}
    />
  );

  return (
    <CompanyAdministrationWorkspace
      title={t("vacation.employees.title")}
      description={t("vacation.employees.description")}
      commandBar={commandBar}
    >
      <div className="space-y-3">
        {feedback && <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{feedback}</div>}
        {writeError && <div role="alert" className="whitespace-pre-line rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{writeError}</div>}
        {hasDepartmentError && (
          <div
            role="status"
            className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900"
          >
            {t("vacation.employees.departmentError")}
          </div>
        )}

        {hasError && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {t("vacation.employees.error")}
          </div>
        )}
        {exportError && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {employees.length === 0
              ? t("grid.noExportRows")
              : t("grid.exportFailure")}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section
          aria-label={t("vacation.employees.tableLabel")}
          className="min-w-0 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm [contain:paint]"
        >
          <div className="overflow-x-auto">
            <table
              aria-busy={isLoading}
              className="w-full min-w-[1160px] border-collapse text-left text-sm"
            >
              <thead className="border-b border-slate-300 bg-slate-100 text-xs font-semibold text-slate-600">
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
                  <SortableGridHeader
                    field="email"
                    label={t("vacation.employees.email")}
                    sort={sort}
                    sortAscendingLabel={t("grid.sortAscending", { column: t("vacation.employees.email") })}
                    sortDescendingLabel={t("grid.sortDescending", { column: t("vacation.employees.email") })}
                    clearSortingLabel={t("grid.clearSorting", { column: t("vacation.employees.email") })}
                    onSort={(field) => setSort((current) => nextGridSort(current, field))}
                  />
                </tr>
                <GridFilterRow visible={areFiltersVisible}>
                  <GridFilterCell />
                  <GridFilterCell />
                  <GridFilterCell />
                  <GridFilterCell>
                    <label>
                      <span className="sr-only">{t("vacation.employees.departmentFilter")}</span>
                      <select
                        value={departmentPublicId}
                        disabled={hasDepartmentError}
                        onChange={(event) => setDepartmentPublicId(event.target.value)}
                        className="min-h-9 w-full min-w-44 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="">{t("vacation.employees.allDepartments")}</option>
                        {departments.map((department) => (
                          <option key={department.publicId} value={department.publicId}>{department.name}</option>
                        ))}
                      </select>
                    </label>
                  </GridFilterCell>
                  <GridFilterCell><label><span className="sr-only">{t("vacation.employees.statusFilter")}</span><select value={status} onChange={(event) => setStatus(event.target.value as EmployeeStatusFilter)} className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"><option value="all">{t("vacation.employees.allStatuses")}</option><option value="active">{t("vacation.employees.active")}</option><option value="inactive">{t("vacation.employees.inactive")}</option></select></label></GridFilterCell>
                  <GridFilterCell />
                  <GridFilterCell><label><span className="sr-only">{t("vacation.employees.employmentEndDateState")}</span><select value={employmentEndDateState} onChange={(event) => setEmploymentEndDateState(event.target.value as "all" | "missing" | "present")} className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"><option value="all">{t("vacation.employees.allEndDateStates")}</option><option value="missing">{t("vacation.employees.withoutEmploymentEndDate")}</option><option value="present">{t("vacation.employees.withEmploymentEndDate")}</option></select></label></GridFilterCell>
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
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
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
                        <td className="whitespace-nowrap px-4 py-3">
                          <EmploymentStatus status={employee.employmentStatus} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{employee.employmentStartDate ? formatPortalDate(employee.employmentStartDate) : t("vacation.employees.notProvided")}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{employee.employmentEndDate ? formatPortalDate(employee.employmentEndDate) : t("vacation.employees.notProvided")}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {employee.email ?? t("vacation.employees.notProvided")}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <GridPagination page={page} pageSize={pageSize} totalCount={employees.length} onPageChange={setPage} onPageSizeChange={setPageSize} labels={{ range: (from, to, total) => t("grid.visibleRange", { from, to, total }), pageSize: t("grid.pageSize"), first: t("grid.firstPage"), previous: t("grid.previousPage"), next: t("grid.nextPage"), last: t("grid.lastPage") }} />
          <GridFooter countLabel={t("vacation.employees.records", { count: employees.length })} selectionLabel={selectedEmployee ? t("vacation.employees.selected", { name: [selectedEmployee.firstName, selectedEmployee.middleName, selectedEmployee.lastName].filter(Boolean).join(" ") }) : t("vacation.employees.selectionHint")} />
        </section>
        <aside aria-label={t("vacation.employees.details")} className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-950">{panelMode === "create" ? t("vacation.employees.new") : panelMode === "edit" ? t("vacation.employees.edit") : t("vacation.employees.details")}</h2>
          {panelMode === "create" ? (
            <EmployeeForm mode="create" departments={departments} onCancel={() => setPanelMode("details")} onCreate={create} onUpdate={update} />
          ) : panelMode === "edit" && selectedEmployee ? (
            <EmployeeForm mode="edit" employee={selectedEmployee} departments={departments} onCancel={() => setPanelMode("details")} onCreate={create} onUpdate={update} />
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
              {canManage && <div className="space-y-2 pt-2"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setPanelMode("edit")} className="min-h-9 rounded-md bg-blue-700 px-3 text-sm font-semibold text-white">{t("vacation.employees.edit")}</button><button type="button" onClick={() => setIsConfirmingStatus(true)} className="min-h-9 rounded-md border border-slate-300 px-3 text-sm font-medium">{selectedEmployee.employmentStatus === "Active" ? t("vacation.employees.deactivate") : t("vacation.employees.activate")}</button><button type="button" onClick={() => setIsConfirmingDelete(true)} className="min-h-9 rounded-md border border-red-300 px-3 text-sm font-medium text-red-700">{t("vacation.employees.delete")}</button></div>{isConfirmingStatus && <div className="rounded-md border border-amber-200 bg-amber-50 p-3"><p className="text-sm text-amber-900">{selectedEmployee.employmentStatus === "Active" ? t("vacation.employees.deactivateConfirmation") : t("vacation.employees.activateConfirmation")}</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => void changeStatus()} className="min-h-9 rounded-md bg-blue-700 px-3 text-sm font-semibold text-white">{t("vacation.employees.confirm")}</button><button type="button" onClick={() => setIsConfirmingStatus(false)} className="min-h-9 rounded-md border border-slate-300 px-3 text-sm">{t("vacation.employees.cancel")}</button></div></div>}{isConfirmingDelete && <div role="alertdialog" aria-modal="true" className="rounded-md border border-red-200 bg-red-50 p-3"><p className="text-sm text-red-900">{t("vacation.employees.deleteConfirmation")}</p><div className="mt-2 flex gap-2"><button type="button" disabled={isDeleting} onClick={() => void remove()} className="min-h-9 rounded-md bg-red-700 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{t("vacation.employees.delete")}</button><button type="button" disabled={isDeleting} onClick={() => setIsConfirmingDelete(false)} className="min-h-9 rounded-md border border-slate-300 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60">{t("vacation.employees.cancel")}</button></div></div>}</div>}
            </div>
          ) : <p className="text-sm text-slate-600">{t("vacation.employees.selectForDetails")}</p>}
        </aside>
        </div>
      </div>
    </CompanyAdministrationWorkspace>
  );
}

function EmployeeCommandBar({
  isRefreshing,
  search,
  canManage,
  activeFilterCount,
  areFiltersVisible,
  exportDisabled,
  onClearFilters,
  onNew,
  onExportCsv,
  onExportExcel,
  onRefresh,
  onSearchChange,
  onToggleFilters,
}: {
  isRefreshing: boolean;
  search: string;
  canManage: boolean;
  activeFilterCount: number;
  areFiltersVisible: boolean;
  exportDisabled: boolean;
  onClearFilters: () => void;
  onNew: () => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
  onRefresh: () => void;
  onSearchChange: (value: string) => void;
  onToggleFilters: () => void;
}) {
  const { t } = useTranslations();

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      {canManage && <button
        type="button"
        onClick={onNew}
        className="inline-flex min-h-9 items-center gap-2 rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PlusIcon />
        {t("vacation.employees.new")}
      </button>}

      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshIcon />
        {isRefreshing
          ? t("vacation.employees.refreshing")
          : t("vacation.employees.refresh")}
      </button>

      <div className="ml-0 flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:ml-auto lg:justify-end">
        <label className="w-full min-w-0 flex-1 sm:min-w-[210px] lg:max-w-xs">
          <span className="sr-only">
            {t("vacation.employees.searchLabel")}
          </span>
          <input
            type="search"
            maxLength={100}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("vacation.employees.searchPlaceholder")}
            className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <GridToolbarActions activeFilterCount={activeFilterCount} areFiltersVisible={areFiltersVisible} exportDisabled={exportDisabled} filtersLabel={t("grid.filters")} showFiltersLabel={t("grid.showFilters")} hideFiltersLabel={t("grid.hideFilters")} clearFiltersLabel={t("grid.clearFilters")} exportLabel={t("grid.export")} exportCsvLabel={t("grid.exportCsv")} exportExcelLabel={t("grid.exportExcel")} onToggleFilters={onToggleFilters} onClearFilters={onClearFilters} onExportCsv={onExportCsv} onExportExcel={onExportExcel} />
      </div>
    </div>
  );
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

function Detail({ label, value }: { label: string; value: string }) {
  return <dl><dt className="font-medium text-slate-500">{label}</dt><dd className="mt-0.5 text-slate-950">{value}</dd></dl>;
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
    >
      <path d="M10 4v12M4 10h12" />
    </svg>
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
