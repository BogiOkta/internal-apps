export const leavePolicyManagePermission = "identity.users.manage";

export type LeavePolicy = {
  policyId: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  leaveYear: number;
  annualEntitlementDays: number;
  carryOverDays: number;
  carryOverExpirationDate: string | null;
  manualAdjustmentDays: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaveLeavePolicyRequest = {
  employeeId: string;
  leaveYear: number;
  annualEntitlementDays: number;
  carryOverDays: number;
  carryOverExpirationDate: string | null;
  manualAdjustmentDays: number;
  notes: string | null;
};
