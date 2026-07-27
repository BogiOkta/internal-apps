import { ApiError } from "@/services/auth";
import { getApiBaseUrl } from "@/services/api-config";
import type { ProblemDetails } from "@/types/auth";
import type {
  Department,
  DepartmentSort,
  Employee,
  EmployeeSort,
  EmployeeStatusFilter,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  UserEmployeeLink,
  UserEmployeeLinkOptions,
} from "@/types/organization";

const apiBaseUrl = getApiBaseUrl();

type DepartmentQuery = {
  search?: string;
  sort?: DepartmentSort;
};

type EmployeeQuery = {
  search?: string;
  employeeNumber?: string;
  name?: string;
  departmentPublicId?: string;
  email?: string;
  status?: EmployeeStatusFilter;
  sort?: EmployeeSort;
};

export async function getDepartments(
  accessToken: string,
  query: DepartmentQuery = {},
  signal?: AbortSignal,
): Promise<Department[]> {
  return getOrganizationCollection<Department>(
    "/api/v1/organization/departments",
    accessToken,
    query,
    signal,
  );
}

export async function getUserEmployeeLinks(accessToken: string): Promise<UserEmployeeLink[]> {
  return organizationRequest("/api/v1/organization/user-employee-links", accessToken);
}

export async function getUserEmployeeLinkOptions(accessToken: string): Promise<UserEmployeeLinkOptions> {
  return organizationRequest("/api/v1/organization/user-employee-links/options", accessToken);
}

export async function createUserEmployeeLink(accessToken: string, userPublicId: string,
  employeePublicId: string): Promise<UserEmployeeLink> {
  return organizationRequest("/api/v1/organization/user-employee-links", accessToken,
    "POST", { userPublicId, employeePublicId });
}

export async function updateUserEmployeeLink(accessToken: string, publicId: string,
  userPublicId: string, employeePublicId: string): Promise<UserEmployeeLink> {
  return organizationRequest(`/api/v1/organization/user-employee-links/${encodeURIComponent(publicId)}`,
    accessToken, "PUT", { userPublicId, employeePublicId });
}

export async function unlinkUserEmployee(accessToken: string, publicId: string): Promise<UserEmployeeLink> {
  return organizationRequest(`/api/v1/organization/user-employee-links/${encodeURIComponent(publicId)}/unlink`,
    accessToken, "POST");
}

async function organizationRequest<T>(path: string, accessToken: string,
  method = "GET", body?: object): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method, credentials: "include",
    headers: { Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.ok) return (await response.json()) as T;
  const problem = (await response.json().catch(() => null)) as ProblemDetails | null;
  throw new ApiError(problem?.detail ?? problem?.title ?? "The request failed.",
    problem ?? undefined, response.status);
}

export async function createEmployee(
  accessToken: string,
  request: CreateEmployeeRequest,
): Promise<Employee> {
  return writeEmployee("/api/v1/organization/employees", accessToken, "POST", request);
}

export async function updateEmployee(
  accessToken: string,
  publicId: string,
  request: UpdateEmployeeRequest,
): Promise<Employee> {
  return writeEmployee(`/api/v1/organization/employees/${encodeURIComponent(publicId)}`,
    accessToken, "PUT", request);
}

export async function activateEmployee(accessToken: string, publicId: string): Promise<Employee> {
  return writeEmployee(`/api/v1/organization/employees/${encodeURIComponent(publicId)}/activate`,
    accessToken, "POST");
}

export async function deactivateEmployee(accessToken: string, publicId: string): Promise<Employee> {
  return writeEmployee(`/api/v1/organization/employees/${encodeURIComponent(publicId)}/deactivate`,
    accessToken, "POST");
}

export async function deleteEmployee(accessToken: string, publicId: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/v1/organization/employees/${encodeURIComponent(publicId)}`, {
    method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include",
  });
  if (response.ok) return;
  const problem = (await response.json().catch(() => null)) as ProblemDetails | null;
  throw new ApiError(problem?.detail ?? problem?.title ?? "The employee could not be deleted.", problem ?? undefined, response.status);
}

async function writeEmployee(
  path: string,
  accessToken: string,
  method: "POST" | "PUT",
  body?: CreateEmployeeRequest | UpdateEmployeeRequest,
): Promise<Employee> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.ok) return (await response.json()) as Employee;
  const problem = (await response.json().catch(() => null)) as ProblemDetails | null;
  throw new ApiError(problem?.title ?? "The employee could not be saved.",
    problem ?? undefined, response.status);
}

export async function getEmployees(
  accessToken: string,
  query: EmployeeQuery = {},
  signal?: AbortSignal,
): Promise<Employee[]> {
  return getOrganizationCollection<Employee>(
    "/api/v1/organization/employees",
    accessToken,
    query,
    signal,
  );
}

async function getOrganizationCollection<T>(
  path: string,
  accessToken: string,
  query: Record<string, string | undefined>,
  signal?: AbortSignal,
): Promise<T[]> {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const queryString = searchParams.toString();
  const response = await fetch(
    `${apiBaseUrl}${path}${queryString ? `?${queryString}` : ""}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: "include",
      signal,
    },
  );

  if (response.ok) {
    return (await response.json()) as T[];
  }

  const problem = (await response.json().catch(() => null)) as ProblemDetails | null;
  throw new ApiError(
    problem?.title ?? "The Organization data could not be loaded.",
    problem ?? undefined,
  );
}
