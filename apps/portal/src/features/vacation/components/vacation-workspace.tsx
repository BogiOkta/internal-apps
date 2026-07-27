"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import {
  WorkspaceNavigation,
  type WorkspaceNavigationItem,
} from "@/components/workspace-navigation";
import { useTranslations } from "@/i18n/use-translations";
import { useAuth } from "@/components/auth-provider";
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
      label: t("vacation.workspace.requests"),
      href: "/vacation/requests",
    },
    {
      label: t("vacation.workspace.leaveTypes"),
      href: "/vacation/leave-types",
    },
    ...(user?.permissions.includes(usersManagePermission)
      ? [{
          label: t("vacation.admin.navigation"),
          href: "/vacation/admin/requests",
        }, {
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
