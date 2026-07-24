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
  lastName: string;
  email: string;
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

export type EmployeeStatusFilter = "all" | "active" | "inactive";

export type CreateEmployeeRequest = {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentPublicId: string;
  isActive: boolean;
};

export type UpdateEmployeeRequest = Omit<
  CreateEmployeeRequest,
  "employeeNumber" | "isActive"
>;
