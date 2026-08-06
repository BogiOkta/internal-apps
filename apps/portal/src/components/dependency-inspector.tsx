"use client";

import type { ReactNode } from "react";
import {
  formPrimaryButtonClassName,
  formSecondaryButtonClassName,
} from "@/components/form-field";

/**
 * Portal shared Dependency Inspector (apps/portal/src/components).
 * Informational dialog that lists blocking dependencies when a protected
 * delete is refused. Domain-neutral: consumers supply localized title,
 * guidance, dependency rows (label, count, optional navigation), and action
 * buttons. Never deletes, never cascades, never auto-cleans, and never offers
 * an unprotected delete bypass.
 *
 * DependencyInspector is not a notification and must not auto-dismiss.
 */
export type DependencyInspectorItem = {
  /** Stable dependency type code supplied by the consumer (e.g. leave_requests). */
  id: string;
  /** Localized display label for the dependency type. */
  label: string;
  /** Number of remaining dependencies of this type. */
  count: number;
  /**
   * Optional navigation handler. When present the row is clickable and must
   * navigate to the destination that shows the relevant records. Consumers own
   * route and filter payload construction; this component stays domain-neutral.
   */
  onNavigate?: () => void;
  /** Optional note when the row is not navigable (e.g. historical-only data). */
  note?: string;
};

export type DependencyInspectorAction = {
  id: string;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
};

export function DependencyInspector({
  title,
  description,
  dependenciesHeading,
  items,
  emptyMessage,
  actions = [],
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  description: string;
  dependenciesHeading: string;
  items: DependencyInspectorItem[];
  emptyMessage?: string;
  actions?: DependencyInspectorAction[];
  closeLabel: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="dependency-inspector-title"
      aria-describedby="dependency-inspector-description"
      className="rounded-lg border border-amber-200/70 bg-amber-50/55 px-3.5 py-3.5 shadow-sm dark:border-amber-800/45 dark:bg-amber-950/20"
    >
      <h3
        id="dependency-inspector-title"
        className="text-sm font-semibold tracking-tight text-amber-950 dark:text-amber-50"
      >
        {title}
      </h3>

      <p
        id="dependency-inspector-description"
        className="mt-1.5 text-sm leading-snug text-amber-900 dark:text-amber-100"
      >
        {description}
      </p>

      <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
        {dependenciesHeading}
      </h4>

      {items.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {items.map((item) => {
            const label = `${item.label} (${item.count})`;
            if (item.onNavigate) {
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={item.onNavigate}
                    className="flex w-full items-start rounded-md border border-amber-200/80 bg-white/70 px-3 py-2 text-left text-sm font-medium text-amber-950 transition hover:border-sky-300 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-amber-800/50 dark:bg-slate-950/40 dark:text-amber-50 dark:hover:border-sky-700 dark:hover:bg-sky-950/40"
                  >
                    <span aria-hidden="true" className="mr-2 text-amber-700 dark:text-amber-300">
                      •
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="underline decoration-amber-400/70 underline-offset-2">
                        {label}
                      </span>
                      {item.note ? (
                        <span className="mt-0.5 block text-xs font-normal text-amber-800 dark:text-amber-200">
                          {item.note}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            }

            return (
              <li
                key={item.id}
                className="flex items-start rounded-md border border-transparent px-3 py-2 text-sm text-amber-950 dark:text-amber-50"
              >
                <span aria-hidden="true" className="mr-2 text-amber-700 dark:text-amber-300">
                  •
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{label}</span>
                  {item.note ? (
                    <span className="mt-0.5 block text-xs font-normal text-amber-800 dark:text-amber-200">
                      {item.note}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : emptyMessage ? (
        <p className="mt-2 text-sm text-amber-900 dark:text-amber-100">{emptyMessage}</p>
      ) : null}

      {children ? <div className="mt-3">{children}</div> : null}

      <div className="mt-3.5 flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={action.disabled}
            onClick={action.onClick}
            className={
              action.variant === "primary"
                ? formPrimaryButtonClassName()
                : formSecondaryButtonClassName()
            }
          >
            {action.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onClose}
          className={formSecondaryButtonClassName()}
        >
          {closeLabel}
        </button>
      </div>
    </div>
  );
}
