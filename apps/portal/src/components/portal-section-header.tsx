import type { ReactNode } from "react";

/**
 * Canonical page / active-section header.
 * On the Vacation IA pilot it owns the page title (`h1`), optional description,
 * and page actions. On remaining tabbed screens it may still render as `h2`
 * below a module header.
 */
export function PortalSectionHeader({
  title,
  description,
  actions,
  secondaryActions,
  asPageTitle = false,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  secondaryActions?: ReactNode;
  /** When true, renders the title as the page `h1` (Vacation IA pilot). */
  asPageTitle?: boolean;
}) {
  const TitleTag = asPageTitle ? "h1" : "h2";

  return (
    <div
      className={
        asPageTitle
          ? "mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
          : "mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
      }
    >
      <div className="min-w-0">
        <TitleTag
          className={
            asPageTitle
              ? "text-2xl font-semibold tracking-tight text-slate-950"
              : "text-lg font-semibold tracking-tight text-slate-950"
          }
        >
          {title}
        </TitleTag>
        {description && (
          <p
            className={
              asPageTitle
                ? "mt-1 max-w-3xl text-sm leading-5 text-slate-500"
                : "mt-0.5 max-w-3xl text-sm leading-5 text-slate-600"
            }
          >
            {description}
          </p>
        )}
      </div>
      {(actions || secondaryActions) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end md:pt-0.5">
          {actions}
          {secondaryActions}
        </div>
      )}
    </div>
  );
}
