"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  type ReactNode,
  type SVGProps,
} from "react";
import {
  appearances,
  useAppearance,
  type Appearance,
} from "@/components/appearance-provider";
import { useAuth } from "@/components/auth-provider";
import {
  localeDisplayNames,
  localizeApplication,
  supportedLocales,
  type SupportedLocale,
} from "@/i18n/translations";
import { useTranslations } from "@/i18n/use-translations";
import { getAssignedApplications } from "@/services/applications";
import type { AssignedApplication } from "@/types/application";
import type { CurrentUser } from "@/types/auth";
import { usersManagePermission } from "@/types/auth";

type AppShellContext = {
  applications: AssignedApplication[];
  applicationsError: boolean;
  areApplicationsLoading: boolean;
  user: CurrentUser;
};

type AppShellProps = {
  title: string;
  description?: string;
  commandBar?: ReactNode;
  secondaryNavigation?: ReactNode;
  children: ReactNode | ((context: AppShellContext) => ReactNode);
};

type NavigationProps = {
  applications: AssignedApplication[];
  applicationsError: boolean;
  areApplicationsLoading: boolean;
  currentPath: string;
  isLoggingOut: boolean;
  onNavigate?: () => void;
  onLogout: () => Promise<void>;
  user: CurrentUser;
};

export function AppShell({
  title,
  description,
  commandBar,
  secondaryNavigation,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { accessToken, user, isLoading, logout } = useAuth();
  const { t } = useTranslations();
  const [applications, setApplications] = useState<AssignedApplication[]>([]);
  const [applicationsError, setApplicationsError] = useState(false);
  const [areApplicationsLoading, setAreApplicationsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, router, user]);

  useEffect(() => {
    if (!accessToken || !user) {
      return;
    }

    const controller = new AbortController();
    setAreApplicationsLoading(true);
    setApplicationsError(false);

    getAssignedApplications(accessToken, controller.signal)
      .then(setApplications)
      .catch(() => {
        if (!controller.signal.aborted) {
          setApplications([]);
          setApplicationsError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setAreApplicationsLoading(false);
        }
      });

    return () => controller.abort();
  }, [accessToken, user]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isMobileMenuOpen]);

  if (isLoading || !user) {
    return <PortalLoadingState />;
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setIsLoggingOut(false);
      setIsMobileMenuOpen(false);
    }
  }

  const shellContext: AppShellContext = {
    applications,
    applicationsError,
    areApplicationsLoading,
    user,
  };

  const navigationProps: NavigationProps = {
    applications,
    applicationsError,
    areApplicationsLoading,
    currentPath: pathname,
    isLoggingOut,
    onLogout: handleLogout,
    user,
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] border-r border-slate-300 bg-white shadow-[1px_0_2px_rgba(15,23,42,0.04)] lg:flex lg:flex-col">
        <Navigation {...navigationProps} />
      </aside>

      <div className="lg:pl-[232px]">
        <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-300 bg-white px-4 lg:hidden">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold tracking-tight text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded bg-blue-700 text-[11px] font-bold text-white"
            >
              IA
            </span>
            {t("common.shortProductName")}
          </Link>
          <button
            type="button"
            aria-controls="mobile-navigation"
            aria-expanded={isMobileMenuOpen}
            aria-label={
              isMobileMenuOpen ? t("navigation.close") : t("navigation.open")
            }
            onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            {isMobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label={t("navigation.close")}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-slate-950/30"
            />
            <aside
              id="mobile-navigation"
              className="relative flex h-full w-72 max-w-[86vw] flex-col border-r border-slate-300 bg-white shadow-xl"
            >
              <Navigation
                {...navigationProps}
                onNavigate={() => setIsMobileMenuOpen(false)}
              />
            </aside>
          </div>
        )}

        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-7">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-950">
                {title}
              </h1>
              {description && (
                <p className="mt-0.5 max-w-3xl text-sm leading-5 text-slate-600">
                  {description}
                </p>
              )}
            </div>
            <div className="hidden min-w-0 items-center gap-3 text-right xl:flex">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                {getInitials(user.displayName)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                {user.displayName}
                </p>
                <p className="truncate text-xs text-slate-500">{user.username}</p>
              </div>
            </div>
          </div>
        </header>

        {commandBar && (
          <section
            aria-label={t("navigation.pageCommands")}
            className="border-b border-slate-200 bg-white"
          >
            <div className="mx-auto flex min-h-12 max-w-[1600px] items-center px-4 py-2 sm:px-6 lg:px-7">
              {commandBar}
            </div>
          </section>
        )}

        {secondaryNavigation && (
          <section
            aria-label={t("navigation.pageNavigation")}
            className="border-b border-slate-200 bg-white"
          >
            <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-7">
              {secondaryNavigation}
            </div>
          </section>
        )}

        <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-7">
          {typeof children === "function" ? children(shellContext) : children}
        </main>
      </div>
    </div>
  );
}

function Navigation({
  applications,
  applicationsError,
  areApplicationsLoading,
  currentPath,
  isLoggingOut,
  onNavigate,
  onLogout,
  user,
}: NavigationProps) {
  const { locale, setLocale, t } = useTranslations();
  const { appearance, setAppearance } = useAppearance();
  const primaryRole = user.roles[0] ?? t("shell.noRole");
  const showDevelopmentNavigation =
    process.env.NODE_ENV !== "production" ||
    user.permissions.includes(usersManagePermission);

  return (
    <>
      <div className="flex h-16 items-center border-b border-slate-300 px-4">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded bg-blue-700 text-xs font-bold text-white"
          >
            IA
          </span>
          <span>
            <span className="block text-[15px] font-semibold tracking-tight text-slate-950">
              {t("common.shortProductName")}
            </span>
            <span className="block text-[11px] text-slate-500">
              {t("common.companyPortal")}
            </span>
          </span>
        </Link>
      </div>

      <nav
        aria-label={t("navigation.primary")}
        className="flex-1 overflow-y-auto px-3 py-4"
      >
        <NavLink
          href="/dashboard"
          isActive={currentPath === "/dashboard"}
          label={t("navigation.dashboard")}
          icon={<DashboardIcon />}
          onNavigate={onNavigate}
        />

        <p className="mb-1.5 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {t("navigation.applications")}
        </p>

        {areApplicationsLoading && (
          <p role="status" className="px-3 py-2 text-xs text-slate-500">
            {t("shell.loadingApplications")}
          </p>
        )}

        {!areApplicationsLoading && applicationsError && (
          <p className="px-3 py-2 text-xs leading-5 text-red-700">
            {t("shell.applicationsUnavailable")}
          </p>
        )}

        {!areApplicationsLoading &&
          !applicationsError &&
          applications.length === 0 && (
            <p className="px-3 py-2 text-xs leading-5 text-slate-500">
              {t("shell.noApplications")}
            </p>
          )}

        {!areApplicationsLoading &&
          !applicationsError &&
          applications.map((application) => {
            const localizedApplication = localizeApplication(application, t);

            return (
              <NavLink
                key={application.publicId}
                href={application.route}
                isActive={isRouteActive(currentPath, application.route)}
                label={localizedApplication.name}
                icon={<ApplicationIcon code={application.code} />}
                onNavigate={onNavigate}
              />
            );
          })}

        {showDevelopmentNavigation && (
          <>
            <p className="mb-1.5 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t("navigation.development")}
            </p>
            <NavLink href="/demo/calendar"
              isActive={isRouteActive(currentPath, "/demo/calendar")}
              label={t("navigation.calendarDemo")}
              icon={<CalendarIcon />}
              onNavigate={onNavigate} />
          </>
        )}
      </nav>

      <div className="border-t border-slate-300 p-3">
        <label className="mb-2 block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">
            {t("appearance.label")}
          </span>
          <select aria-label={t("appearance.label")} value={appearance}
            onChange={(event) => setAppearance(event.target.value as Appearance)}
            className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">
            {appearances.map((value) => (
              <option key={value} value={value}>
                {t(`appearance.${value}` as
                  | "appearance.light"
                  | "appearance.dark"
                  | "appearance.system")}
              </option>
            ))}
          </select>
        </label>
        <label className="mb-2 block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">
            {t("language.label")}
          </span>
          <select
            aria-label={t("language.label")}
            value={locale}
            onChange={(event) =>
              setLocale(event.target.value as SupportedLocale)
            }
            className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          >
            {supportedLocales.map((supportedLocale) => (
              <option key={supportedLocale} value={supportedLocale}>
                {localeDisplayNames[supportedLocale]}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="truncate text-sm font-medium text-slate-900">
            {user.displayName}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {user.username} · {primaryRole}
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          className="mt-2 flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogoutIcon />
          {isLoggingOut ? t("shell.loggingOut") : t("shell.logout")}
        </button>
      </div>
    </>
  );
}

function NavLink({
  href,
  icon,
  isActive,
  label,
  onNavigate,
}: {
  href: string;
  icon: ReactNode;
  isActive: boolean;
  label: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      onClick={onNavigate}
      className={`mb-0.5 flex min-h-10 items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
        isActive
          ? "border-blue-700 bg-blue-50 font-semibold text-blue-800"
          : "border-transparent font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950"
      }`}
    >
      <span aria-hidden="true" className="shrink-0">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

function PortalLoadingState() {
  const { t } = useTranslations();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <p role="status" className="text-sm text-slate-600">
        {t("shell.loadingPortal")}
      </p>
    </main>
  );
}

function isRouteActive(currentPath: string, route: string) {
  return currentPath === route || currentPath.startsWith(`${route}/`);
}

function getInitials(displayName: string) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function ApplicationIcon({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  return code === "vacation" ? (
    <CalendarIcon className={className} />
  ) : (
    <GridIcon className={className} />
  );
}

function IconBase({
  children,
  className = "h-[18px] w-[18px]",
  ...props
}: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

function DashboardIcon() {
  return (
    <IconBase>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </IconBase>
  );
}

function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </IconBase>
  );
}

function GridIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </IconBase>
  );
}

function MenuIcon() {
  return (
    <IconBase>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </IconBase>
  );
}

function CloseIcon() {
  return (
    <IconBase>
      <path d="m6 6 12 12M18 6 6 18" />
    </IconBase>
  );
}

function LogoutIcon() {
  return (
    <IconBase>
      <path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
    </IconBase>
  );
}

export function OpenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14M14 7l5 5-5 5" />
    </IconBase>
  );
}
