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
