"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { PortalSectionHeader } from "@/components/portal-section-header";
import { useIdentityShellChrome } from "@/features/identity/components/identity-shell";

type IdentityWorkspaceProps = {
  /** Page title rendered as the single page `h1`. */
  title: string;
  /** Optional page description. */
  description?: string;
  /** Primary actions that belong to this page. */
  sectionActions?: ReactNode;
  /** Secondary actions (refresh, export, …) for this page. */
  sectionSecondaryActions?: ReactNode;
  /** Optional breadcrumb trailing node for record/form pages. */
  breadcrumbRecordLabel?: string;
  contentFillsViewport?: boolean;
  children: ReactNode;
};

/**
 * Identity Portal v2 page chrome.
 * Capability navigation and the authenticated shell live in the persistent
 * Identity layout. This component owns the page header and registers
 * page-level shell chrome.
 */
export function IdentityWorkspace({
  title,
  description,
  sectionActions,
  sectionSecondaryActions,
  breadcrumbRecordLabel,
  contentFillsViewport = false,
  children,
}: IdentityWorkspaceProps) {
  const { setChrome } = useIdentityShellChrome();

  useLayoutEffect(() => {
    setChrome({
      contentFillsViewport,
      breadcrumbRecordLabel,
    });

    return () => {
      setChrome({ contentFillsViewport: false });
    };
  }, [breadcrumbRecordLabel, contentFillsViewport, setChrome]);

  return (
    <>
      <PortalSectionHeader
        asPageTitle
        title={title}
        description={description}
        actions={sectionActions}
        secondaryActions={sectionSecondaryActions}
      />
      {children}
    </>
  );
}
