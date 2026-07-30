"use client";

import type { ReactNode } from "react";
import { formSecondaryButtonClassName } from "@/components/form-field";

export type PortalNotificationVariant =
  | "success"
  | "warning"
  | "error"
  | "info";

/**
 * Canonical Portal operation-feedback notification.
 * Use for success, warning, error, and info results of page operations.
 * Do not use for field/form validation (those stay next to the field).
 * Must be placed in a stable region that does not shift the primary grid.
 */
export function PortalNotification({
  variant,
  message,
  title,
  detail,
  dismissLabel,
  onDismiss,
}: {
  variant: PortalNotificationVariant;
  message: string;
  title?: string;
  detail?: ReactNode;
  dismissLabel: string;
  onDismiss?: () => void;
}) {
  const isError = variant === "error";
  const isWarning = variant === "warning";
  const tone = toneClasses(variant);

  return (
    <div
      role={isError || isWarning ? "alert" : "status"}
      aria-live={isError || isWarning ? "assertive" : "polite"}
      className={`rounded-md border px-3 py-2.5 text-sm ${tone.container}`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {title && (
            <p className={`font-semibold ${tone.title}`}>{title}</p>
          )}
          <p className={`${title ? "mt-0.5 " : ""}whitespace-pre-line ${tone.message}`}>
            {message}
          </p>
          {detail && <div className={`mt-1.5 ${tone.message}`}>{detail}</div>}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className={`${formSecondaryButtonClassName()} shrink-0 px-2 py-1 text-xs`}
          >
            {dismissLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function toneClasses(variant: PortalNotificationVariant) {
  switch (variant) {
    case "success":
      return {
        container:
          "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950",
        title: "text-emerald-950 dark:text-emerald-50",
        message: "text-emerald-900 dark:text-emerald-100",
      };
    case "warning":
      return {
        container:
          "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950",
        title: "text-amber-950 dark:text-amber-50",
        message: "text-amber-900 dark:text-amber-100",
      };
    case "error":
      return {
        container:
          "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950",
        title: "text-red-950 dark:text-red-50",
        message: "text-red-900 dark:text-red-100",
      };
    case "info":
      return {
        container:
          "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950",
        title: "text-blue-950 dark:text-blue-50",
        message: "text-blue-900 dark:text-blue-100",
      };
  }
}
