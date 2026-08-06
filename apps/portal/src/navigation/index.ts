import { identityWorkspace } from "./identity";
import { organizationWorkspace } from "./organization";
import { vacationWorkspace } from "./vacation";
import type { WorkspaceDescriptor } from "./types";

const workspaceRegistry: WorkspaceDescriptor[] = [
  organizationWorkspace,
  vacationWorkspace,
  identityWorkspace,
];

export function getWorkspaceByApplicationCode(
  code: string,
): WorkspaceDescriptor | undefined {
  return workspaceRegistry.find(
    (workspace) => workspace.applicationCode === code,
  );
}

export function getWorkspaceByRoutePrefix(
  pathname: string,
): WorkspaceDescriptor | undefined {
  const byPrefix = workspaceRegistry.find(
    (workspace) =>
      pathname === workspace.routePrefix ||
      pathname.startsWith(`${workspace.routePrefix}/`),
  );

  if (byPrefix) {
    return byPrefix;
  }

  return workspaceRegistry.find((workspace) =>
    workspace.sections.some(
      (section) =>
        pathname === section.route || pathname.startsWith(`${section.route}/`),
    ),
  );
}

/** Company-group workspaces rendered outside assigned-applications. */
export function getCompanyWorkspaces(): WorkspaceDescriptor[] {
  return workspaceRegistry
    .filter((workspace) => workspace.group === "company")
    .sort((left, right) => left.order - right.order);
}

/** Platform-group workspaces rendered outside assigned-applications. */
export function getPlatformWorkspaces(): WorkspaceDescriptor[] {
  return workspaceRegistry
    .filter((workspace) => workspace.group === "platform")
    .sort((left, right) => left.order - right.order);
}

export { identityWorkspace, organizationWorkspace, vacationWorkspace };
export type {
  BreadcrumbNode,
  NavigationGroupId,
  SectionDescriptor,
  WorkspaceDescriptor,
} from "./types";
export {
  buildWorkspaceBreadcrumbs,
  filterVisibleSections,
  findActiveSection,
  hasVisibleAdministrationSections,
  isSectionRouteActive,
  isWorkspaceRouteActive,
  partitionSections,
} from "./utils";
