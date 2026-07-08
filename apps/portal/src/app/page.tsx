import { ApiStatus } from "@/components/api-status";
import { getSystemInfo } from "@/services/system";

export const dynamic = "force-dynamic";

export default async function Home() {
  const systemInfo = await getSystemInfo();

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-16">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-700">
          Company Portal
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          Internal Apps Platform
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
          A shared foundation for secure, modular internal business applications.
        </p>

        <div className="mt-10">
          <ApiStatus systemInfo={systemInfo} />
        </div>
      </section>
    </main>
  );
}
