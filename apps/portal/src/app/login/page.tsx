"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/components/auth-provider";
import { useTranslations } from "@/i18n/use-translations";
import { ApiError } from "@/services/auth";
import {
  fieldDescriptionIds,
  FormField,
  formControlClassName,
  formPrimaryButtonClassName,
} from "@/components/form-field";

type LoginForm = {
  username: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading, login } = useAuth();
  const { t } = useTranslations();
  const [formError, setFormError] = useState<string | null>(null);
  const loginSchema = z.object({
    username: z.string().trim().min(1, t("login.usernameRequired")),
    password: z.string().min(1, t("login.passwordRequired")),
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    defaultValues: { username: "", password: "" },
  });

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
  }, [isLoading, router, user]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const validation = loginSchema.safeParse(values);

    if (!validation.success) {
      for (const issue of validation.error.issues) {
        const field = issue.path[0];
        if (field === "username" || field === "password") {
          setError(field, { message: issue.message });
        }
      }
      return;
    }

    try {
      await login(validation.data);
      router.replace("/dashboard");
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? t("login.authenticationError")
          : t("login.genericError"),
      );
    }
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
          {t("common.companyPortal")}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
          {t("common.productName")}
        </h1>
        <p className="mt-2 text-slate-600">{t("login.instruction")}</p>

        <form className="mt-8 space-y-5" onSubmit={onSubmit} noValidate>
          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {formError}
            </div>
          )}

          <FormField id="username" label={t("login.username")} error={errors.username?.message}>
            <input
              id="username"
              autoComplete="username"
              aria-invalid={Boolean(errors.username)}
              aria-describedby={fieldDescriptionIds("username", Boolean(errors.username))}
              className={formControlClassName({ invalid: Boolean(errors.username) })}
              {...register("username")}
            />
          </FormField>

          <FormField id="password" label={t("login.password")} error={errors.password?.message}>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={fieldDescriptionIds("password", Boolean(errors.password))}
              className={formControlClassName({ invalid: Boolean(errors.password) })}
              {...register("password")}
            />
          </FormField>

          <button
            type="submit"
            disabled={isSubmitting || isLoading}
            className={`${formPrimaryButtonClassName()} w-full py-2.5`}
          >
            {isSubmitting ? t("login.submitting") : t("login.submit")}
          </button>
        </form>
      </section>
    </main>
  );
}
