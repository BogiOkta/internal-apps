import type { SystemInfo } from "@/types/system";

type ApiStatusProps = {
  systemInfo: SystemInfo | null;
};

export function ApiStatus({ systemInfo }: ApiStatusProps) {
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
        <h2 className="text-lg font-semibold text-slate-900">API status</h2>
      </div>

      {systemInfo ? (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Status</dt>
            <dd className="font-medium text-emerald-700">Available</dd>
          </div>
          <div>
            <dt className="text-slate-500">Environment</dt>
            <dd className="font-medium text-slate-900">{systemInfo.environment}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Version</dt>
            <dd className="font-medium text-slate-900">{systemInfo.version}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-4 text-sm text-red-700">
          The API is unavailable. Start it on the configured API base URL and refresh this page.
        </p>
      )}
    </div>
  );
}
