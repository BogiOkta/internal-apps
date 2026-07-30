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
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  pending = false,
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
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      role={destructive ? "alertdialog" : "status"}
      aria-modal={destructive || undefined}
      className={`rounded-md border p-3 ${
        destructive
          ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
          : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
      }`}
    >
      {title && (
        <h3
          className={`font-semibold ${
            destructive
              ? "text-red-900 dark:text-red-100"
              : "text-amber-900 dark:text-amber-100"
          }`}
        >
          {title}
        </h3>
      )}
      <p
        className={`${title ? "mt-1 " : ""}text-sm ${
          destructive
            ? "text-red-900 dark:text-red-100"
            : "text-amber-900 dark:text-amber-100"
        }`}
      >
        {message}
      </p>
      {children && <div className="mt-3">{children}</div>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={pending}
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
