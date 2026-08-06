"use client";

import type { ReactNode } from "react";
import {
  formPrimaryButtonClassName,
  formSecondaryButtonClassName,
} from "@/components/form-field";

/**
 * Portal shared Dependency Inspector (apps/portal/src/components).
 * Informational dialog that lists blocking dependencies when a protected
 * delete is refused. Domain-neutral: consumers supply localized title, groups,
 * notes, and action buttons. Never deletes, never bypasses protection, and
 * never offers an unprotected delete bypass.
 *
 * DependencyInspector is not a notification and must not auto-dismiss.
 */
export type DependencyInspectorGroup = {
  id: string;
  label: string;
  details?: { id: string; label: string }[];
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
  referencedByLabel,
  groups,
  emptyReferencedMessage,
  actions,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  referencedByLabel: string;
  groups: DependencyInspectorGroup[];
  emptyReferencedMessage?: string;
  actions: DependencyInspectorAction[];
  closeLabel: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="dependency-inspector-title"
      className="rounded-lg border border-amber-200/70 bg-amber-50/55 px-3.5 py-3.5 shadow-sm dark:border-amber-800/45 dark:bg-amber-950/20"
    >
      <h3
        id="dependency-inspector-title"
        className="text-sm font-semibold tracking-tight text-amber-950 dark:text-amber-50"
      >
        {title}
      </h3>

      <p className="mt-1.5 text-sm leading-snug text-amber-900 dark:text-amber-100">
        {referencedByLabel}
      </p>

      {groups.length > 0 ? (
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-amber-950 dark:text-amber-50">
          {groups.map((group) => (
            <li key={group.id}>
              <span className="font-medium">{group.label}</span>
              {group.details && group.details.length > 0 ? (
                <ul className="mt-1 list-none space-y-0.5 pl-3 font-normal text-amber-900 dark:text-amber-100">
                  {group.details.map((detail) => (
                    <li key={detail.id}>- {detail.label}</li>
                  ))}
                </ul>
              ) : null}
              {group.note ? (
                <p className="mt-1 pl-3 font-normal text-amber-800 dark:text-amber-200">
                  {group.note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : emptyReferencedMessage ? (
        <p className="mt-3 text-sm text-amber-900 dark:text-amber-100">
          {emptyReferencedMessage}
        </p>
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
