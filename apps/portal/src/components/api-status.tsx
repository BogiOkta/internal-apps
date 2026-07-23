"use client";

import { useTranslations } from "@/i18n/use-translations";
import type { SystemInfo } from "@/types/system";

type ApiStatusProps = {
  systemInfo: SystemInfo | null;
};

export function ApiStatus({ systemInfo }: ApiStatusProps) {
  const { t } = useTranslations();
  const isAvailable = systemInfo !== null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`h-3 w-3 rounded-full ${
            isAvailable ? "bg-emerald-500" : "bg-red-500"
          }`}
        />
        <h2 className="text-lg font-semibold text-slate-900">
          {t("apiStatus.title")}
        </h2>
      </div>

      {systemInfo ? (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">{t("apiStatus.status")}</dt>
            <dd className="font-medium text-emerald-700">
              {t("apiStatus.available")}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t("apiStatus.environment")}</dt>
            <dd className="font-medium text-slate-900">{systemInfo.environment}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t("apiStatus.version")}</dt>
            <dd className="font-medium text-slate-900">{systemInfo.version}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-4 text-sm text-red-700">
          {t("apiStatus.unavailable")}
        </p>
      )}
    </div>
  );
}
