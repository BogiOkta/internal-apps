// Shared Organization read models consumed by Vacation and future applications.
export type Department = {
  publicId: string;
  code: string;
  name: string;
};

export type Employee = {
  publicId: string;
  employeeNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string | null;
  employmentStartDate: string | null;
  employmentEndDate: string | null;
  departmentPublicId: string;
  departmentCode: string;
  departmentName: string;
  employmentStatus: "Active" | "Inactive";
};

export type DepartmentSort = "name" | "-name" | "code" | "-code";

export type EmployeeSort =
  | "name"
  | "-name"
  | "employeeNumber"
  | "-employeeNumber"
  | "department"
  | "-department"
  | "email"
  | "-email"
  | "status"
  | "-status";

export const employeesManagePermission = "organization.employees.manage";
export const userEmployeeLinksManagePermission =
  "organization.user-employee-links.manage";

export type EmployeeStatusFilter = "all" | "active" | "inactive";

export type CreateEmployeeRequest = {
  employeeNumber: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email?: string | null;
  employmentStartDate?: string | null;
  employmentEndDate?: string | null;
  departmentPublicId: string;
  isActive: boolean;
};

export type UpdateEmployeeRequest = Omit<
  CreateEmployeeRequest,
  "employeeNumber" | "isActive"
>;

export type UserEmployeeLink = {
  publicId: string;
  userPublicId: string;
  username: string;
  userDisplayName: string;
  userIsActive: boolean;
  employee: Employee;
};

export type UserLinkOption = {
  publicId: string; username: string; displayName: string; isActive: boolean;
};

export type EmployeeLinkOption = {
  publicId: string; employeeNumber: string; firstName: string; lastName: string;
  departmentName: string; isActive: boolean;
};

export type UserEmployeeLinkOptions = {
  users: UserLinkOption[];
  employees: EmployeeLinkOption[];
};
