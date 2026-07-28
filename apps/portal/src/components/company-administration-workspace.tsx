"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";

type CompanyAdministrationWorkspaceProps = {
  title: string;
  description?: string;
  commandBar?: ReactNode;
  contentFillsViewport?: boolean;
  children: ReactNode;
};

export function CompanyAdministrationWorkspace({
  title,
  description,
  commandBar,
  contentFillsViewport,
  children,
}: CompanyAdministrationWorkspaceProps) {
  return (
    <AppShell title={title} description={description} commandBar={commandBar} contentFillsViewport={contentFillsViewport}>
      {children}
    </AppShell>
  );
}
