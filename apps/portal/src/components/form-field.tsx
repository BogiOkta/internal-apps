import type { ReactNode } from "react";

export function FormField({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs leading-5 text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function fieldDescriptionIds(
  id: string,
  hasError: boolean,
  hasHint = false,
) {
  return [
    hasHint ? `${id}-hint` : null,
    hasError ? `${id}-error` : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;
}

export function formControlClassName({
  readOnly = false,
  invalid = false,
}: {
  readOnly?: boolean;
  invalid?: boolean;
} = {}) {
  return `min-h-10 w-full rounded-md border px-3 py-2 text-sm text-slate-950 outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${
    invalid
      ? "border-red-400 focus:border-red-600 focus:ring-red-100"
      : "border-slate-300 focus:border-blue-600 focus:ring-blue-100"
  } ${readOnly ? "cursor-not-allowed bg-slate-100 text-slate-600" : "bg-white"}`;
}

export function formPrimaryButtonClassName() {
  return "inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
}

export function formSecondaryButtonClassName() {
  return "inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
}

export function formDangerButtonClassName() {
  return "inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
}
