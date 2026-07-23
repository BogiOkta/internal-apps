import { ApiError } from "@/services/auth";
import type { ProblemDetails } from "@/types/auth";
import type {
  Department,
  DepartmentSort,
  Employee,
  EmployeeSort,
} from "@/types/organization";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

type DepartmentQuery = {
  search?: string;
  sort?: DepartmentSort;
};

type EmployeeQuery = {
  search?: string;
  departmentPublicId?: string;
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
