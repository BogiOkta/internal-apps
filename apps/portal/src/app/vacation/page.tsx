"use client";

import Link from "next/link";
import { OpenIcon } from "@/components/app-shell";
import { VacationWorkspace } from "@/features/vacation/components/vacation-workspace";
import { useTranslations } from "@/i18n/use-translations";

export default function VacationOverviewPage() {
  const { t } = useTranslations();

  const statisticPlaceholders = [
    t("vacation.overview.employeeStatistics"),
    t("vacation.overview.requestStatistics"),
    t("vacation.overview.availabilityStatistics"),
  ];

  return (
    <VacationWorkspace
      title={t("vacation.title")}
      description={t("vacation.description")}
    >
      <div className="space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-slate-950">
            {t("vacation.overview.heading")}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            {t("vacation.overview.description")}
          </p>
        </section>

        <section aria-labelledby="quick-statistics-heading">
          <h2
            id="quick-statistics-heading"
            className="text-sm font-semibold text-slate-900"
          >
            {t("vacation.overview.quickStatistics")}
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {statisticPlaceholders.map((label) => (
              <div
                key={label}
                className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
              >
                <p className="text-sm font-medium text-slate-900">{label}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {t("vacation.overview.statisticsPlaceholder")}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <section
            aria-labelledby="recent-activity-heading"
            className="rounded-lg border border-slate-300 bg-white shadow-sm"
          >
            <div className="border-b border-slate-200 px-5 py-3.5">
              <h2
                id="recent-activity-heading"
                className="text-sm font-semibold text-slate-900"
              >
                {t("vacation.overview.recentActivity")}
              </h2>
            </div>
            <p className="px-5 py-8 text-sm leading-6 text-slate-500">
              {t("vacation.overview.activityPlaceholder")}
            </p>
          </section>

          <section
            aria-labelledby="shortcuts-heading"
            className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm"
          >
            <h2
              id="shortcuts-heading"
              className="text-sm font-semibold text-slate-900"
            >
              {t("vacation.overview.shortcuts")}
            </h2>
            <h3 className="mt-4 text-base font-semibold text-slate-950">
              {t("vacation.overview.employeeShortcut")}
            </h3>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              {t("vacation.overview.employeeShortcutDescription")}
            </p>
            <Link
              href="/vacation/employees"
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            >
              {t("vacation.overview.openEmployees")}
              <OpenIcon className="h-4 w-4" />
            </Link>
          </section>
        </div>
      </div>
    </VacationWorkspace>
  );
}
