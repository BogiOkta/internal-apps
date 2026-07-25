import type { AppCalendarEvent } from "@/components/calendar";
import type {
  VacationRequest,
  VacationRequestStatus,
} from "@/types/vacation";

export function parseApiDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toApiDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addCalendarDays(value: string, days: number): string {
  const date = parseApiDate(value);
  date.setDate(date.getDate() + days);
  return toApiDate(date);
}

export function isCancellationEligible(status: VacationRequestStatus): boolean {
  return status === "SUBMITTED" || status === "APPROVED";
}

export function toVacationCalendarEvent(
  request: VacationRequest,
): AppCalendarEvent<VacationRequest> {
  return {
    id: request.publicId,
    title: request.leaveTypeName,
    start: request.dateFrom,
    // FullCalendar all-day event ends are exclusive; API dateTo is inclusive.
    end: addCalendarDays(request.dateTo, 1),
    allDay: true,
    color: request.leaveTypeColor ?? undefined,
    status: request.status.toLowerCase(),
    resource: request,
  };
}

export const vacationProblemTranslationKeys: Record<string, string> = {
  current_user_employee_not_linked: "vacation.employeePortal.error.unlinked",
  vacation_leave_type_not_found: "vacation.employeePortal.error.leaveTypeNotFound",
  vacation_leave_type_inactive: "vacation.employeePortal.error.leaveTypeInactive",
  vacation_request_invalid_date_range: "vacation.employeePortal.error.invalidRange",
  vacation_request_no_working_days: "vacation.employeePortal.error.noWorkingDays",
  vacation_request_cross_year_not_allowed: "vacation.employeePortal.error.crossYear",
  vacation_request_overlap: "vacation.employeePortal.error.overlap",
  vacation_request_invalid_transition: "vacation.employeePortal.error.invalidTransition",
  vacation_request_not_found: "vacation.employeePortal.error.notFound",
  vacation_balance_not_found: "vacation.employeePortal.error.balanceNotFound",
  vacation_balance_insufficient: "vacation.employeePortal.error.balanceInsufficient",
  vacation_balance_invalid: "vacation.employeePortal.error.balanceInvalid",
};
