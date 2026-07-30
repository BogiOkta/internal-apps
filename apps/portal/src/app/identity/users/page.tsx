"use client";

import Link from "next/link";
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
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CompanyAdministrationWorkspace } from "@/components/company-administration-workspace";
import {
  FormField,
  formControlClassName,
  formPrimaryButtonClassName,
  formSecondaryButtonClassName,
} from "@/components/form-field";
import { GridPagination } from "@/components/grid-pagination";
import { useTranslations } from "@/i18n/use-translations";
import {
  activateUser,
  ApiError,
  createUser,
  deactivateUser,
  listUsers,
} from "@/services/auth";
import { usersManagePermission, type ManagedUser } from "@/types/auth";
import {
  exportGridCsv,
  exportGridXlsx,
  type ExportColumn,
} from "@/utils/admin-grid-export";

type UserSortField = "username" | "displayName" | "roles" | "status";
type UserStatusFilter = "all" | "active" | "inactive";

export default function UsersPage() {
  const { accessToken, user } = useAuth();
  const { t } = useTranslations();
  const canManage = user?.permissions.includes(usersManagePermission) ?? false;
  const [userResult, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<UserStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState<GridSort<UserSortField>>({
    field: "username",
    direction: "asc",
  });
  const [areFiltersVisible, setAreFiltersVisible] = useState(false);
  const [panelMode, setPanelMode] = useState<"details" | "create">("details");
  const [selectedUserPublicId, setSelectedUserPublicId] = useState<string | null>(
    null,
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [isConfirmingStatus, setIsConfirmingStatus] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
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

    listUsers(accessToken)
      .then((result) => {
        if (controller.signal.aborted) {
          return;
        }
        setUsers(result);
        setSelectedUserPublicId((currentSelection) =>
          currentSelection &&
          result.some((item) => item.publicId === currentSelection)
            ? currentSelection
            : null,
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setUsers([]);
          setSelectedUserPublicId(null);
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

  const users = useMemo(() => {
    const normalizedSearch = debouncedSearch.toLocaleLowerCase();
    const filtered = userResult.filter((item) => {
      if (status === "active" && !item.isActive) {
        return false;
      }
      if (status === "inactive" && item.isActive) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return (
        item.username.toLocaleLowerCase().includes(normalizedSearch) ||
        item.displayName.toLocaleLowerCase().includes(normalizedSearch) ||
        item.roles.some((role) =>
          role.toLocaleLowerCase().includes(normalizedSearch),
        )
      );
    });
    return [...filtered].sort((left, right) => compareUsers(left, right, sort));
  }, [userResult, debouncedSearch, status, sort]);

  const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
  const visibleUsers = useMemo(
    () => users.slice((page - 1) * pageSize, page * pageSize),
    [users, page, pageSize],
  );
  const selectedUser = useMemo(
    () => users.find((item) => item.publicId === selectedUserPublicId) ?? null,
    [users, selectedUserPublicId],
  );
  const activeFilterCount = status === "all" ? 0 : 1;

  useEffect(() => setPage(1), [debouncedSearch, status, sort, pageSize]);
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  async function changeStatus() {
    if (!accessToken || !selectedUser) {
      return;
    }
    setWriteError(null);
    try {
      if (selectedUser.isActive) {
        await deactivateUser(accessToken, selectedUser.publicId);
      } else {
        await activateUser(accessToken, selectedUser.publicId);
      }
      setFeedback(
        selectedUser.isActive
          ? t("identity.users.deactivated")
          : t("identity.users.activated"),
      );
      setIsConfirmingStatus(false);
      setRefreshVersion((value) => value + 1);
    } catch {
      setWriteError(t("identity.users.stateFailed"));
    }
  }

  async function exportUsers(format: "csv" | "xlsx") {
    setExportError(false);
    if (users.length === 0) {
      setExportError(true);
      return;
    }
    const columns: ExportColumn<ManagedUser>[] = [
      {
        heading: t("identity.users.username"),
        value: (row) => row.username,
        width: 20,
      },
      {
        heading: t("identity.users.displayName"),
        value: (row) => row.displayName,
        width: 28,
      },
      {
        heading: t("identity.users.roles"),
        value: (row) => row.roles.join(", "),
        width: 28,
      },
      {
        heading: t("identity.users.status"),
        value: (row) =>
          row.isActive ? t("identity.users.active") : t("identity.users.inactive"),
        width: 14,
      },
    ];
    try {
      if (format === "csv") {
        exportGridCsv(users, columns, "users.csv");
      } else {
        await exportGridXlsx(
          users,
          columns,
          "users.xlsx",
          t("identity.users.exportSheet"),
        );
      }
    } catch {
      setExportError(true);
    }
  }

  if (!canManage) {
    return (
      <CompanyAdministrationWorkspace title={t("identity.users.title")}>
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800"
        >
          {t("identity.users.forbidden")}
        </div>
      </CompanyAdministrationWorkspace>
    );
  }

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          setFeedback(null);
          setWriteError(null);
          setIsConfirmingStatus(false);
          setPanelMode("create");
        }}
        className={formPrimaryButtonClassName()}
      >
        {t("identity.users.new")}
      </button>
      <button
        type="button"
        onClick={() => setRefreshVersion((value) => value + 1)}
        disabled={isLoading}
        className={formSecondaryButtonClassName()}
      >
        {isLoading
          ? t("identity.users.refreshing")
          : t("identity.users.refresh")}
      </button>
    </div>
  );

  return (
    <CompanyAdministrationWorkspace
      title={t("identity.users.title")}
      description={t("identity.users.description")}
      headerActions={headerActions}
      contentFillsViewport
    >
      <AdministrationPageBody>
        {feedback && (
          <div
            role="status"
            className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            {feedback}{" "}
            <Link
              className="font-semibold underline"
              href="/organization/user-employee-links"
            >
              {t("identity.users.linkEmployee")}
            </Link>
          </div>
        )}
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
            {users.length === 0
              ? t("grid.noExportRows")
              : t("grid.exportFailure")}
          </div>
        )}

        <AdministrativeGridShell
          ariaLabel={t("identity.users.tableLabel")}
          fillViewport
          toolbar={
            <AdministrativeGridToolbar
              search={search}
              searchLabel={t("identity.users.searchLabel")}
              searchPlaceholder={t("identity.users.searchPlaceholder")}
              onSearchChange={setSearch}
              activeFilterCount={activeFilterCount}
              areFiltersVisible={areFiltersVisible}
              exportDisabled={users.length === 0}
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
              onExportCsv={() => void exportUsers("csv")}
              onExportExcel={() => void exportUsers("xlsx")}
            />
          }
          viewport={
            <table
              aria-busy={isLoading}
              className="w-full min-w-[720px] border-collapse text-left text-sm"
            >
              <thead className="sticky top-0 z-10 border-b border-slate-300 bg-slate-100 text-xs font-semibold text-slate-600">
                <tr>
                  <SortableGridHeader
                    field="username"
                    label={t("identity.users.username")}
                    sort={sort}
                    sortAscendingLabel={t("grid.sortAscending", {
                      column: t("identity.users.username"),
                    })}
                    sortDescendingLabel={t("grid.sortDescending", {
                      column: t("identity.users.username"),
                    })}
                    clearSortingLabel={t("grid.clearSorting", {
                      column: t("identity.users.username"),
                    })}
                    onSort={(field) =>
                      setSort((current) => nextGridSort(current, field))
                    }
                  />
                  <SortableGridHeader
                    field="displayName"
                    label={t("identity.users.displayName")}
                    sort={sort}
                    sortAscendingLabel={t("grid.sortAscending", {
                      column: t("identity.users.displayName"),
                    })}
                    sortDescendingLabel={t("grid.sortDescending", {
                      column: t("identity.users.displayName"),
                    })}
                    clearSortingLabel={t("grid.clearSorting", {
                      column: t("identity.users.displayName"),
                    })}
                    onSort={(field) =>
                      setSort((current) => nextGridSort(current, field))
                    }
                  />
                  <SortableGridHeader
                    field="roles"
                    label={t("identity.users.roles")}
                    sort={sort}
                    sortAscendingLabel={t("grid.sortAscending", {
                      column: t("identity.users.roles"),
                    })}
                    sortDescendingLabel={t("grid.sortDescending", {
                      column: t("identity.users.roles"),
                    })}
                    clearSortingLabel={t("grid.clearSorting", {
                      column: t("identity.users.roles"),
                    })}
                    onSort={(field) =>
                      setSort((current) => nextGridSort(current, field))
                    }
                  />
                  <SortableGridHeader
                    field="status"
                    label={t("identity.users.status")}
                    sort={sort}
                    sortAscendingLabel={t("grid.sortAscending", {
                      column: t("identity.users.status"),
                    })}
                    sortDescendingLabel={t("grid.sortDescending", {
                      column: t("identity.users.status"),
                    })}
                    clearSortingLabel={t("grid.clearSorting", {
                      column: t("identity.users.status"),
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
                        {t("identity.users.statusFilter")}
                      </span>
                      <select
                        value={status}
                        onChange={(event) =>
                          setStatus(event.target.value as UserStatusFilter)
                        }
                        className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                      >
                        <option value="all">
                          {t("identity.users.allStatuses")}
                        </option>
                        <option value="active">
                          {t("identity.users.active")}
                        </option>
                        <option value="inactive">
                          {t("identity.users.inactive")}
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
                  isEmpty={users.length === 0}
                  loadingLabel={t("identity.users.loading")}
                  emptyTitle={t("identity.users.empty")}
                  emptyDescription={t("identity.users.emptyDescription")}
                />
                {!isLoading &&
                  !hasError &&
                  visibleUsers.map((item) => {
                    const isSelected = item.publicId === selectedUserPublicId;
                    return (
                      <tr
                        key={item.publicId}
                        aria-selected={isSelected}
                        onClick={() => {
                          setIsConfirmingStatus(false);
                          setWriteError(null);
                          setPanelMode("details");
                          setSelectedUserPublicId(item.publicId);
                        }}
                        className={`cursor-pointer hover:bg-slate-50 ${
                          isSelected
                            ? "bg-blue-50 shadow-[inset_3px_0_0_#1d4ed8]"
                            : "bg-white"
                        }`}
                      >
                        <td className="whitespace-nowrap px-4 py-3">
                          <button
                            type="button"
                            aria-pressed={isSelected}
                            onClick={(event) => {
                              event.stopPropagation();
                              setPanelMode("details");
                              setSelectedUserPublicId(item.publicId);
                            }}
                            className="rounded-sm text-left font-semibold text-slate-950 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                          >
                            {item.username}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {item.displayName}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {item.roles.join(", ")}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <UserStatus isActive={item.isActive} />
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
              totalCount={users.length}
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
            <div aria-label={t("identity.users.details")}>
              <h2 className="mb-4 text-lg font-semibold text-slate-950">
                {panelMode === "create"
                  ? t("identity.users.new")
                  : t("identity.users.details")}
              </h2>
              {panelMode === "create" ? (
                <CreateUserForm
                  onCancel={() => setPanelMode("details")}
                  onCreated={async () => {
                    setPanelMode("details");
                    setFeedback(t("identity.users.created"));
                    setRefreshVersion((value) => value + 1);
                  }}
                />
              ) : selectedUser ? (
                <div className="space-y-3 text-sm">
                  <Detail
                    label={t("identity.users.username")}
                    value={selectedUser.username}
                  />
                  <Detail
                    label={t("identity.users.displayName")}
                    value={selectedUser.displayName}
                  />
                  <Detail
                    label={t("identity.users.roles")}
                    value={selectedUser.roles.join(", ")}
                  />
                  <Detail
                    label={t("identity.users.status")}
                    value={
                      selectedUser.isActive
                        ? t("identity.users.active")
                        : t("identity.users.inactive")
                    }
                  />
                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsConfirmingStatus(true)}
                      className={formSecondaryButtonClassName()}
                    >
                      {selectedUser.isActive
                        ? t("identity.users.deactivate")
                        : t("identity.users.activate")}
                    </button>
                    {isConfirmingStatus && (
                      <ConfirmDialog
                        message={
                          selectedUser.isActive
                            ? t("identity.users.deactivateConfirm")
                            : t("identity.users.activateConfirm")
                        }
                        confirmLabel={t("identity.users.confirm")}
                        cancelLabel={t("identity.users.cancel")}
                        onConfirm={() => void changeStatus()}
                        onCancel={() => setIsConfirmingStatus(false)}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  {t("identity.users.selectForDetails")}
                </p>
              )}
            </div>
          }
        />
      </AdministrationPageBody>
    </CompanyAdministrationWorkspace>
  );
}

function CreateUserForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => Promise<void>;
}) {
  const { accessToken } = useAuth();
  const { t } = useTranslations();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const clientErrors: Record<string, string> = {};
    if (!username.trim()) {
      clientErrors.username = t("identity.users.usernameRequired");
    }
    if (!displayName.trim()) {
      clientErrors.displayName = t("identity.users.displayNameRequired");
    }
    if (password.length < 12) {
      clientErrors.initialPassword = t("identity.users.passwordMinimum");
    }
    if (password !== confirm) {
      clientErrors.confirmPassword = t("identity.users.passwordMismatch");
    }
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }
    if (!accessToken) {
      setError(t("identity.users.saveFailed"));
      return;
    }
    setIsSubmitting(true);
    try {
      await createUser(accessToken, {
        username,
        displayName,
        initialPassword: password,
        isActive: active,
      });
      setPassword("");
      setConfirm("");
      await onCreated();
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        cause.problem?.code === "identity_username_conflict"
      ) {
        setFieldErrors({ username: t("identity.users.duplicate") });
        return;
      }
      if (
        cause instanceof ApiError &&
        cause.problem?.code === "validation_failed"
      ) {
        const serverErrors: Record<string, string> = {};
        if (cause.problem.errors?.username) {
          serverErrors.username = t("identity.users.usernameRequired");
        }
        if (cause.problem.errors?.displayName) {
          serverErrors.displayName = t("identity.users.displayNameRequired");
        }
        if (cause.problem.errors?.initialPassword) {
          serverErrors.initialPassword = t("identity.users.passwordMinimum");
        }
        if (Object.keys(serverErrors).length > 0) {
          setFieldErrors(serverErrors);
          return;
        }
      }
      setError(t("identity.users.saveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function field(
    id: string,
    name: string,
    label: string,
    value: string,
    set: (value: string) => void,
    type = "text",
  ) {
    const fieldError = fieldErrors[name];
    return (
      <FormField id={id} label={label} required error={fieldError}>
        <input
          id={id}
          type={type}
          value={value}
          aria-invalid={Boolean(fieldError)}
          aria-describedby={fieldError ? `${id}-error` : undefined}
          onChange={(event) => {
            set(event.target.value);
            setFieldErrors((current) => {
              const next = { ...current };
              delete next[name];
              return next;
            });
          }}
          className={formControlClassName({ invalid: Boolean(fieldError) })}
        />
      </FormField>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {field(
        "user-username",
        "username",
        t("identity.users.username"),
        username,
        setUsername,
      )}
      {field(
        "user-display-name",
        "displayName",
        t("identity.users.displayName"),
        displayName,
        setDisplayName,
      )}
      {field(
        "user-password",
        "initialPassword",
        t("identity.users.initialPassword"),
        password,
        setPassword,
        "password",
      )}
      {field(
        "user-password-confirm",
        "confirmPassword",
        t("identity.users.confirmPassword"),
        confirm,
        setConfirm,
        "password",
      )}
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
        />
        {t("identity.users.initiallyActive")}
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className={formPrimaryButtonClassName()}
        >
          {t("identity.users.save")}
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={onCancel}
          className={formSecondaryButtonClassName()}
        >
          {t("identity.users.cancel")}
        </button>
      </div>
    </form>
  );
}

function UserStatus({ isActive }: { isActive: boolean }) {
  const { t } = useTranslations();
  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${
        isActive
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-slate-300 bg-slate-100 text-slate-700"
      }`}
    >
      {isActive ? t("identity.users.active") : t("identity.users.inactive")}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <dl>
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-950">{value}</dd>
    </dl>
  );
}

function compareUsers(
  left: ManagedUser,
  right: ManagedUser,
  sort: GridSort<UserSortField>,
) {
  const activeSort = sort ?? { field: "username" as const, direction: "asc" as const };
  const value = (item: ManagedUser) =>
    ({
      username: item.username,
      displayName: item.displayName,
      roles: item.roles.join(", "),
      status: item.isActive ? "Active" : "Inactive",
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
