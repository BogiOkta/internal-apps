import type { ReactNode } from "react";

/**
 * Canonical active-section header for Portal screens with tab navigation.
 * Rendered below the tabs, it owns the active section title, its optional
 * description, and the actions that belong only to that section. Tab-specific
 * actions must live here, never in the module-level page header.
 */
export function PortalSectionHeader({
  title,
  description,
  actions,
  secondaryActions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  secondaryActions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 max-w-3xl text-sm leading-5 text-slate-600">
            {description}
          </p>
        )}
      </div>
      {(actions || secondaryActions) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
          {actions}
          {secondaryActions}
        </div>
      )}
    </div>
  );
}
