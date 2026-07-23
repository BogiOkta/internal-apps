"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTranslations } from "@/i18n/use-translations";
import { ApiError } from "@/services/auth";
import {
  fieldDescriptionIds,
  FormField,
  formControlClassName,
} from "@/components/form-field";
import type {
  CreateLeaveTypeRequest,
  LeaveTypeDetails,
  UpdateLeaveTypeRequest,
} from "@/types/vacation";

type LeaveTypeFormValues = {
  code: string;
  nameSr: string;
  nameEn: string;
  descriptionSr: string;
  descriptionEn: string;
  calendarColor: string;
  countsAgainstVacationBalance: boolean;
  requiresApproval: boolean;
  isActive: boolean;
  displayOrder: number;
};

type LeaveTypeFormProps = {
  mode: "create" | "edit";
  leaveType?: LeaveTypeDetails;
  onCancel: () => void;
  onCreate: (request: CreateLeaveTypeRequest) => Promise<void>;
  onUpdate: (request: UpdateLeaveTypeRequest) => Promise<void>;
};

export function LeaveTypeForm({
  mode,
  leaveType,
  onCancel,
  onCreate,
  onUpdate,
}: LeaveTypeFormProps) {
  const { t } = useTranslations();
  const [formError, setFormError] = useState<string | null>(null);
  const schema = useMemo(
    () =>
      z.object({
        code: z
          .string()
          .trim()
          .min(1, t("vacation.leaveTypes.validation.codeRequired"))
          .max(50, t("vacation.leaveTypes.validation.codeLength"))
          .regex(
            /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/,
            t("vacation.leaveTypes.validation.codeFormat"),
          ),
        nameSr: z
          .string()
          .trim()
          .min(1, t("vacation.leaveTypes.validation.nameSrRequired"))
          .max(150, t("vacation.leaveTypes.validation.nameLength")),
        nameEn: z
          .string()
          .trim()
          .min(1, t("vacation.leaveTypes.validation.nameEnRequired"))
          .max(150, t("vacation.leaveTypes.validation.nameLength")),
        descriptionSr: z
          .string()
          .trim()
          .max(500, t("vacation.leaveTypes.validation.descriptionLength")),
        descriptionEn: z
          .string()
          .trim()
          .max(500, t("vacation.leaveTypes.validation.descriptionLength")),
        calendarColor: z
          .string()
          .trim()
          .refine(
            (value) => value === "" || /^#[0-9A-Fa-f]{6}$/.test(value),
            t("vacation.leaveTypes.validation.colorFormat"),
          ),
        countsAgainstVacationBalance: z.boolean(),
        requiresApproval: z.boolean(),
        isActive: z.boolean(),
        displayOrder: z
          .number({ error: t("vacation.leaveTypes.validation.displayOrder") })
          .int(t("vacation.leaveTypes.validation.displayOrder"))
          .min(0, t("vacation.leaveTypes.validation.displayOrder")),
      }),
    [t],
  );
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LeaveTypeFormValues>({
    defaultValues: toFormValues(leaveType),
  });

  useEffect(() => {
    reset(toFormValues(leaveType));
    window.requestAnimationFrame(() => {
      setFocus(mode === "create" ? "code" : "nameSr");
    });
  }, [leaveType, mode, reset, setFocus]);

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const validation = schema.safeParse(values);
    if (!validation.success) {
      for (const issue of validation.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && field in values) {
          setError(field as keyof LeaveTypeFormValues, {
            message: issue.message,
          });
        }
      }
      return;
    }

    const normalized = validation.data;
    try {
      if (mode === "create") {
        await onCreate({
          code: normalized.code,
          nameSr: normalized.nameSr,
          nameEn: normalized.nameEn,
          descriptionSr: emptyToNull(normalized.descriptionSr),
          descriptionEn: emptyToNull(normalized.descriptionEn),
          calendarColor: emptyToNull(normalized.calendarColor),
          countsAgainstVacationBalance:
            normalized.countsAgainstVacationBalance,
          requiresApproval: normalized.requiresApproval,
          isActive: normalized.isActive,
          displayOrder: normalized.displayOrder,
        });
      } else {
        await onUpdate({
          nameSr: normalized.nameSr,
          nameEn: normalized.nameEn,
          descriptionSr: emptyToNull(normalized.descriptionSr),
          descriptionEn: emptyToNull(normalized.descriptionEn),
          calendarColor: emptyToNull(normalized.calendarColor),
          countsAgainstVacationBalance:
            normalized.countsAgainstVacationBalance,
          requiresApproval: normalized.requiresApproval,
          displayOrder: normalized.displayOrder,
        });
      }
    } catch (error) {
      if (error instanceof ApiError) {
        mapServerFieldErrors(error, setError, t);
        if (
          error.status === 409 ||
          error.problem?.code === "leave_type_code_conflict"
        ) {
          setFormError(t("vacation.leaveTypes.duplicateCode"));
          return;
        }

        if (error.status === 403) {
          setFormError(t("vacation.leaveTypes.forbidden"));
          return;
        }
      }

      setFormError(t("vacation.leaveTypes.saveFailed"));
    }
  });

  return (
    <form className="space-y-4 p-4" onSubmit={submit} noValidate>
      {formError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {formError}
        </div>
      )}

      <FormField
        id="leave-type-code"
        label={t("vacation.leaveTypes.form.code")}
        error={errors.code?.message}
        hint={
          mode === "edit"
            ? t("vacation.leaveTypes.form.codeReadOnly")
            : t("vacation.leaveTypes.form.codeGuidance")
        }
      >
        <input
          id="leave-type-code"
          maxLength={50}
          readOnly={mode === "edit"}
          aria-invalid={Boolean(errors.code)}
          aria-describedby={fieldDescriptionIds(
            "leave-type-code",
            Boolean(errors.code),
            true,
          )}
          className={formControlClassName({ readOnly: mode === "edit", invalid: Boolean(errors.code) })}
          {...register("code")}
        />
      </FormField>

      <FormField
        id="leave-type-name-sr"
        label={t("vacation.leaveTypes.form.nameSr")}
        error={errors.nameSr?.message}
      >
        <input
          id="leave-type-name-sr"
          maxLength={150}
          aria-invalid={Boolean(errors.nameSr)}
          aria-describedby={fieldDescriptionIds(
            "leave-type-name-sr",
            Boolean(errors.nameSr),
            false,
          )}
          className={formControlClassName({ invalid: Boolean(errors.nameSr) })}
          {...register("nameSr")}
        />
      </FormField>

      <FormField
        id="leave-type-name-en"
        label={t("vacation.leaveTypes.form.nameEn")}
        error={errors.nameEn?.message}
      >
        <input
          id="leave-type-name-en"
          maxLength={150}
          aria-invalid={Boolean(errors.nameEn)}
          aria-describedby={fieldDescriptionIds(
            "leave-type-name-en",
            Boolean(errors.nameEn),
            false,
          )}
          className={formControlClassName({ invalid: Boolean(errors.nameEn) })}
          {...register("nameEn")}
        />
      </FormField>

      <FormField
        id="leave-type-description-sr"
        label={t("vacation.leaveTypes.form.descriptionSr")}
        error={errors.descriptionSr?.message}
      >
        <textarea
          id="leave-type-description-sr"
          rows={3}
          maxLength={500}
          aria-invalid={Boolean(errors.descriptionSr)}
          aria-describedby={fieldDescriptionIds(
            "leave-type-description-sr",
            Boolean(errors.descriptionSr),
            false,
          )}
          className={`${formControlClassName({ invalid: Boolean(errors.descriptionSr) })} resize-y`}
          {...register("descriptionSr")}
        />
      </FormField>

      <FormField
        id="leave-type-description-en"
        label={t("vacation.leaveTypes.form.descriptionEn")}
        error={errors.descriptionEn?.message}
      >
        <textarea
          id="leave-type-description-en"
          rows={3}
          maxLength={500}
          aria-invalid={Boolean(errors.descriptionEn)}
          aria-describedby={fieldDescriptionIds(
            "leave-type-description-en",
            Boolean(errors.descriptionEn),
            false,
          )}
          className={`${formControlClassName({ invalid: Boolean(errors.descriptionEn) })} resize-y`}
          {...register("descriptionEn")}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="leave-type-calendar-color"
          label={t("vacation.leaveTypes.form.calendarColor")}
          hint={t("vacation.leaveTypes.form.calendarColorGuidance")}
          error={errors.calendarColor?.message}
        >
          <input
            id="leave-type-calendar-color"
            maxLength={7}
            placeholder="#2563EB"
            aria-invalid={Boolean(errors.calendarColor)}
            aria-describedby={fieldDescriptionIds(
              "leave-type-calendar-color",
              Boolean(errors.calendarColor),
              true,
            )}
            className={formControlClassName({ invalid: Boolean(errors.calendarColor) })}
            {...register("calendarColor")}
          />
        </FormField>

        <FormField
          id="leave-type-display-order"
          label={t("vacation.leaveTypes.form.displayOrder")}
          error={errors.displayOrder?.message}
        >
          <input
            id="leave-type-display-order"
            type="number"
            min={0}
            step={1}
            aria-invalid={Boolean(errors.displayOrder)}
            aria-describedby={fieldDescriptionIds(
              "leave-type-display-order",
              Boolean(errors.displayOrder),
              false,
            )}
            className={formControlClassName({ invalid: Boolean(errors.displayOrder) })}
            {...register("displayOrder", { valueAsNumber: true })}
          />
        </FormField>
      </div>

      <fieldset className="space-y-2 border-t border-slate-200 pt-3">
        <legend className="sr-only">
          {t("vacation.leaveTypes.form.behavior")}
        </legend>
        <CheckboxField
          label={t("vacation.leaveTypes.form.countsAgainstBalance")}
          registration={register("countsAgainstVacationBalance")}
        />
        <CheckboxField
          label={t("vacation.leaveTypes.form.requiresApproval")}
          registration={register("requiresApproval")}
        />
        {mode === "create" && (
          <CheckboxField
            label={t("vacation.leaveTypes.form.initiallyActive")}
            registration={register("isActive")}
          />
        )}
      </fieldset>

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-slate-200 bg-white px-4 pb-1 pt-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-9 rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? t("vacation.leaveTypes.saving")
            : t("vacation.leaveTypes.save")}
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={onCancel}
          className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-60"
        >
          {t("vacation.leaveTypes.cancel")}
        </button>
      </div>
    </form>
  );
}

function toFormValues(leaveType?: LeaveTypeDetails): LeaveTypeFormValues {
  return {
    code: leaveType?.code ?? "",
    nameSr: leaveType?.nameSr ?? "",
    nameEn: leaveType?.nameEn ?? "",
    descriptionSr: leaveType?.descriptionSr ?? "",
    descriptionEn: leaveType?.descriptionEn ?? "",
    calendarColor: leaveType?.calendarColor ?? "",
    countsAgainstVacationBalance:
      leaveType?.countsAgainstVacationBalance ?? false,
    requiresApproval: leaveType?.requiresApproval ?? true,
    isActive: leaveType?.isActive ?? true,
    displayOrder: leaveType?.displayOrder ?? 0,
  };
}

function emptyToNull(value: string): string | null {
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function mapServerFieldErrors(
  error: ApiError,
  setError: (
    field: keyof LeaveTypeFormValues,
    error: { message: string },
  ) => void,
  t: ReturnType<typeof useTranslations>["t"],
) {
  const supportedFields = new Set<keyof LeaveTypeFormValues>([
    "code",
    "nameSr",
    "nameEn",
    "descriptionSr",
    "descriptionEn",
    "calendarColor",
    "countsAgainstVacationBalance",
    "requiresApproval",
    "isActive",
    "displayOrder",
  ]);

  for (const field of Object.keys(error.problem?.errors ?? {})) {
    if (supportedFields.has(field as keyof LeaveTypeFormValues)) {
      setError(field as keyof LeaveTypeFormValues, {
        message: localizedServerFieldError(
          field as keyof LeaveTypeFormValues,
          t,
        ),
      });
    }
  }
}

function localizedServerFieldError(
  field: keyof LeaveTypeFormValues,
  t: ReturnType<typeof useTranslations>["t"],
) {
  switch (field) {
    case "code":
      return t("vacation.leaveTypes.validation.codeFormat");
    case "nameSr":
      return t("vacation.leaveTypes.validation.nameSrRequired");
    case "nameEn":
      return t("vacation.leaveTypes.validation.nameEnRequired");
    case "descriptionSr":
    case "descriptionEn":
      return t("vacation.leaveTypes.validation.descriptionLength");
    case "calendarColor":
      return t("vacation.leaveTypes.validation.colorFormat");
    case "displayOrder":
      return t("vacation.leaveTypes.validation.displayOrder");
    default:
      return t("vacation.leaveTypes.saveFailed");
  }
}

function CheckboxField({
  label,
  registration,
}: {
  label: string;
  registration: ReturnType<
    ReturnType<typeof useForm<LeaveTypeFormValues>>["register"]
  >;
}) {
  return (
    <label className="flex min-h-9 items-center gap-2 text-sm text-slate-800">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
        {...registration}
      />
      <span>{label}</span>
    </label>
  );
}
