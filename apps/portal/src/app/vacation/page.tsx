"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export default function VacationPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

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

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-12">
      <section className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
          Application
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
          Vacation
        </h1>
        <p className="mt-3 max-w-2xl text-lg leading-8 text-slate-600">
          This will be the vacation and absence management module.
        </p>

        <Link
          href="/dashboard"
          className="mt-8 inline-flex rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        >
          Back to dashboard
        </Link>
      </section>
    </main>
  );
}
