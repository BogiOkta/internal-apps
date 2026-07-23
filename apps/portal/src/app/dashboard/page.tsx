"use client";

import Link from "next/link";
import {
  AppShell,
  ApplicationIcon,
  OpenIcon,
} from "@/components/app-shell";
import { localizeApplication } from "@/i18n/translations";
import { useTranslations } from "@/i18n/use-translations";

export default function DashboardPage() {
  const { t } = useTranslations();

  return (
    <AppShell
      title={t("dashboard.title")}
      description={t("dashboard.description")}
    >
      {({
        applications,
        applicationsError,
        areApplicationsLoading,
        user,
      }) => (
        <div className="space-y-6">
          <div className="border-b border-slate-200 pb-5">
            <h2 className="text-lg font-semibold tracking-tight text-slate-950">
              {t("dashboard.welcome", { name: user.displayName })}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {t("dashboard.availableApplications")}
            </p>
          </div>

          {areApplicationsLoading && (
            <div
              role="status"
              className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm"
            >
              {t("dashboard.loadingApplications")}
            </div>
          )}

          {!areApplicationsLoading && applicationsError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800"
            >
              {t("dashboard.applicationsError")}
            </div>
          )}

          {!areApplicationsLoading &&
            !applicationsError &&
            applications.length === 0 && (
              <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">
                  {t("dashboard.emptyTitle")}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                  {t("dashboard.emptyDescription")}
                </p>
              </div>
            )}

          {!areApplicationsLoading &&
            !applicationsError &&
            applications.length > 0 && (
              <section aria-labelledby="assigned-applications-heading">
                <h2
                  id="assigned-applications-heading"
                  className="text-lg font-semibold text-slate-900"
                >
                  {t("dashboard.assignedApplications")}
                </h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {applications.map((application) => {
                    const localizedApplication = localizeApplication(
                      application,
                      t,
                    );

                    return (
                      <Link
                        key={application.publicId}
                        href={application.route}
                        className="group flex min-h-48 flex-col rounded-lg border border-slate-300 bg-white p-5 shadow-sm hover:border-blue-500 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                          <ApplicationIcon
                            code={application.code}
                            className="h-6 w-6"
                          />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-slate-950 group-hover:text-blue-800">
                          {localizedApplication.name}
                        </h3>
                        {localizedApplication.description && (
                          <p className="mt-1.5 text-sm leading-5 text-slate-600">
                            {localizedApplication.description}
                          </p>
                        )}
                        <p className="mt-auto flex items-center gap-1.5 pt-5 text-sm font-semibold text-blue-700">
                          {t("dashboard.openApplication")}
                          <OpenIcon className="h-4 w-4" />
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
        </div>
      )}
    </AppShell>
  );
}
