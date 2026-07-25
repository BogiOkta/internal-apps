"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import {
  WorkspaceNavigation,
  type WorkspaceNavigationItem,
} from "@/components/workspace-navigation";
import { useTranslations } from "@/i18n/use-translations";
import { useAuth } from "@/components/auth-provider";
import { userEmployeeLinksManagePermission } from "@/types/organization";
import { usersManagePermission } from "@/types/auth";

type VacationWorkspaceProps = {
  title: string;
  description?: string;
  commandBar?: ReactNode;
  children: ReactNode;
};

export function VacationWorkspace({
  title,
  description,
  commandBar,
  children,
}: VacationWorkspaceProps) {
  const { t } = useTranslations();
  const { user } = useAuth();

  const items: WorkspaceNavigationItem[] = [
    {
      label: t("vacation.workspace.overview"),
      href: "/vacation",
    },
    {
      label: t("vacation.workspace.employees"),
      href: "/organization/employees",
    },
    {
      label: t("vacation.workspace.departments"),
      href: "/organization/departments",
    },
    {
      label: t("vacation.workspace.leaveTypes"),
      href: "/vacation/leave-types",
    },
    ...(user?.permissions.includes(userEmployeeLinksManagePermission)
      ? [{
          label: t("organization.links.navigation"),
          href: "/organization/user-employee-links",
        }]
      : []),
    ...(user?.permissions.includes(usersManagePermission)
      ? [{
          label: t("identity.users.navigation"),
          href: "/identity/users",
        }, {
          label: t("vacation.admin.navigation"),
          href: "/vacation/admin/requests",
        }]
      : []),
    {
      label: t("vacation.workspace.requests"),
      href: "/vacation/requests",
    },
    {
      label: t("vacation.workspace.calendar"),
      href: "/vacation#calendar",
    },
  ];

  return (
    <AppShell
      title={title}
      description={description}
      commandBar={commandBar}
      secondaryNavigation={
        <WorkspaceNavigation
          ariaLabel={t("vacation.workspace.navigationLabel")}
          items={items}
        />
      }
    >
      {children}
    </AppShell>
  );
}
