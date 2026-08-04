"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { useTranslations } from "@/i18n/use-translations";
import {
  buildWorkspaceBreadcrumbs,
  organizationWorkspace,
} from "@/navigation";

type OrganizationShellChrome = {
  contentFillsViewport: boolean;
  breadcrumbRecordLabel?: string;
};

type OrganizationShellContextValue = {
  setChrome: (chrome: OrganizationShellChrome) => void;
};

const OrganizationShellContext =
  createContext<OrganizationShellContextValue | null>(null);

const defaultChrome: OrganizationShellChrome = {
  contentFillsViewport: false,
};

/**
 * Persistent Organization workspace chrome. Owned by the pathless
 * `(company)` layout so `/organization/*` and Business Calendar Non-working
 * days keep the sidebar and breadcrumb chrome mounted without remounting
 * AppShell across that cross-prefix navigation.
 */
export function OrganizationPersistentShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useTranslations();
  const [chrome, setChromeState] =
    useState<OrganizationShellChrome>(defaultChrome);

  const setChrome = useCallback((next: OrganizationShellChrome) => {
    setChromeState((current) => {
      if (
        current.contentFillsViewport === next.contentFillsViewport &&
        current.breadcrumbRecordLabel === next.breadcrumbRecordLabel
      ) {
        return current;
      }
      return next;
    });
  }, []);

  const breadcrumbs = useMemo(
    () =>
      buildWorkspaceBreadcrumbs({
        workspace: organizationWorkspace,
        pathname,
        permissions: user?.permissions ?? [],
        translate: t,
        recordLabel: chrome.breadcrumbRecordLabel,
      }),
    [chrome.breadcrumbRecordLabel, pathname, t, user?.permissions],
  );

  const contextValue = useMemo(() => ({ setChrome }), [setChrome]);

  return (
    <OrganizationShellContext.Provider value={contextValue}>
      <AppShell
        layoutMode="workspace"
        breadcrumbs={breadcrumbs}
        contentFillsViewport={chrome.contentFillsViewport}
      >
        {children}
      </AppShell>
    </OrganizationShellContext.Provider>
  );
}

export function useOrganizationShellChrome() {
  const context = useContext(OrganizationShellContext);
  if (!context) {
    throw new Error(
      "OrganizationWorkspace must render inside the Company workspace layout shell.",
    );
  }
  return context;
}
