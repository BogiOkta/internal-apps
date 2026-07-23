"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type WorkspaceNavigationItem = {
  label: string;
  href?: string;
  disabled?: boolean;
  badge?: string;
};

type WorkspaceNavigationProps = {
  ariaLabel: string;
  items: WorkspaceNavigationItem[];
};

export function WorkspaceNavigation({
  ariaLabel,
  items,
}: WorkspaceNavigationProps) {
  const pathname = usePathname();

  return (
    <nav aria-label={ariaLabel} className="overflow-x-auto">
      <ul className="flex min-w-max items-stretch gap-1">
        {items.map((item) => {
          const isActive =
            item.href === "/vacation"
              ? pathname === item.href
              : Boolean(
                  item.href &&
                    (pathname === item.href ||
                      pathname.startsWith(`${item.href}/`)),
                );

          return (
            <li key={item.label}>
              {item.href && !item.disabled ? (
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-600 ${
                    isActive
                      ? "border-blue-700 font-semibold text-blue-800"
                      : "border-transparent font-medium text-slate-600 hover:border-slate-300 hover:text-slate-950"
                  }`}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className="flex min-h-11 cursor-not-allowed items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-slate-400"
                >
                  {item.label}
                  {item.badge && (
                    <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      {item.badge}
                    </span>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
