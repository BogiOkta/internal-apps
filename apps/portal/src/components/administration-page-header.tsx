import type { ReactNode } from "react";

export function AdministrationPageHeader({ title, description, actions, identity }: { title: string; description?: string; actions?: ReactNode; identity?: ReactNode }) {
  return <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-7">
    <div className="min-w-0"><h1 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h1>{description && <p className="mt-0.5 max-w-3xl text-sm leading-5 text-slate-600">{description}</p>}</div>
    <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">{actions}{identity && <div className="hidden min-w-0 text-right xl:block">{identity}</div>}</div>
  </div>;
}
