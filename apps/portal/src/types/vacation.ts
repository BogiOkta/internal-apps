export type LeaveType = {
  publicId: string;
  code: string;
  name: string;
  description: string | null;
  calendarColor: string | null;
  countsAgainstVacationBalance: boolean;
  requiresApproval: boolean;
  isActive: boolean;
  displayOrder: number;
};

export type LeaveTypeDetails = LeaveType & {
  nameSr: string;
  nameEn: string;
  descriptionSr: string | null;
  descriptionEn: string | null;
};

export type CreateLeaveTypeRequest = {
  code: string;
  nameSr: string;
  nameEn: string;
  descriptionSr: string | null;
  descriptionEn: string | null;
  calendarColor: string | null;
  countsAgainstVacationBalance: boolean;
  requiresApproval: boolean;
  isActive: boolean;
  displayOrder: number;
};

export type UpdateLeaveTypeRequest = Omit<
  CreateLeaveTypeRequest,
  "code" | "isActive"
>;

export type LeaveTypeStatusFilter = "active" | "inactive" | "all";

export type LeaveTypeSortField =
  | "displayOrder"
  | "code"
  | "name"
  | "status";

export type LeaveTypeSortDirection = "asc" | "desc";

export type LeaveTypeQuery = {
  search?: string;
  status?: LeaveTypeStatusFilter;
  sortBy?: LeaveTypeSortField;
  sortDirection?: LeaveTypeSortDirection;
};

export const leaveTypesManagePermission = "vacation.leave-types.manage";
