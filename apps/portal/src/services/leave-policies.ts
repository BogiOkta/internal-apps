import { getApiBaseUrl } from "@/services/api-config";
import { ApiError } from "@/services/auth";
import type { ProblemDetails } from "@/types/auth";
import type { LeavePolicy, SaveLeavePolicyRequest } from "@/types/leave-policy";

const apiBaseUrl = getApiBaseUrl();
const resourcePath = "/api/v1/vacation/leave-policies";

export function listLeavePolicies(
  accessToken: string,
  year?: number,
  employee?: string,
  signal?: AbortSignal,
): Promise<LeavePolicy[]> {
  const query = new URLSearchParams();
  if (year) query.set("year", String(year));
  if (employee) query.set("employee", employee);
  return request(`${resourcePath}?${query}`, accessToken, { signal });
}

export function createLeavePolicy(
  accessToken: string,
  body: SaveLeavePolicyRequest,
): Promise<LeavePolicy> {
  return request(resourcePath, accessToken, { method: "POST", body });
}

export function updateLeavePolicy(
  accessToken: string,
  policyId: string,
  body: SaveLeavePolicyRequest,
): Promise<LeavePolicy> {
  return request(`${resourcePath}/${encodeURIComponent(policyId)}`, accessToken, {
    method: "PUT", body,
  });
}

export function deleteLeavePolicy(accessToken: string, policyId: string): Promise<void> {
  return request(`${resourcePath}/${encodeURIComponent(policyId)}`, accessToken, {
    method: "DELETE",
  });
}

async function request<T>(
  path: string,
  accessToken: string,
  options: { signal?: AbortSignal; method?: string; body?: object } = {},
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    signal: options.signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (response.ok)
    return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
  const problem = (await response.json().catch(() => null)) as ProblemDetails | null;
  throw new ApiError(problem?.detail ?? problem?.title ?? "Leave policy request failed.",
    problem ?? undefined, response.status);
}
