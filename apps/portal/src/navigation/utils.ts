import type { Translate } from "@/i18n/translations";
import type {
  BreadcrumbNode,
  SectionDescriptor,
  WorkspaceDescriptor,
} from "./types";

export function filterVisibleSections(
  sections: SectionDescriptor[],
  permissions: readonly string[],
): SectionDescriptor[] {
  return sections
    .filter((section) =>
      section.requiredPermission
        ? permissions.includes(section.requiredPermission)
        : true,
    )
    .sort((left, right) => left.order - right.order);
}

export function findActiveSection(
  sections: SectionDescriptor[],
  pathname: string,
): SectionDescriptor | undefined {
  const matches = sections
    .filter((section) => isSectionRouteActive(pathname, section.route))
    .sort((left, right) => right.route.length - left.route.length);

  return matches[0];
}

/**
 * Exact match for workspace-root section routes (e.g. `/vacation`,
 * `/organization`); prefix match for all other section routes.
 */
export function isSectionRouteActive(pathname: string, route: string): boolean {
  const isWorkspaceRootSection = route.lastIndexOf("/") === 0;

  if (isWorkspaceRootSection) {
    return pathname === route;
  }

  return pathname === route || pathname.startsWith(`${route}/`);
}

export function isWorkspaceRouteActive(
  pathname: string,
  workspace: WorkspaceDescriptor,
): boolean {
  if (
    pathname === workspace.routePrefix ||
    pathname.startsWith(`${workspace.routePrefix}/`)
  ) {
    return true;
  }

  return workspace.sections.some((section) =>
    isSectionRouteActive(pathname, section.route),
  );
}

/**
 * Builds Workspace › Section › [Record] breadcrumbs.
 * Section-group labels (Administracija) are never breadcrumb nodes.
 */
export function buildWorkspaceBreadcrumbs({
  workspace,
  pathname,
  permissions,
  translate,
  recordLabel,
}: {
  workspace: WorkspaceDescriptor;
  pathname: string;
  permissions: readonly string[];
  translate: Translate;
  recordLabel?: string;
}): BreadcrumbNode[] {
  const visible = filterVisibleSections(workspace.sections, permissions);
  const active = findActiveSection(visible, pathname);
  const workspaceLabel = translate(workspace.labelKey);

  const nodes: BreadcrumbNode[] = [
    {
      label: workspaceLabel,
      href: workspace.routePrefix,
    },
  ];

  if (active) {
    nodes.push({
      label: translate(active.labelKey),
      href: recordLabel ? active.route : undefined,
    });
  }

  if (recordLabel) {
    nodes.push({ label: recordLabel });
  }

  return nodes;
}

export function hasVisibleAdministrationSections(
  sections: SectionDescriptor[],
): boolean {
  return sections.some((section) => section.groupLabelKey !== undefined);
}

export function partitionSections(sections: SectionDescriptor[]): {
  operational: SectionDescriptor[];
  administrative: SectionDescriptor[];
  administrationLabelKey: SectionDescriptor["groupLabelKey"];
} {
  const operational = sections.filter((section) => !section.groupLabelKey);
  const administrative = sections.filter((section) => section.groupLabelKey);
  const administrationLabelKey = administrative[0]?.groupLabelKey;

  return { operational, administrative, administrationLabelKey };
}
