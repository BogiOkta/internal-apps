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
  vacationWorkspace,
} from "@/navigation";

type VacationShellChrome = {
  contentFillsViewport: boolean;
  breadcrumbRecordLabel?: string;
};

type VacationShellContextValue = {
  setChrome: (chrome: VacationShellChrome) => void;
};

const VacationShellContext = createContext<VacationShellContextValue | null>(
  null,
);

const defaultChrome: VacationShellChrome = {
  contentFillsViewport: false,
};

/**
 * Persistent Vacation workspace chrome. Lives in the `/vacation` layout so the
 * sidebar, breadcrumb header, and application session survive in-workspace
 * navigations without remounting AppShell.
 */
export function VacationPersistentShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useTranslations();
  const [chrome, setChromeState] =
    useState<VacationShellChrome>(defaultChrome);

  const setChrome = useCallback((next: VacationShellChrome) => {
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
        workspace: vacationWorkspace,
        pathname,
        permissions: user?.permissions ?? [],
        translate: t,
        recordLabel: chrome.breadcrumbRecordLabel,
      }),
    [chrome.breadcrumbRecordLabel, pathname, t, user?.permissions],
  );

  const contextValue = useMemo(() => ({ setChrome }), [setChrome]);

  return (
    <VacationShellContext.Provider value={contextValue}>
      <AppShell
        layoutMode="workspace"
        breadcrumbs={breadcrumbs}
        contentFillsViewport={chrome.contentFillsViewport}
      >
        {children}
      </AppShell>
    </VacationShellContext.Provider>
  );
}

export function useVacationShellChrome() {
  const context = useContext(VacationShellContext);
  if (!context) {
    throw new Error(
      "VacationWorkspace must render inside the Vacation layout shell.",
    );
  }
  return context;
}
