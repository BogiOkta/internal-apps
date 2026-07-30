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

/**
 * Canonical Portal tab navigation for secondary section switching.
 * Owns label weight, inter-tab separators, active underline, hover/focus,
 * overflow scrolling, and accessibility semantics. Feature pages must not
 * recreate separator or active-tab chrome locally.
 */
export function WorkspaceNavigation({
  ariaLabel,
  items,
}: WorkspaceNavigationProps) {
  const pathname = usePathname();

  return (
    <nav aria-label={ariaLabel} className="overflow-x-auto">
      <ul className="flex min-w-max items-stretch">
        {items.map((item, index) => {
          const isActive =
            item.href === "/vacation"
              ? pathname === item.href
              : Boolean(
                  item.href &&
                    (pathname === item.href ||
                      pathname.startsWith(`${item.href}/`)),
                );
          const showLeadingSeparator = index > 0;

          return (
            <li
              key={item.label}
              className={`flex items-stretch ${
                showLeadingSeparator
                  ? "before:mx-0.5 before:my-2.5 before:w-px before:shrink-0 before:self-stretch before:bg-slate-200 before:content-[''] dark:before:bg-slate-600"
                  : ""
              }`}
            >
              {item.href && !item.disabled ? (
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 dark:focus-visible:ring-blue-400 ${
                    isActive
                      ? "border-blue-700 font-semibold text-blue-800 dark:border-blue-400 dark:text-blue-300"
                      : "border-transparent font-medium text-slate-600 hover:border-slate-300 hover:text-slate-950 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-50"
                  }`}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className="flex min-h-11 cursor-not-allowed items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-slate-400 dark:text-slate-500"
                >
                  {item.label}
                  {item.badge && (
                    <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
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
