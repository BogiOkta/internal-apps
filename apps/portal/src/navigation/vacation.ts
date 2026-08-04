import { leaveBalanceManagePermission } from "@/types/leave-balance";
import {
  leaveTypesManagePermission,
  vacationRequestsManagePermission,
} from "@/types/vacation";
import type { WorkspaceDescriptor } from "./types";

/**
 * Vacation workspace descriptor for the Information Architecture pilot.
 * Routes are unchanged; only navigation placement moves into the sidebar.
 *
 * Leave-types visibility follows IA Q9: gated by `vacation.leave-types.manage`
 * so Administracija does not appear for employees who only need the request form.
 */
export const vacationWorkspace: WorkspaceDescriptor = {
  id: "vacation",
  applicationCode: "vacation",
  group: "operations",
  labelKey: "applications.vacation.name",
  routePrefix: "/vacation",
  order: 10,
  defaultSectionId: "overview",
  sections: [
    {
      id: "overview",
      labelKey: "vacation.nav.overview",
      route: "/vacation",
      order: 10,
    },
    {
      id: "my-requests",
      labelKey: "vacation.nav.myRequests",
      route: "/vacation/requests",
      order: 20,
    },
    {
      id: "admin-requests",
      labelKey: "vacation.nav.adminRequests",
      route: "/vacation/admin/requests",
      requiredPermission: vacationRequestsManagePermission,
      groupLabelKey: "vacation.nav.administration",
      order: 30,
    },
    {
      id: "leave-types",
      labelKey: "vacation.nav.leaveTypes",
      route: "/vacation/leave-types",
      requiredPermission: leaveTypesManagePermission,
      groupLabelKey: "vacation.nav.administration",
      order: 40,
    },
    {
      id: "annual-entitlements",
      labelKey: "vacation.nav.annualEntitlements",
      route: "/vacation/admin/policies",
      requiredPermission: leaveBalanceManagePermission,
      groupLabelKey: "vacation.nav.administration",
      order: 50,
    },
    {
      id: "leave-balances",
      labelKey: "vacation.nav.leaveBalances",
      route: "/vacation/admin/leave-balances",
      requiredPermission: leaveBalanceManagePermission,
      groupLabelKey: "vacation.nav.administration",
      order: 60,
    },
  ],
};
