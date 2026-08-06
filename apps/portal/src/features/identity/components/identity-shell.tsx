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
import { buildWorkspaceBreadcrumbs, identityWorkspace } from "@/navigation";

type IdentityShellChrome = {
  contentFillsViewport: boolean;
  breadcrumbRecordLabel?: string;
};

type IdentityShellContextValue = {
  setChrome: (chrome: IdentityShellChrome) => void;
};

const IdentityShellContext = createContext<IdentityShellContextValue | null>(
  null,
);

const defaultChrome: IdentityShellChrome = {
  contentFillsViewport: false,
};

/**
 * Persistent Identity workspace chrome. Owned by the `/identity` layout so
 * sidebar and breadcrumb chrome stay mounted without remounting AppShell.
 */
export function IdentityPersistentShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useTranslations();
  const [chrome, setChromeState] =
    useState<IdentityShellChrome>(defaultChrome);

  const setChrome = useCallback((next: IdentityShellChrome) => {
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
        workspace: identityWorkspace,
        pathname,
        permissions: user?.permissions ?? [],
        translate: t,
        recordLabel: chrome.breadcrumbRecordLabel,
      }),
    [chrome.breadcrumbRecordLabel, pathname, t, user?.permissions],
  );

  const contextValue = useMemo(() => ({ setChrome }), [setChrome]);

  return (
    <IdentityShellContext.Provider value={contextValue}>
      <AppShell
        layoutMode="workspace"
        breadcrumbs={breadcrumbs}
        contentFillsViewport={chrome.contentFillsViewport}
      >
        {children}
      </AppShell>
    </IdentityShellContext.Provider>
  );
}

export function useIdentityShellChrome() {
  const context = useContext(IdentityShellContext);
  if (!context) {
    throw new Error(
      "IdentityWorkspace must render inside the Identity layout shell.",
    );
  }
  return context;
}
