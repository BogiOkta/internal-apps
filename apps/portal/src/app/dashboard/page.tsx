"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { getAssignedApplications } from "@/services/applications";
import type { AssignedApplication } from "@/types/application";

export default function DashboardPage() {
  const router = useRouter();
  const { accessToken, user, isLoading, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [applications, setApplications] = useState<AssignedApplication[]>([]);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);
  const [areApplicationsLoading, setAreApplicationsLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, router, user]);

  useEffect(() => {
    if (!accessToken || !user) {
      return;
    }

    const controller = new AbortController();
    setAreApplicationsLoading(true);
    setApplicationsError(null);

    getAssignedApplications(accessToken, controller.signal)
      .then(setApplications)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setApplicationsError(
            error instanceof Error
              ? error.message
              : "Your applications could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setAreApplicationsLoading(false);
        }
      });

    return () => controller.abort();
  }, [accessToken, user]);

  if (isLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p role="status" className="text-slate-600">
          Loading…
        </p>
      </main>
    );
  }

  const currentRole = user.roles[0] ?? "No role assigned";

  async function handleLogout() {
    setIsLoggingOut(true);
    await logout();
    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-12">
      <section className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
              Dashboard
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
              Internal Apps Platform
            </h1>
            <p className="mt-3 text-xl text-slate-700">
              Welcome {user.displayName}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-60"
          >
            {isLoggingOut ? "Logging out…" : "Logout"}
          </button>
        </div>

        <dl className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <dt className="text-sm font-medium text-slate-500">Current user</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-950">
              {user.username}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <dt className="text-sm font-medium text-slate-500">Current role</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-950">
              {currentRole}
            </dd>
          </div>
        </dl>

        <section className="mt-10 border-t border-slate-200 pt-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">
              Applications
            </h2>
            <p className="mt-1 text-slate-600">
              Applications assigned to your account.
            </p>
          </div>

          {areApplicationsLoading && (
            <div
              role="status"
              className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-600"
            >
              Loading applications…
            </div>
          )}

          {!areApplicationsLoading && applicationsError && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"
            >
              {applicationsError}
            </div>
          )}

          {!areApplicationsLoading &&
            !applicationsError &&
            applications.length === 0 && (
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-600">
                No applications are assigned to your account.
              </div>
            )}

          {!areApplicationsLoading &&
            !applicationsError &&
            applications.length > 0 && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {applications.map((application) => (
                  <Link
                    key={application.publicId}
                    href={application.route}
                    className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-lg font-bold text-blue-800">
                      {application.name.charAt(0)}
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-slate-950 group-hover:text-blue-800">
                      {application.name}
                    </h3>
                    {application.description && (
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {application.description}
                      </p>
                    )}
                    <p className="mt-5 text-sm font-semibold text-blue-700">
                      Open application →
                    </p>
                  </Link>
                ))}
              </div>
            )}
        </section>
      </section>
    </main>
  );
}
