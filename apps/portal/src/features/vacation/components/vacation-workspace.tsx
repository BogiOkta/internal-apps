"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { PortalSectionHeader } from "@/components/portal-section-header";
import {
  WorkspaceNavigation,
  type WorkspaceNavigationItem,
} from "@/components/workspace-navigation";
import { useTranslations } from "@/i18n/use-translations";
import { useAuth } from "@/components/auth-provider";
import { usersManagePermission } from "@/types/auth";
import { vacationRequestsManagePermission } from "@/types/vacation";

type VacationWorkspaceProps = {
  /** Active section title, rendered below the tab navigation. */
  title: string;
  /** Active section description, rendered below the tab navigation. */
  description?: string;
  /** Primary actions that belong only to the active section. */
  sectionActions?: ReactNode;
  /** Secondary actions (refresh, export, …) of the active section. */
  sectionSecondaryActions?: ReactNode;
  contentFillsViewport?: boolean;
  children: ReactNode;
};

/**
 * Canonical tabbed-screen hierarchy (UI_GUIDELINES §2.5): stable module
 * header, tab navigation, then the active section header. Tab-specific
 * actions are rendered in the section header, never in the module header.
 */
export function VacationWorkspace({
  title,
  description,
  sectionActions,
  sectionSecondaryActions,
  contentFillsViewport,
  children,
}: VacationWorkspaceProps) {
  const { t } = useTranslations();
  const { user } = useAuth();

  const items: WorkspaceNavigationItem[] = [
    {
      label: t("vacation.workspace.requests"),
      href: "/vacation/requests",
    },
    {
      label: t("vacation.workspace.leaveTypes"),
      href: "/vacation/leave-types",
    },
    ...(user?.permissions.includes(vacationRequestsManagePermission)
      ? [{
          label: t("vacation.admin.navigation"),
          href: "/vacation/admin/requests",
        }]
      : []),
    ...(user?.permissions.includes(usersManagePermission)
      ? [{
          label: t("leavePolicy.navigation"),
          href: "/vacation/admin/policies",
        }, {
          label: t("leaveBalance.navigation"),
          href: "/vacation/admin/leave-balances",
        }]
      : []),
  ];

  return (
    <AppShell
      title={t("vacation.workspace.title")}
      description={t("vacation.workspace.description")}
      contentFillsViewport={contentFillsViewport}
      secondaryNavigation={
        <WorkspaceNavigation
          ariaLabel={t("vacation.workspace.navigationLabel")}
          items={items}
        />
      }
    >
      <PortalSectionHeader
        title={title}
        description={description}
        actions={sectionActions}
        secondaryActions={sectionSecondaryActions}
      />
      {children}
    </AppShell>
  );
}
