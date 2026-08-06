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
  /** Canonical seeded type; read-only and never client-settable. */
  isSystem: boolean;
  displayOrder: number;
  /**
   * True once a leave request, yearly balance, or ledger entry has referenced the
   * leave type. Balance behaviour is then locked and physical deletion is refused.
   */
  isInUse: boolean;
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

/**
 * Code is immutable after creation and activation uses its own commands. Balance
 * behaviour stays in the contract but the API rejects a changed value once the
 * leave type is in use.
 */
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
  source: VacationRequestSource;
  employeeNote: string | null;
  decisionNote: string | null;
  submittedAt: string;
  decidedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VacationRequestSource = "EMPLOYEE_REQUEST" | "ADMINISTRATIVE_ENTRY";

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

export type RecordAdministrativeAbsence = {
  employeeId: string;
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
  source?: VacationRequestSource;
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
