"use client";

import { useEffect, useMemo, useState } from "react";
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
import { CompanyAdministrationWorkspace } from "@/components/company-administration-workspace";
import {
  formPrimaryButtonClassName,
  formSecondaryButtonClassName,
} from "@/components/form-field";
import { GridPagination } from "@/components/grid-pagination";
import { SearchableCombobox } from "@/components/searchable-combobox";
import { useTranslations } from "@/i18n/use-translations";
import {
  createUserEmployeeLink,
  getUserEmployeeLinkOptions,
  getUserEmployeeLinks,
  unlinkUserEmployee,
  updateUserEmployeeLink,
} from "@/services/organization";
import {
  userEmployeeLinksManagePermission,
  type UserEmployeeLink,
  type UserEmployeeLinkOptions,
} from "@/types/organization";
import {
  exportGridCsv,
  exportGridXlsx,
  type ExportColumn,
} from "@/utils/admin-grid-export";

type LinkSortField = "user" | "employee" | "department" | "status";
type LinkStatusFilter = "all" | "active" | "inactive";

export default function UserEmployeeLinksPage() {
  const { accessToken, user } = useAuth();
  const { t } = useTranslations();
  const canManage =
    user?.permissions.includes(userEmployeeLinksManagePermission) ?? false;
  const [linkResult, setLinks] = useState<UserEmployeeLink[]>([]);
  const [options, setOptions] = useState<UserEmployeeLinkOptions>({
    users: [],
    employees: [],
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<LinkStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState<GridSort<LinkSortField>>({
    field: "user",
    direction: "asc",
  });
  const [areFiltersVisible, setAreFiltersVisible] = useState(false);
  const [panelMode, setPanelMode] = useState<"details" | "create" | "edit">(
    "details",
  );
  const [selectedLinkPublicId, setSelectedLinkPublicId] = useState<string | null>(
    null,
  );
  const [userId, setUserId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingUnlink, setIsConfirmingUnlink] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!accessToken || !canManage) {
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setHasError(false);

    Promise.all([
      getUserEmployeeLinks(accessToken),
      getUserEmployeeLinkOptions(accessToken),
    ])
      .then(([linkRows, optionRows]) => {
        if (controller.signal.aborted) {
          return;
        }
        setLinks(linkRows);
        setOptions(optionRows);
        setSelectedLinkPublicId((currentSelection) =>
          currentSelection &&
          linkRows.some((row) => row.publicId === currentSelection)
            ? currentSelection
            : null,
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLinks([]);
          setOptions({ users: [], employees: [] });
          setSelectedLinkPublicId(null);
          setHasError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [accessToken, canManage, refreshVersion]);

  const links = useMemo(() => {
    const normalizedSearch = debouncedSearch.toLocaleLowerCase();
    const filtered = linkResult.filter((link) => {
      const isActive = link.employee.employmentStatus === "Active";
      if (status === "active" && !isActive) {
        return false;
      }
      if (status === "inactive" && isActive) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      const employeeName =
        `${link.employee.firstName} ${link.employee.lastName}`.toLocaleLowerCase();
      return (
        link.userDisplayName.toLocaleLowerCase().includes(normalizedSearch) ||
        link.username.toLocaleLowerCase().includes(normalizedSearch) ||
        employeeName.includes(normalizedSearch) ||
        link.employee.employeeNumber
          .toLocaleLowerCase()
          .includes(normalizedSearch) ||
        link.employee.departmentName
          .toLocaleLowerCase()
          .includes(normalizedSearch)
      );
    });
    return [...filtered].sort((left, right) => compareLinks(left, right, sort));
  }, [linkResult, debouncedSearch, status, sort]);

  const totalPages = Math.max(1, Math.ceil(links.length / pageSize));
  const visibleLinks = useMemo(
    () => links.slice((page - 1) * pageSize, page * pageSize),
    [links, page, pageSize],
  );
  const selectedLink = useMemo(
    () => links.find((link) => link.publicId === selectedLinkPublicId) ?? null,
    [links, selectedLinkPublicId],
  );
  const activeFilterCount = status === "all" ? 0 : 1;

  useEffect(() => setPage(1), [debouncedSearch, status, sort, pageSize]);
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const userOptions = useMemo(
    () =>
      options.users.map((item) => ({
        value: item.publicId,
        label: item.displayName,
        description: item.username,
        disabled: !item.isActive,
      })),
    [options.users],
  );
  const employeeOptions = useMemo(
    () =>
      options.employees.map((item) => ({
        value: item.publicId,
        label: `${item.firstName} ${item.lastName}`,
        description: `${item.employeeNumber} · ${item.departmentName}`,
        disabled: !item.isActive,
      })),
    [options.employees],
  );

  function beginCreate() {
    setSelectedLinkPublicId(null);
    setUserId("");
    setEmployeeId("");
    setWriteError(null);
    setIsConfirmingUnlink(false);
    setPanelMode("create");
  }

  function beginEdit(link: UserEmployeeLink) {
    setSelectedLinkPublicId(link.publicId);
    setUserId(link.userPublicId);
    setEmployeeId(link.employee.publicId);
    setWriteError(null);
    setIsConfirmingUnlink(false);
    setPanelMode("edit");
  }

  async function save() {
    if (!accessToken || !userId || !employeeId) {
      setWriteError(t("organization.links.required"));
      return;
    }
    setIsSaving(true);
    setWriteError(null);
    try {
      if (selectedLink && panelMode === "edit") {
        await updateUserEmployeeLink(
          accessToken,
          selectedLink.publicId,
          userId,
          employeeId,
        );
      } else {
        await createUserEmployeeLink(accessToken, userId, employeeId);
      }
      setPanelMode("details");
      setSelectedLinkPublicId(null);
      setUserId("");
      setEmployeeId("");
      setIsConfirmingUnlink(false);
      setRefreshVersion((value) => value + 1);
    } catch (cause) {
      const code =
        cause && typeof cause === "object" && "problem" in cause
          ? (cause as { problem?: { code?: string } }).problem?.code
          : undefined;
      setWriteError(
        code === "user_employee_link_user_conflict"
          ? t("organization.links.userConflict")
          : code === "user_employee_link_employee_conflict"
            ? t("organization.links.employeeConflict")
            : code === "user_employee_link_employee_inactive"
              ? t("organization.links.inactiveEmployee")
              : t("organization.links.saveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function unlink(link: UserEmployeeLink) {
    if (!accessToken) {
      return;
    }
    setIsSaving(true);
    setWriteError(null);
    try {
      await unlinkUserEmployee(accessToken, link.publicId);
      setPanelMode("details");
      setSelectedLinkPublicId(null);
      setUserId("");
      setEmployeeId("");
      setIsConfirmingUnlink(false);
      setRefreshVersion((value) => value + 1);
    } catch {
      setWriteError(t("organization.links.unlinkFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  async function exportLinks(format: "csv" | "xlsx") {
    setExportError(false);
    if (links.length === 0) {
      setExportError(true);
      return;
    }
    const columns: ExportColumn<UserEmployeeLink>[] = [
      {
        heading: t("organization.links.user"),
        value: (row) => `${row.userDisplayName} (${row.username})`,
        width: 28,
      },
      {
        heading: t("organization.links.employee"),
        value: (row) =>
          `${row.employee.firstName} ${row.employee.lastName} (${row.employee.employeeNumber})`,
        width: 32,
      },
      {
        heading: t("vacation.employees.department"),
        value: (row) => row.employee.departmentName,
        width: 24,
      },
      {
        heading: t("vacation.employees.status"),
        value: (row) =>
          row.employee.employmentStatus === "Active"
            ? t("vacation.employees.active")
            : t("vacation.employees.inactive"),
        width: 14,
      },
    ];
    try {
      if (format === "csv") {
        exportGridCsv(links, columns, "user-employee-links.csv");
      } else {
        await exportGridXlsx(
          links,
          columns,
          "user-employee-links.xlsx",
          t("organization.links.exportSheet"),
        );
      }
    } catch {
      setExportError(true);
    }
  }

  if (!canManage) {
    return (
      <CompanyAdministrationWorkspace title={t("organization.links.title")}>
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800"
        >
          {t("organization.links.forbidden")}
        </div>
      </CompanyAdministrationWorkspace>
    );
  }

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={beginCreate}
        className={formPrimaryButtonClassName()}
      >
        {t("organization.links.new")}
      </button>
      <button
        type="button"
        onClick={() => setRefreshVersion((value) => value + 1)}
        disabled={isLoading}
        className={formSecondaryButtonClassName()}
      >
        {isLoading
          ? t("organization.links.refreshing")
          : t("organization.links.refresh")}
      </button>
    </div>
  );

  return (
    <CompanyAdministrationWorkspace
      title={t("organization.links.title")}
      description={t("organization.links.description")}
      headerActions={headerActions}
      contentFillsViewport
    >
      <AdministrationPageBody>
        {writeError && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {writeError}
          </div>
        )}
        {exportError && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {links.length === 0
              ? t("grid.noExportRows")
              : t("grid.exportFailure")}
          </div>
        )}

        <AdministrativeGridShell
          ariaLabel={t("organization.links.tableLabel")}
          fillViewport
          toolbar={
            <AdministrativeGridToolbar
              search={search}
              searchLabel={t("organization.links.searchLabel")}
              searchPlaceholder={t("organization.links.searchPlaceholder")}
              onSearchChange={setSearch}
              activeFilterCount={activeFilterCount}
              areFiltersVisible={areFiltersVisible}
              exportDisabled={links.length === 0}
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
              onClearFilters={() => setStatus("all")}
              onExportCsv={() => void exportLinks("csv")}
              onExportExcel={() => void exportLinks("xlsx")}
            />
          }
          viewport={
            <table
              aria-busy={isLoading}
              className="w-full min-w-[760px] border-collapse text-left text-sm"
            >
              <thead className="sticky top-0 z-10 border-b border-slate-300 bg-slate-100 text-xs font-semibold text-slate-600">
                <tr>
                  <SortableGridHeader
                    field="user"
                    label={t("organization.links.user")}
                    sort={sort}
                    sortAscendingLabel={t("grid.sortAscending", {
                      column: t("organization.links.user"),
                    })}
                    sortDescendingLabel={t("grid.sortDescending", {
                      column: t("organization.links.user"),
                    })}
                    clearSortingLabel={t("grid.clearSorting", {
                      column: t("organization.links.user"),
                    })}
                    onSort={(field) =>
                      setSort((current) => nextGridSort(current, field))
                    }
                  />
                  <SortableGridHeader
                    field="employee"
                    label={t("organization.links.employee")}
                    sort={sort}
                    sortAscendingLabel={t("grid.sortAscending", {
                      column: t("organization.links.employee"),
                    })}
                    sortDescendingLabel={t("grid.sortDescending", {
                      column: t("organization.links.employee"),
                    })}
                    clearSortingLabel={t("grid.clearSorting", {
                      column: t("organization.links.employee"),
                    })}
                    onSort={(field) =>
                      setSort((current) => nextGridSort(current, field))
                    }
                  />
                  <SortableGridHeader
                    field="department"
                    label={t("vacation.employees.department")}
                    sort={sort}
                    sortAscendingLabel={t("grid.sortAscending", {
                      column: t("vacation.employees.department"),
                    })}
                    sortDescendingLabel={t("grid.sortDescending", {
                      column: t("vacation.employees.department"),
                    })}
                    clearSortingLabel={t("grid.clearSorting", {
                      column: t("vacation.employees.department"),
                    })}
                    onSort={(field) =>
                      setSort((current) => nextGridSort(current, field))
                    }
                  />
                  <SortableGridHeader
                    field="status"
                    label={t("vacation.employees.status")}
                    sort={sort}
                    sortAscendingLabel={t("grid.sortAscending", {
                      column: t("vacation.employees.status"),
                    })}
                    sortDescendingLabel={t("grid.sortDescending", {
                      column: t("vacation.employees.status"),
                    })}
                    clearSortingLabel={t("grid.clearSorting", {
                      column: t("vacation.employees.status"),
                    })}
                    onSort={(field) =>
                      setSort((current) => nextGridSort(current, field))
                    }
                  />
                </tr>
                <GridFilterRow visible={areFiltersVisible}>
                  <GridFilterCell />
                  <GridFilterCell />
                  <GridFilterCell />
                  <GridFilterCell>
                    <label>
                      <span className="sr-only">
                        {t("organization.links.statusFilter")}
                      </span>
                      <select
                        value={status}
                        onChange={(event) =>
                          setStatus(event.target.value as LinkStatusFilter)
                        }
                        className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                      >
                        <option value="all">
                          {t("organization.links.allStatuses")}
                        </option>
                        <option value="active">
                          {t("vacation.employees.active")}
                        </option>
                        <option value="inactive">
                          {t("vacation.employees.inactive")}
                        </option>
                      </select>
                    </label>
                  </GridFilterCell>
                </GridFilterRow>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <GridStateRows
                  columnCount={4}
                  isLoading={isLoading}
                  hasError={hasError}
                  isEmpty={links.length === 0}
                  loadingLabel={t("organization.links.loading")}
                  emptyTitle={t("organization.links.emptyTitle")}
                  emptyDescription={t("organization.links.emptyDescription")}
                />
                {!isLoading &&
                  !hasError &&
                  visibleLinks.map((link) => {
                    const isSelected = link.publicId === selectedLinkPublicId;
                    return (
                      <tr
                        key={link.publicId}
                        aria-selected={isSelected}
                        onClick={() => beginEdit(link)}
                        className={`cursor-pointer hover:bg-slate-50 ${
                          isSelected
                            ? "bg-blue-50 shadow-[inset_3px_0_0_#1d4ed8]"
                            : "bg-white"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            aria-pressed={isSelected}
                            onClick={(event) => {
                              event.stopPropagation();
                              beginEdit(link);
                            }}
                            className="rounded-sm text-left font-semibold text-slate-950 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                          >
                            {link.userDisplayName}
                          </button>
                          <span className="block text-xs text-slate-500">
                            {link.username}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {link.employee.firstName} {link.employee.lastName}
                          <span className="block text-xs text-slate-500">
                            {link.employee.employeeNumber}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {link.employee.departmentName}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <EmployeeStatus
                            isActive={link.employee.employmentStatus === "Active"}
                          />
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
              totalCount={links.length}
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
            <div aria-label={t("organization.links.details")}>
              <h2 className="mb-4 text-lg font-semibold text-slate-950">
                {panelMode === "create"
                  ? t("organization.links.new")
                  : panelMode === "edit"
                    ? t("organization.links.edit")
                    : t("organization.links.details")}
              </h2>
              {panelMode === "create" || panelMode === "edit" ? (
                <div className="space-y-4">
                  <SearchableCombobox
                    label={t("organization.links.user")}
                    value={userId}
                    options={userOptions}
                    placeholder={t("organization.links.searchUser")}
                    emptyText={t("organization.links.noOptions")}
                    clearLabel={t("organization.links.clear")}
                    onChange={setUserId}
                  />
                  <SearchableCombobox
                    label={t("organization.links.employee")}
                    value={employeeId}
                    options={employeeOptions}
                    placeholder={t("organization.links.searchEmployee")}
                    emptyText={t("organization.links.noOptions")}
                    clearLabel={t("organization.links.clear")}
                    onChange={setEmployeeId}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void save()}
                      className={formPrimaryButtonClassName()}
                    >
                      {t("organization.links.save")}
                    </button>
                    {panelMode === "edit" && selectedLink && (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => setIsConfirmingUnlink(true)}
                        className={formSecondaryButtonClassName()}
                      >
                        {t("organization.links.unlink")}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        setPanelMode("details");
                        setIsConfirmingUnlink(false);
                        setWriteError(null);
                      }}
                      className={formSecondaryButtonClassName()}
                    >
                      {t("organization.links.cancel")}
                    </button>
                  </div>
                  {panelMode === "edit" &&
                    selectedLink &&
                    isConfirmingUnlink && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                        <p className="text-sm text-amber-900">
                          {t("organization.links.unlinkConfirmation")}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => void unlink(selectedLink)}
                            className={formPrimaryButtonClassName()}
                          >
                            {t("organization.links.confirm")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsConfirmingUnlink(false)}
                            className={formSecondaryButtonClassName()}
                          >
                            {t("organization.links.cancel")}
                          </button>
                        </div>
                      </div>
                    )}
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  {t("organization.links.selectForDetails")}
                </p>
              )}
            </div>
          }
        />
      </AdministrationPageBody>
    </CompanyAdministrationWorkspace>
  );
}

function EmployeeStatus({ isActive }: { isActive: boolean }) {
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
        ? t("vacation.employees.active")
        : t("vacation.employees.inactive")}
    </span>
  );
}

function compareLinks(
  left: UserEmployeeLink,
  right: UserEmployeeLink,
  sort: GridSort<LinkSortField>,
) {
  const activeSort = sort ?? { field: "user" as const, direction: "asc" as const };
  const value = (link: UserEmployeeLink) =>
    ({
      user: link.userDisplayName,
      employee: `${link.employee.firstName} ${link.employee.lastName}`,
      department: link.employee.departmentName,
      status: link.employee.employmentStatus,
    })[activeSort.field];
  const comparison = value(left).localeCompare(value(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
  const ordered = activeSort.direction === "desc" ? -comparison : comparison;
  return (
    ordered ||
    left.username.localeCompare(right.username, undefined, {
      numeric: true,
      sensitivity: "base",
    }) ||
    left.publicId.localeCompare(right.publicId)
  );
}
