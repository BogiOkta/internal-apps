import { getApiBaseUrl } from "@/services/api-config";
import { ApiError } from "@/services/auth";
import type { ProblemDetails } from "@/types/auth";
import type {
  LeaveBalance,
  LeaveBalanceEntry,
  LeaveBalanceScope,
  PostLeaveBalanceEntryRequest,
} from "@/types/leave-balance";

const apiBaseUrl = getApiBaseUrl();
const resourcePath = "/api/v1/vacation/leave-balances";

export type LeaveBalanceScopeQuery = {
  employeeId?: string;
  leaveTypeId?: string;
  year?: number;
  search?: string;
};

export function listLeaveBalanceScopes(
  accessToken: string,
  locale: string,
  query: LeaveBalanceScopeQuery = {},
  signal?: AbortSignal,
): Promise<LeaveBalanceScope[]> {
  const params = new URLSearchParams();
  if (query.employeeId) params.set("employeeId", query.employeeId);
  if (query.leaveTypeId) params.set("leaveTypeId", query.leaveTypeId);
  if (query.year !== undefined) params.set("year", String(query.year));
  if (query.search?.trim()) params.set("search", query.search.trim());
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`${resourcePath}/scopes${suffix}`, accessToken, {
    signal,
    locale,
  });
}

export function getLeaveBalance(
  accessToken: string,
  employeeId: string,
  leaveTypeId: string,
  year: number,
  signal?: AbortSignal,
): Promise<LeaveBalance> {
  return request(
    `${resourcePath}?${new URLSearchParams({
      employeeId,
      leaveTypeId,
      year: String(year),
    })}`,
    accessToken,
    { signal },
  );
}

export function listLeaveBalanceHistory(
  accessToken: string,
  employeeId: string,
  leaveTypeId: string,
  year: number,
  signal?: AbortSignal,
): Promise<LeaveBalanceEntry[]> {
  return request(
    `${resourcePath}/history?${new URLSearchParams({
      employeeId,
      leaveTypeId,
      year: String(year),
    })}`,
    accessToken,
    { signal },
  );
}

export function postLeaveBalanceEntry(
  accessToken: string,
  kind: "annual_entitlement" | "carry_over" | "manual_adjustment",
  body: PostLeaveBalanceEntryRequest,
): Promise<LeaveBalanceEntry> {
  const paths = {
    annual_entitlement: "entitlements",
    carry_over: "carry-overs",
    manual_adjustment: "manual-adjustments",
  } as const;
  return request(`${resourcePath}/${paths[kind]}`, accessToken, {
    method: "POST",
    body,
  });
}

async function request<T>(
  path: string,
  accessToken: string,
  options: {
    signal?: AbortSignal;
    method?: string;
    body?: object;
    locale?: string;
  } = {},
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    signal: options.signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.locale ? { "Accept-Language": options.locale } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (response.ok) return response.json() as Promise<T>;
  const problem = (await response.json().catch(() => null)) as ProblemDetails | null;
  throw new ApiError(
    problem?.detail ?? problem?.title ?? "Leave balance request failed.",
    problem ?? undefined,
    response.status,
  );
}
