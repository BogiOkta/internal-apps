import { usersManagePermission } from "@/types/auth";
import type { WorkspaceDescriptor } from "./types";

/**
 * Identity workspace descriptor (Portal v2).
 * Existing `/identity/users` route is preserved. The workspace has a single
 * Users section, so the sidebar renders one row (Rule 3.6.3).
 */
export const identityWorkspace: WorkspaceDescriptor = {
  id: "identity",
  applicationCode: "identity",
  group: "platform",
  labelKey: "identity.workspace.name",
  routePrefix: "/identity",
  order: 10,
  defaultSectionId: "users",
  sections: [
    {
      id: "users",
      labelKey: "identity.nav.users",
      route: "/identity/users",
      requiredPermission: usersManagePermission,
      order: 10,
    },
  ],
};
