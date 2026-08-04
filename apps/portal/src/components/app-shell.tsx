"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  type ReactNode,
  type SVGProps,
} from "react";
import { useAuth } from "@/components/auth-provider";
import { localizeApplication } from "@/i18n/translations";
import { useTranslations } from "@/i18n/use-translations";
import { getAssignedApplications } from "@/services/applications";
import type { AssignedApplication } from "@/types/application";
import type { CurrentUser } from "@/types/auth";
import { usersManagePermission } from "@/types/auth";
import { AdministrationPageHeader } from "@/components/administration-page-header";
import { PortalBreadcrumb } from "@/components/portal-breadcrumb";
import {
  filterVisibleSections,
  getCompanyWorkspaces,
  getWorkspaceByApplicationCode,
  isSectionRouteActive,
  isWorkspaceRouteActive,
  partitionSections,
  type BreadcrumbNode,
  type SectionDescriptor,
  type WorkspaceDescriptor,
} from "@/navigation";

type AppShellContext = {
  applications: AssignedApplication[];
  applicationsError: boolean;
  areApplicationsLoading: boolean;
  user: CurrentUser;
};

type AppShellProps = {
  title?: string;
  description?: string;
  headerActions?: ReactNode;
  secondaryNavigation?: ReactNode;
  contentFillsViewport?: boolean;
  /**
   * `workspace` = Vacation IA pilot layout: breadcrumb + profile header,
   * no stacked module title band. Page title is owned by the child page header.
   */
  layoutMode?: "default" | "workspace";
  breadcrumbs?: BreadcrumbNode[];
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
  headerActions,
  secondaryNavigation,
  contentFillsViewport = false,
  layoutMode = "default",
  breadcrumbs,
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
  const isWorkspaceLayout = layoutMode === "workspace";

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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] border-r border-slate-300 bg-white shadow-[1px_0_2px_rgba(15,23,42,0.04)] lg:flex lg:flex-col">
        <Navigation {...navigationProps} />
      </aside>

      <div className={`lg:pl-[240px] ${contentFillsViewport ? "lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden" : ""}`}>
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

        {isWorkspaceLayout ? (
          <header className="sticky top-14 z-20 border-b border-slate-200 bg-white lg:top-0">
            <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-7">
              <div className="min-w-0 flex-1">
                {breadcrumbs && breadcrumbs.length > 0 ? (
                  <PortalBreadcrumb
                    items={breadcrumbs}
                    ariaLabel={t("navigation.breadcrumb")}
                  />
                ) : (
                  <p className="truncate text-xs font-medium text-slate-500">
                    {t("applications.vacation.name")}
                  </p>
                )}
              </div>
              <WorkspaceProfileMenu
                displayName={user.displayName}
                username={user.username}
                settingsLabel={t("navigation.settings")}
                profileMenuLabel={t("navigation.profileMenu")}
              />
            </div>
          </header>
        ) : (
          <>
            <header className="border-b border-slate-200 bg-white">
              {headerActions ? (
                <AdministrationPageHeader
                  title={title ?? ""}
                  description={description}
                  actions={headerActions}
                />
              ) : (
                <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 lg:px-7">
                  <h1 className="text-xl font-semibold tracking-tight text-slate-950">
                    {title}
                  </h1>
                  {description && (
                    <p className="mt-0.5 max-w-3xl text-sm leading-5 text-slate-600">
                      {description}
                    </p>
                  )}
                </div>
              )}
            </header>

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
          </>
        )}

        <main
          className={`mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-7 ${
            isWorkspaceLayout ? "py-5" : "py-6"
          } ${contentFillsViewport ? "lg:flex lg:min-h-0 lg:w-full lg:flex-1 lg:flex-col" : ""}`}
        >
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
  const { t } = useTranslations();
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
            const workspace = getWorkspaceByApplicationCode(application.code);

            if (workspace) {
              return (
                <WorkspaceNavBlock
                  key={application.publicId}
                  workspace={workspace}
                  workspaceLabel={localizedApplication.name}
                  currentPath={currentPath}
                  permissions={user.permissions}
                  onNavigate={onNavigate}
                />
              );
            }

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

        <p className="mb-1.5 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {t("navigation.companyAdministration")}
        </p>
        {getCompanyWorkspaces().map((workspace) => (
          <WorkspaceNavBlock
            key={workspace.id}
            workspace={workspace}
            workspaceLabel={t(workspace.labelKey)}
            currentPath={currentPath}
            permissions={user.permissions}
            onNavigate={onNavigate}
          />
        ))}
        {user.permissions.includes(usersManagePermission) && (
          <NavLink
            href="/identity/users"
            isActive={isRouteActive(currentPath, "/identity/users")}
            label={t("identity.users.navigation")}
            icon={<UsersIcon />}
            onNavigate={onNavigate}
          />
        )}

        {showDevelopmentNavigation && (
          <>
            <p className="mb-1.5 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t("navigation.development")}
            </p>
            <NavLink
              href="/demo/calendar"
              isActive={isRouteActive(currentPath, "/demo/calendar")}
              label={t("navigation.calendarDemo")}
              icon={<CalendarIcon />}
              onNavigate={onNavigate}
            />
          </>
        )}

        <p className="mb-1.5 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {t("navigation.settings")}
        </p>
        <NavLink
          href="/settings"
          isActive={isRouteActive(currentPath, "/settings")}
          label={t("navigation.settings")}
          icon={<SettingsIcon />}
          onNavigate={onNavigate}
        />
      </nav>

      <div className="border-t border-slate-300 p-3">
        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogoutIcon />
          {isLoggingOut ? t("shell.loggingOut") : t("shell.logout")}
        </button>
      </div>
    </>
  );
}

function WorkspaceNavBlock({
  workspace,
  workspaceLabel,
  currentPath,
  permissions,
  onNavigate,
}: {
  workspace: WorkspaceDescriptor;
  workspaceLabel: string;
  currentPath: string;
  permissions: readonly string[];
  onNavigate?: () => void;
}) {
  const { t } = useTranslations();
  const isExpanded = isWorkspaceRouteActive(currentPath, workspace);
  const visibleSections = filterVisibleSections(workspace.sections, permissions);
  const { operational, administrative, administrationLabelKey } =
    partitionSections(visibleSections);
  const adminChildActive = administrative.some((section) =>
    isSectionRouteActive(currentPath, section.route),
  );
  const [adminExpanded, setAdminExpanded] = useState(adminChildActive);

  useEffect(() => {
    setAdminExpanded(adminChildActive);
  }, [adminChildActive, currentPath]);

  return (
    <div className="mb-0.5">
      <NavLink
        href={workspace.routePrefix}
        isActive={false}
        isExpandedContext={isExpanded}
        label={workspaceLabel}
        icon={<ApplicationIcon code={workspace.applicationCode} />}
        onNavigate={onNavigate}
      />

      {isExpanded && (
        <div className="mb-1 mt-0.5 space-y-0.5 border-l border-slate-200 ml-5 pl-0">
          {operational.map((section) => (
            <SectionNavLink
              key={section.id}
              section={section}
              label={t(section.labelKey)}
              isActive={isSectionRouteActive(currentPath, section.route)}
              onNavigate={onNavigate}
            />
          ))}

          {administrative.length > 0 && administrationLabelKey && (
            <AdministrationNavGroup
              label={t(administrationLabelKey)}
              isExpanded={adminExpanded}
              onToggle={() => setAdminExpanded((value) => !value)}
              sections={administrative}
              currentPath={currentPath}
              onNavigate={onNavigate}
              translateLabel={(section) => t(section.labelKey)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function AdministrationNavGroup({
  label,
  isExpanded,
  onToggle,
  sections,
  currentPath,
  onNavigate,
  translateLabel,
}: {
  label: string;
  isExpanded: boolean;
  onToggle: () => void;
  sections: SectionDescriptor[];
  currentPath: string;
  onNavigate?: () => void;
  translateLabel: (section: SectionDescriptor) => string;
}) {
  return (
    <div>
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={onToggle}
        className="mb-0.5 flex min-h-8 w-full items-center gap-2 rounded-md px-3 py-1 pl-5 text-left text-[12px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
      >
        <span aria-hidden="true" className="w-3 shrink-0 text-slate-400">
          {isExpanded ? "▾" : "▸"}
        </span>
        <span className="whitespace-nowrap">{label}</span>
      </button>
      {isExpanded &&
        sections.map((section) => (
          <SectionNavLink
            key={section.id}
            section={section}
            label={translateLabel(section)}
            isActive={isSectionRouteActive(currentPath, section.route)}
            onNavigate={onNavigate}
            nested
          />
        ))}
    </div>
  );
}

function SectionNavLink({
  section,
  label,
  isActive,
  onNavigate,
  nested = false,
}: {
  section: SectionDescriptor;
  label: string;
  isActive: boolean;
  onNavigate?: () => void;
  nested?: boolean;
}) {
  return (
    <Link
      href={section.route}
      aria-current={isActive ? "page" : undefined}
      onClick={onNavigate}
      title={label}
      className={`mb-0.5 flex min-h-9 items-center rounded-md py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
        nested ? "pl-8 pr-3" : "pl-5 pr-3"
      } ${
        isActive
          ? "bg-blue-50 font-semibold text-blue-800 ring-1 ring-inset ring-blue-200"
          : "font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950"
      }`}
    >
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
}

function WorkspaceProfileMenu({
  displayName,
  username,
  settingsLabel,
  profileMenuLabel,
}: {
  displayName: string;
  username: string;
  settingsLabel: string;
  profileMenuLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={profileMenuLabel}
        onClick={() => setIsOpen((value) => !value)}
        className="inline-flex max-w-[220px] items-center gap-2 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700"
        >
          {profileInitials(displayName || username)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-slate-900">
            {displayName}
          </span>
          <span className="block truncate text-[11px] text-slate-500">
            {username}
          </span>
        </span>
      </button>
      {isOpen && (
        <>
          <button
            type="button"
            aria-label={profileMenuLabel}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setIsOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-1 w-52 rounded-md border border-slate-300 bg-white py-1 shadow-md"
          >
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
            >
              {settingsLabel}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function profileInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "U";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function NavLink({
  href,
  icon,
  isActive,
  isExpandedContext = false,
  label,
  onNavigate,
}: {
  href: string;
  icon: ReactNode;
  isActive: boolean;
  /** Workspace is expanded: show containment, never page-selected chrome. */
  isExpandedContext?: boolean;
  label: string;
  onNavigate?: () => void;
}) {
  const selected = isActive;
  const expandedOnly = !selected && isExpandedContext;

  return (
    <Link
      href={href}
      aria-current={selected ? "page" : undefined}
      onClick={onNavigate}
      title={label}
      className={`mb-0.5 flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
        selected
          ? "bg-blue-50 font-semibold text-blue-800 ring-1 ring-inset ring-blue-200"
          : expandedOnly
            ? "font-semibold text-slate-900"
            : "font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950"
      }`}
    >
      <span aria-hidden="true" className="shrink-0">
        {icon}
      </span>
      <span className="whitespace-nowrap">{label}</span>
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

export function ApplicationIcon({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  if (code === "vacation") {
    return <CalendarIcon className={className} />;
  }
  if (code === "organization") {
    return <OrganizationIcon className={className} />;
  }
  return <GridIcon className={className} />;
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

function OrganizationIcon(props: SVGProps<SVGSVGElement> = {}) {
  return (
    <IconBase {...props}>
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M2 21h20M8 7h4M8 11h4M8 15h4M16 9h2M16 13h2" />
    </IconBase>
  );
}

function UsersIcon() {
  return (
    <IconBase>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
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

function SettingsIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.2.7.8 1.1 1.5 1.1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
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
