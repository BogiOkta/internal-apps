"use client";

import { AppShell } from "@/components/app-shell";

export default function VacationPage() {
  const plannedAreas = [
    {
      name: "Employees",
      description: "Employee records and leave-related context.",
    },
    {
      name: "Requests",
      description: "Create, review, and approve absence requests.",
    },
    {
      name: "Calendar",
      description: "Team availability and approved absence overview.",
    },
    {
      name: "Configuration",
      description: "Vacation types and module settings.",
    },
  ];

  return (
    <AppShell
      title="Vacation"
      description="Upravljanje godišnjim odmorima i odsustvima"
    >
      <section className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                Module foundation
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">
                Planned Vacation workspace
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Employee and leave-management functions will be introduced in
                upcoming sprints using this shared business-page structure.
              </p>
            </div>
            <span className="w-fit rounded border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
              No actions available yet
            </span>
          </div>
        </div>

        <div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:px-6">
            <span>Area</span>
            <span className="hidden sm:block">Purpose</span>
            <span>Status</span>
          </div>
          <ul aria-label="Planned Vacation areas" className="divide-y divide-slate-200">
            {plannedAreas.map((area) => (
              <li
                key={area.name}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-5 py-3.5 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-center sm:px-6"
              >
                <span className="text-sm font-medium text-slate-900">
                  {area.name}
                </span>
                <span className="col-span-2 text-sm leading-5 text-slate-600 sm:col-span-1">
                  {area.description}
                </span>
                <span className="row-start-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 sm:row-auto">
                  Upcoming
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </AppShell>
  );
}
