"use client";

import type { ReactNode } from "react";
import {
  formDangerSolidButtonClassName,
  formPrimaryButtonClassName,
  formSecondaryButtonClassName,
} from "@/components/form-field";

/**
 * Portal shared confirmation control (apps/portal/src/components).
 * Canonical inline confirmation for destructive or consequential actions.
 * Replaces browser-native confirm/alert dialogs and duplicated page-local panels.
 *
 * ConfirmDialog is not a notification: it must not auto-dismiss. Transient
 * operation results belong in PortalNotification.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  pending = false,
  confirmDisabled = false,
  destructive = false,
  onConfirm,
  onCancel,
  children,
}: {
  title?: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  confirmDisabled?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      role={destructive ? "alertdialog" : "status"}
      aria-modal={destructive || undefined}
      className={`rounded-lg border px-3.5 py-3.5 shadow-sm ${
        destructive
          ? "border-rose-200/70 bg-rose-50/55 dark:border-rose-900/40 dark:bg-rose-950/20"
          : "border-amber-200/70 bg-amber-50/55 dark:border-amber-800/45 dark:bg-amber-950/20"
      }`}
    >
      {title && (
        <h3
          className={`text-sm font-semibold tracking-tight ${
            destructive
              ? "text-rose-950 dark:text-rose-50"
              : "text-amber-950 dark:text-amber-50"
          }`}
        >
          {title}
        </h3>
      )}
      <p
        className={`${title ? "mt-1.5 " : ""}text-sm leading-snug ${
          destructive
            ? "text-rose-900 dark:text-rose-100"
            : "text-amber-900 dark:text-amber-100"
        }`}
      >
        {message}
      </p>
      {children && <div className="mt-3">{children}</div>}
      <div className="mt-3.5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || confirmDisabled}
          onClick={onConfirm}
          className={
            destructive
              ? formDangerSolidButtonClassName()
              : formPrimaryButtonClassName()
          }
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className={formSecondaryButtonClassName()}
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
