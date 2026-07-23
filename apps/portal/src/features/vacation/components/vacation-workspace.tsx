"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import {
  WorkspaceNavigation,
  type WorkspaceNavigationItem,
} from "@/components/workspace-navigation";
import { useTranslations } from "@/i18n/use-translations";

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

  const items: WorkspaceNavigationItem[] = [
    {
      label: t("vacation.workspace.overview"),
      href: "/vacation",
    },
    {
      label: t("vacation.workspace.employees"),
      href: "/vacation/employees",
    },
    {
      label: t("vacation.workspace.departments"),
      disabled: true,
      badge: t("common.comingSoon"),
    },
    {
      label: t("vacation.workspace.leaveTypes"),
      disabled: true,
      badge: t("common.comingSoon"),
    },
    {
      label: t("vacation.workspace.requests"),
      disabled: true,
      badge: t("common.comingSoon"),
    },
    {
      label: t("vacation.workspace.calendar"),
      disabled: true,
      badge: t("common.comingSoon"),
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
