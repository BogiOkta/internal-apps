"use client";

import Link from "next/link";
import type { BreadcrumbNode } from "@/navigation";

type PortalBreadcrumbProps = {
  items: BreadcrumbNode[];
  ariaLabel: string;
};

/**
 * Route-owned context breadcrumb for the Vacation IA pilot.
 * Groups and section-group labels never appear as nodes.
 */
export function PortalBreadcrumb({ items, ariaLabel }: PortalBreadcrumbProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label={ariaLabel} className="min-w-0">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-4 text-slate-500">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 && (
                <span aria-hidden="true" className="text-slate-400">
                  ›
                </span>
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="truncate rounded-sm font-medium text-slate-500 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={`truncate ${isLast ? "font-medium text-slate-600" : "font-medium text-slate-500"}`}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
