"use client";

import Link from "next/link";
import {
  AppShell,
  ApplicationIcon,
  OpenIcon,
} from "@/components/app-shell";

export default function DashboardPage() {
  return (
    <AppShell
      title="Dashboard"
      description="Open the internal applications assigned to your account."
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
              Welcome back, {user.displayName}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Your available internal applications
            </p>
          </div>

          {areApplicationsLoading && (
            <div
              role="status"
              className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm"
            >
              Loading applications…
            </div>
          )}

          {!areApplicationsLoading && applicationsError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800"
            >
              Applications could not be loaded. Please try again later.
            </div>
          )}

          {!areApplicationsLoading &&
            !applicationsError &&
            applications.length === 0 && (
              <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">
                  No applications assigned
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                  Your account does not currently have access to an internal
                  application. Contact your administrator if you need access.
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
                  Assigned applications
                </h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {applications.map((application) => (
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
                        {application.name}
                      </h3>
                      {application.description && (
                        <p className="mt-1.5 text-sm leading-5 text-slate-600">
                          {application.description}
                        </p>
                      )}
                      <p className="mt-auto flex items-center gap-1.5 pt-5 text-sm font-semibold text-blue-700">
                        Open application
                        <OpenIcon className="h-4 w-4" />
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
        </div>
      )}
    </AppShell>
  );
}
