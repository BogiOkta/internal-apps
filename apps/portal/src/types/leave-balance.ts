export const leaveBalanceManagePermission = "identity.users.manage";

export type LeaveBalance = {
  employeeId: string;
  leaveTypeId: string;
  leaveYear: number;
  balanceDays: number;
};

export type LeaveBalanceEntryKind =
  | "annual_entitlement"
  | "carry_over"
  | "manual_adjustment"
  | "request_consumption"
  | "cancellation_reversal";

export type LeaveBalanceEntry = {
  publicId: string;
  employeeId: string;
  leaveTypeId: string;
  leaveYear: number;
  entryKind: LeaveBalanceEntryKind;
  quantityDays: number;
  effectiveDate: string;
  acceptedAt: string;
  reason: string;
  explanation: string | null;
  sourceReference: string;
};

export type PostLeaveBalanceEntryRequest = {
  employeeId: string;
  leaveTypeId: string;
  leaveYear: number;
  quantityDays: number;
  effectiveDate: string;
  reason: string;
  explanation: string | null;
  sourceReference: string;
};
