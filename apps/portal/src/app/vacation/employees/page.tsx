"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { VacationWorkspace } from "@/features/vacation/components/vacation-workspace";
import { useTranslations } from "@/i18n/use-translations";
import { getDepartments, getEmployees } from "@/services/organization";
import type {
  Department,
  Employee,
  EmployeeSort,
} from "@/types/organization";

type EmployeeSortField =
  | "employeeNumber"
  | "name"
  | "department"
  | "email"
  | "status";

export default function EmployeesPage() {
  const { accessToken } = useAuth();
  const { t } = useTranslations();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [departmentPublicId, setDepartmentPublicId] = useState("");
  const [sort, setSort] = useState<EmployeeSort>("name");
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
        sort,
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
    refreshVersion,
    sort,
  ]);

  const selectedEmployee = useMemo(
    () =>
      employees.find(
        (employee) => employee.publicId === selectedEmployeePublicId,
      ) ?? null,
    [employees, selectedEmployeePublicId],
  );

  function toggleSort(field: EmployeeSortField) {
    setSort((currentSort) =>
      currentSort === field ? (`-${field}` as EmployeeSort) : field,
    );
  }

  function selectEmployee(
    employee: Employee,
    event?: KeyboardEvent<HTMLTableRowElement>,
  ) {
    if (event && event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event?.preventDefault();
    setSelectedEmployeePublicId(employee.publicId);
  }

  const commandBar = (
    <EmployeeCommandBar
      departments={departments}
      departmentPublicId={departmentPublicId}
      hasDepartmentError={hasDepartmentError}
      isRefreshing={isLoading}
      search={search}
      onDepartmentChange={setDepartmentPublicId}
      onRefresh={() => setRefreshVersion((version) => version + 1)}
      onSearchChange={setSearch}
    />
  );

  return (
    <VacationWorkspace
      title={t("vacation.employees.title")}
      description={t("vacation.employees.description")}
      commandBar={commandBar}
    >
      <div className="space-y-3">
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

        <section
          aria-label={t("vacation.employees.tableLabel")}
          className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm"
        >
          <div className="overflow-x-auto">
            <table
              aria-busy={isLoading}
              className="w-full min-w-[780px] border-collapse text-left text-sm"
            >
              <thead className="border-b border-slate-300 bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <SortableHeader
                    field="employeeNumber"
                    label={t("vacation.employees.employeeNumber")}
                    sort={sort}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    field="name"
                    label={t("vacation.employees.name")}
                    sort={sort}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    field="department"
                    label={t("vacation.employees.department")}
                    sort={sort}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    field="email"
                    label={t("vacation.employees.email")}
                    sort={sort}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    field="status"
                    label={t("vacation.employees.status")}
                    sort={sort}
                    onSort={toggleSort}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isLoading && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-slate-500"
                    >
                      {t("vacation.employees.loading")}
                    </td>
                  </tr>
                )}

                {!isLoading && !hasError && employees.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center">
                      <p className="font-medium text-slate-900">
                        {t("vacation.employees.emptyTitle")}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {t("vacation.employees.emptyDescription")}
                      </p>
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  !hasError &&
                  employees.map((employee) => {
                    const isSelected =
                      employee.publicId === selectedEmployeePublicId;
                    const fullName = `${employee.firstName} ${employee.lastName}`;

                    return (
                      <tr
                        key={employee.publicId}
                        tabIndex={0}
                        aria-selected={isSelected}
                        onClick={() => selectEmployee(employee)}
                        onKeyDown={(event) => selectEmployee(employee, event)}
                        className={`cursor-pointer outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${
                          isSelected
                            ? "bg-blue-50 shadow-[inset_3px_0_0_#1d4ed8]"
                            : "bg-white"
                        }`}
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                          {employee.employeeNumber}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-950">
                          {fullName}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {employee.departmentName}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {employee.email}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <EmploymentStatus status={employee.employmentStatus} />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="flex min-h-11 flex-col justify-between gap-1 border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600 sm:flex-row sm:items-center">
            <span>
              {t("vacation.employees.records", { count: employees.length })}
            </span>
            <span>
              {selectedEmployee
                ? t("vacation.employees.selected", {
                    name: `${selectedEmployee.firstName} ${selectedEmployee.lastName}`,
                  })
                : t("vacation.employees.selectionHint")}
            </span>
          </div>
        </section>
      </div>
    </VacationWorkspace>
  );
}

function EmployeeCommandBar({
  departments,
  departmentPublicId,
  hasDepartmentError,
  isRefreshing,
  search,
  onDepartmentChange,
  onRefresh,
  onSearchChange,
}: {
  departments: Department[];
  departmentPublicId: string;
  hasDepartmentError: boolean;
  isRefreshing: boolean;
  search: string;
  onDepartmentChange: (value: string) => void;
  onRefresh: () => void;
  onSearchChange: (value: string) => void;
}) {
  const { t } = useTranslations();

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <button
        type="button"
        disabled
        title={t("common.comingSoon")}
        className="inline-flex min-h-9 items-center gap-2 rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PlusIcon />
        {t("vacation.employees.new")}
      </button>

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
        <label className="min-w-[210px] flex-1 lg:max-w-xs">
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

        <label>
          <span className="sr-only">
            {t("vacation.employees.departmentFilter")}
          </span>
          <select
            value={departmentPublicId}
            disabled={hasDepartmentError}
            onChange={(event) => onDepartmentChange(event.target.value)}
            className="min-h-9 max-w-[240px] rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            <option value="">
              {t("vacation.employees.allDepartments")}
            </option>
            {departments.map((department) => (
              <option key={department.publicId} value={department.publicId}>
                {department.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled
          title={t("common.comingSoon")}
          className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ExportIcon />
          {t("vacation.employees.export")}
        </button>
      </div>
    </div>
  );
}

function SortableHeader({
  field,
  label,
  sort,
  onSort,
}: {
  field: EmployeeSortField;
  label: string;
  sort: EmployeeSort;
  onSort: (field: EmployeeSortField) => void;
}) {
  const { t } = useTranslations();
  const isAscending = sort === field;
  const isDescending = sort === `-${field}`;
  const ariaLabel = t(
    isAscending
      ? "vacation.employees.sortDescending"
      : "vacation.employees.sortAscending",
    { column: label },
  );

  return (
    <th scope="col" className="px-2 py-1">
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => onSort(field)}
        className="flex min-h-9 w-full items-center gap-1.5 rounded px-2 text-left hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
      >
        <span>{label}</span>
        <SortIcon ascending={isAscending} descending={isDescending} />
      </button>
    </th>
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

function ExportIcon() {
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
      <path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5M4 11v5h12v-5" />
    </svg>
  );
}

function SortIcon({
  ascending,
  descending,
}: {
  ascending: boolean;
  descending: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-3.5 w-3.5 ${
        ascending || descending ? "text-blue-700" : "text-slate-400"
      }`}
    >
      {descending ? <path d="m4 6 4 4 4-4" /> : <path d="m4 10 4-4 4 4" />}
    </svg>
  );
}
