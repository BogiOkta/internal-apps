import { businessCalendarManagePermission } from "@/types/business-calendar";
import { userEmployeeLinksManagePermission } from "@/types/organization";
import type { WorkspaceDescriptor } from "./types";

/**
 * Organization workspace descriptor (Portal v2 consumer of the Vacation IA model).
 * Existing routes are preserved. Non-working days remain at the Business Calendar
 * route and appear here as company master-data navigation.
 *
 * User–employee links stay under an expandable Administration group so the
 * operational list matches the approved Organization sections while the
 * existing links administration route remains reachable.
 */
export const organizationWorkspace: WorkspaceDescriptor = {
  id: "organization",
  applicationCode: "organization",
  group: "company",
  labelKey: "organization.workspace.name",
  routePrefix: "/organization",
  order: 10,
  defaultSectionId: "overview",
  sections: [
    {
      id: "overview",
      labelKey: "organization.nav.overview",
      route: "/organization",
      order: 10,
    },
    {
      id: "departments",
      labelKey: "organization.nav.departments",
      route: "/organization/departments",
      order: 20,
    },
    {
      id: "employees",
      labelKey: "organization.nav.employees",
      route: "/organization/employees",
      order: 30,
    },
    {
      id: "non-working-days",
      labelKey: "organization.nav.nonWorkingDays",
      route: "/business-calendar/admin/non-working-days",
      requiredPermission: businessCalendarManagePermission,
      order: 40,
    },
    {
      id: "user-employee-links",
      labelKey: "organization.nav.userEmployeeLinks",
      route: "/organization/user-employee-links",
      requiredPermission: userEmployeeLinksManagePermission,
      groupLabelKey: "organization.nav.administration",
      order: 50,
    },
  ],
};
