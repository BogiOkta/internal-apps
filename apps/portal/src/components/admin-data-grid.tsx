"use client";

import type { ReactNode } from "react";
import { PortalActionIcon } from "@/components/portal-action-icon";

export type GridSort<Field extends string> = {
  field: Field;
  direction: "asc" | "desc";
} | null;

export function AdministrativeGridShell({
  ariaLabel,
  toolbar,
  viewport,
  pagination,
  footer,
  detailsPanel,
  detailsNotification,
  fillViewport = false,
}: {
  ariaLabel: string;
  toolbar?: ReactNode;
  viewport: ReactNode;
  pagination?: ReactNode;
  footer?: ReactNode;
  detailsPanel?: ReactNode;
  /**
   * Stable operation-feedback region in the right rail, below details /
   * actions / confirmation. Retained for modules not yet migrated to the
   * top-center `PortalNotificationHost`. Must not be rendered above the
   * primary grid.
   */
  detailsNotification?: ReactNode;
  /**
   * When true, the shell participates in the authenticated viewport-fill flex
   * chain (`AdministrationPageBody` / `contentFillsViewport`). Height-collapse
   * classes must not apply without that parent chain or the grid collapses.
   */
  fillViewport?: boolean;
}) {
  return (
    <div
      className={[
        "grid min-h-0 gap-5 lg:gap-6",
        fillViewport ? "lg:h-0 lg:flex-1" : "",
        detailsPanel ? "lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-stretch" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <section
        aria-label={ariaLabel}
        className={[
          "flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm [contain:paint]",
          fillViewport ? "min-h-[24rem] lg:min-h-0" : "min-h-[24rem]",
        ].join(" ")}
      >
        {toolbar ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-300 bg-slate-50 px-4 py-3">
            {toolbar}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto">{viewport}</div>
        {pagination ? <div className="shrink-0">{pagination}</div> : null}
        {footer ? <div className="shrink-0">{footer}</div> : null}
      </section>
      {detailsPanel ? (
        <aside
          className={[
            "flex min-h-0 flex-col overflow-y-auto rounded-xl border border-slate-300 bg-slate-50 p-5 shadow-md",
            fillViewport ? "lg:min-h-0" : "min-h-[24rem]",
          ].join(" ")}
        >
          <div className="min-h-0 flex-1">{detailsPanel}</div>
          {detailsNotification ? (
            <div className="mt-4 shrink-0 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-600">
              {detailsNotification}
            </div>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}

export function nextGridSort<Field extends string>(
  sort: GridSort<Field>,
  field: Field,
): GridSort<Field> {
  if (!sort || sort.field !== field) {
    return { field, direction: "asc" };
  }

  return sort.direction === "asc"
    ? { field, direction: "desc" }
    : null;
}

export function SortableGridHeader<Field extends string>({
  field,
  label,
  sort,
  sortAscendingLabel,
  sortDescendingLabel,
  clearSortingLabel,
  onSort,
}: {
  field: Field;
  label: string;
  sort: GridSort<Field>;
  sortAscendingLabel: string;
  sortDescendingLabel: string;
  clearSortingLabel: string;
  onSort: (field: Field) => void;
}) {
  const isActive = sort?.field === field;
  const direction = isActive ? sort.direction : null;
  const nextLabel =
    direction === "asc"
      ? sortDescendingLabel
      : direction === "desc"
        ? clearSortingLabel
        : sortAscendingLabel;

  return (
    <th
      scope="col"
      aria-sort={
        direction === "asc"
          ? "ascending"
          : direction === "desc"
            ? "descending"
            : "none"
      }
      className="px-2 py-1"
    >
      <button
        type="button"
        aria-label={nextLabel}
        onClick={() => onSort(field)}
        className="flex min-h-9 w-full items-center gap-1.5 rounded px-2 text-left hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
      >
        <span>{label}</span>
        <span
          aria-hidden="true"
          className={isActive ? "text-blue-700" : "text-slate-400"}
        >
          {direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕"}
        </span>
      </button>
    </th>
  );
}

export function GridFilterRow({
  visible,
  children,
}: {
  visible: boolean;
  children: ReactNode;
}) {
  return visible ? (
    <tr className="border-t border-slate-200 bg-white normal-case tracking-normal">
      {children}
    </tr>
  ) : null;
}

export function GridFilterCell({ children }: { children?: ReactNode }) {
  return <th scope="col" className="px-2 py-2 font-normal">{children}</th>;
}

export function GridStateRows({
  columnCount,
  isLoading,
  hasError,
  isEmpty,
  loadingLabel,
  emptyTitle,
  emptyDescription,
}: {
  columnCount: number;
  isLoading: boolean;
  hasError: boolean;
  isEmpty: boolean;
  loadingLabel: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (isLoading) {
    return (
      <tr>
        <td colSpan={columnCount} className="px-4 py-10 text-center text-slate-500">
          {loadingLabel}
        </td>
      </tr>
    );
  }

  if (!hasError && isEmpty) {
    return (
      <tr>
        <td colSpan={columnCount} className="px-4 py-10 text-center">
          <p className="font-medium text-slate-900">{emptyTitle}</p>
          <p className="mt-1 text-sm text-slate-500">{emptyDescription}</p>
        </td>
      </tr>
    );
  }

  return null;
}

export function GridFooter({
  countLabel,
  selectionLabel,
}: {
  countLabel: string;
  selectionLabel: string;
}) {
  return (
    <div className="flex min-h-11 flex-col justify-between gap-1 border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600 sm:flex-row sm:items-center">
      <span>{countLabel}</span>
      <span>{selectionLabel}</span>
    </div>
  );
}

export function GridToolbarActions({
  activeFilterCount,
  areFiltersVisible,
  exportDisabled,
  filtersLabel,
  showFiltersLabel,
  hideFiltersLabel,
  clearFiltersLabel,
  exportLabel,
  exportCsvLabel,
  exportExcelLabel,
  onToggleFilters,
  onClearFilters,
  onExportCsv,
  onExportExcel,
}: {
  activeFilterCount: number;
  areFiltersVisible: boolean;
  exportDisabled: boolean;
  filtersLabel: string;
  showFiltersLabel: string;
  hideFiltersLabel: string;
  clearFiltersLabel: string;
  exportLabel: string;
  exportCsvLabel: string;
  exportExcelLabel: string;
  onToggleFilters: () => void;
  onClearFilters: () => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onToggleFilters}
        aria-expanded={areFiltersVisible}
        className="inline-flex min-h-9 items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
      >
        {areFiltersVisible ? hideFiltersLabel : showFiltersLabel}
        {activeFilterCount > 0 && (
          <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 text-xs text-blue-800">
            {activeFilterCount}
            <span className="sr-only"> {filtersLabel}</span>
          </span>
        )}
      </button>
      {activeFilterCount > 0 && (
        <button
          type="button"
          onClick={onClearFilters}
          className="inline-flex min-h-9 items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        >
          {clearFiltersLabel}
        </button>
      )}
      <details className="relative">
        <summary
          aria-disabled={exportDisabled}
          className={`inline-flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
            exportDisabled ? "pointer-events-none opacity-50" : "hover:bg-slate-50"
          }`}
        >
          <PortalActionIcon kind="export" />
          {exportLabel}
        </summary>
        <div className="absolute right-0 z-20 mt-1 min-w-40 rounded-md border border-slate-300 bg-white p-1 shadow-lg">
          <button type="button" onClick={onExportExcel} className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600">
            {exportExcelLabel}
          </button>
          <button type="button" onClick={onExportCsv} className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600">
            {exportCsvLabel}
          </button>
        </div>
      </details>
    </>
  );
}
