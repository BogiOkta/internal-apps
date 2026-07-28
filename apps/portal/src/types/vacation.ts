export type LeaveType = {
  publicId: string;
  code: string;
  name: string;
  description: string | null;
  calendarColor: string | null;
  countsAgainstVacationBalance: boolean;
  requiresBalance: boolean;
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
  requiresBalance: boolean;
  requiresApproval: boolean;
  isActive: boolean;
  displayOrder: number;
};

export type UpdateLeaveTypeRequest = Omit<
  CreateLeaveTypeRequest,
  "code" | "requiresBalance" | "isActive"
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

export type VacationRequestStatus =
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type VacationLeaveTypeOption = {
  publicId: string;
  code: string;
  name: string;
  description: string | null;
  color: string | null;
  countsAgainstBalance: boolean;
  requiresBalance: boolean;
};

export type VacationRequest = {
  publicId: string;
  employeePublicId: string;
  employeeNumber: string;
  employeeName: string;
  departmentPublicId: string;
  departmentName: string;
  leaveTypePublicId: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  leaveTypeColor: string | null;
  dateFrom: string;
  dateTo: string;
  workingDays: number;
  status: VacationRequestStatus;
  employeeNote: string | null;
  decisionNote: string | null;
  submittedAt: string;
  decidedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VacationRequestHistory = {
  publicId: string;
  previousStatus: VacationRequestStatus | null;
  newStatus: VacationRequestStatus;
  changedByUserPublicId: string;
  changedByDisplayName: string;
  comment: string | null;
  changedAt: string;
};

export type VacationBalance = {
  publicId: string;
  employeePublicId: string;
  leaveTypePublicId: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  year: number;
  entitlementDays: number;
  carryOverDays: number;
  adjustmentDays: number;
  usedDays: number;
  availableDays: number;
};

export type CreateVacationRequest = {
  leaveTypeId: string;
  dateFrom: string;
  dateTo: string;
  note: string | null;
};

export type CancelVacationRequest = {
  comment: string | null;
};

export type VacationRequestTransition = {
  comment: string | null;
};

export type VacationAdminRequestQuery = {
  status?: VacationRequestStatus;
  leaveTypeId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export type PagedVacationRequests = {
  items: VacationRequest[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export const vacationRequestsManagePermission = "vacation.requests.manage";
