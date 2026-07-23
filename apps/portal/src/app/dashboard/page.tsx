"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, router, user]);

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
      </section>
    </main>
  );
}
