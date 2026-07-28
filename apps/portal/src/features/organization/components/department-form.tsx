"use client";

import { useState, type FormEvent } from "react";
import { FormField, formControlClassName } from "@/components/form-field";
import { useTranslations } from "@/i18n/use-translations";
import { ApiError } from "@/services/auth";
import type {
  CreateDepartmentRequest,
  Department,
  UpdateDepartmentRequest,
} from "@/types/organization";

type DepartmentFormProps = {
  mode: "create" | "edit";
  department?: Department;
  onCancel: () => void;
  onCreate: (request: CreateDepartmentRequest) => Promise<void>;
  onUpdate: (request: UpdateDepartmentRequest) => Promise<void>;
};

export function DepartmentForm({
  mode,
  department,
  onCancel,
  onCreate,
  onUpdate,
}: DepartmentFormProps) {
  const { t } = useTranslations();
  const [code, setCode] = useState(department?.code ?? "");
  const [name, setName] = useState(department?.name ?? "");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!code.trim() || !name.trim()) {
      setError(t("organization.departments.validationRequired"));
      return;
    }

    setIsSaving(true);
    try {
      if (mode === "create") {
        await onCreate({ code: code.trim(), name: name.trim(), isActive });
      } else {
        await onUpdate({ name: name.trim() });
      }
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.problem?.code : undefined;
      setError(
        code === "department_code_conflict"
          ? t("organization.departments.duplicateCode")
          : t("organization.departments.saveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      <FormField
        id="department-code"
        label={t("organization.departments.code")}
        required
        hint={mode === "edit" ? t("organization.departments.codeReadOnly") : undefined}
      >
        <input
          id="department-code"
          value={code}
          readOnly={mode === "edit"}
          maxLength={30}
          aria-describedby={mode === "edit" ? "department-code-hint" : undefined}
          onChange={(event) => setCode(event.target.value)}
          className={formControlClassName({ readOnly: mode === "edit" })}
        />
      </FormField>
      <FormField id="department-name" label={t("organization.departments.name")} required>
        <input
          id="department-name"
          value={name}
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
          className={formControlClassName()}
        />
      </FormField>
      {mode === "create" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          {t("organization.departments.initiallyActive")}
        </label>
      )}
      <div className="flex gap-2">
        <button
          disabled={isSaving}
          className="min-h-9 rounded-md bg-blue-700 px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isSaving
            ? t("organization.departments.saving")
            : t("organization.departments.save")}
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={onCancel}
          className="min-h-9 rounded-md border border-slate-300 px-3 text-sm font-medium disabled:opacity-50"
        >
          {t("organization.departments.cancel")}
        </button>
      </div>
    </form>
  );
}
