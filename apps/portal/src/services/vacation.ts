import { ApiError } from "@/services/auth";
import type { ProblemDetails } from "@/types/auth";
import type {
  CreateLeaveTypeRequest,
  LeaveType,
  LeaveTypeDetails,
  LeaveTypeQuery,
  UpdateLeaveTypeRequest,
  CancelVacationRequest,
  CreateVacationRequest,
  VacationBalance,
  VacationLeaveTypeOption,
  VacationRequest,
  VacationRequestHistory,
  VacationAdminRequestQuery,
  PagedVacationRequests,
} from "@/types/vacation";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

export async function listLeaveTypes(
  accessToken: string,
  locale: string,
  query: LeaveTypeQuery = {},
  signal?: AbortSignal,
): Promise<LeaveType[]> {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const queryString = searchParams.toString();
  return requestLeaveTypes(
    `/api/v1/vacation/leave-types${queryString ? `?${queryString}` : ""}`,
    accessToken,
    locale,
    signal,
  );
}

export async function getLeaveType(
  accessToken: string,
  locale: string,
  publicId: string,
  signal?: AbortSignal,
): Promise<LeaveTypeDetails> {
  return requestLeaveTypeDetails(
    `/api/v1/vacation/leave-types/${encodeURIComponent(publicId)}`,
    accessToken,
    locale,
    signal,
  );
}

export async function createLeaveType(
  accessToken: string,
  locale: string,
  request: CreateLeaveTypeRequest,
): Promise<LeaveTypeDetails> {
  return requestLeaveTypeDetails(
    "/api/v1/vacation/leave-types",
    accessToken,
    locale,
    undefined,
    "POST",
    request,
  );
}

export async function updateLeaveType(
  accessToken: string,
  locale: string,
  publicId: string,
  request: UpdateLeaveTypeRequest,
): Promise<LeaveTypeDetails> {
  return requestLeaveTypeDetails(
    `/api/v1/vacation/leave-types/${encodeURIComponent(publicId)}`,
    accessToken,
    locale,
    undefined,
    "PUT",
    request,
  );
}

export async function activateLeaveType(
  accessToken: string,
  locale: string,
  publicId: string,
): Promise<LeaveTypeDetails> {
  return requestLeaveTypeDetails(
    `/api/v1/vacation/leave-types/${encodeURIComponent(publicId)}/activate`,
    accessToken,
    locale,
    undefined,
    "POST",
  );
}

export async function deactivateLeaveType(
  accessToken: string,
  locale: string,
  publicId: string,
): Promise<LeaveTypeDetails> {
  return requestLeaveTypeDetails(
    `/api/v1/vacation/leave-types/${encodeURIComponent(publicId)}/deactivate`,
    accessToken,
    locale,
    undefined,
    "POST",
  );
}

export function listMyVacationLeaveTypes(
  accessToken: string,
  locale: string,
  signal?: AbortSignal,
): Promise<VacationLeaveTypeOption[]> {
  return vacationRequest("/api/v1/vacation/me/leave-types", accessToken, locale, {
    signal,
  });
}

export function listMyVacationRequests(
  accessToken: string,
  locale: string,
  signal?: AbortSignal,
): Promise<VacationRequest[]> {
  return vacationRequest("/api/v1/vacation/me/requests", accessToken, locale, {
    signal,
  });
}

export function getMyVacationRequest(
  accessToken: string,
  locale: string,
  publicId: string,
  signal?: AbortSignal,
): Promise<VacationRequest> {
  return vacationRequest(
    `/api/v1/vacation/me/requests/${encodeURIComponent(publicId)}`,
    accessToken,
    locale,
    { signal },
  );
}

export function getMyVacationRequestHistory(
  accessToken: string,
  locale: string,
  publicId: string,
  signal?: AbortSignal,
): Promise<VacationRequestHistory[]> {
  return vacationRequest(
    `/api/v1/vacation/me/requests/${encodeURIComponent(publicId)}/history`,
    accessToken,
    locale,
    { signal },
  );
}

export function createMyVacationRequest(
  accessToken: string,
  locale: string,
  body: CreateVacationRequest,
): Promise<VacationRequest> {
  return vacationRequest("/api/v1/vacation/me/requests", accessToken, locale, {
    method: "POST",
    body,
  });
}

export function cancelMyVacationRequest(
  accessToken: string,
  locale: string,
  publicId: string,
  body: CancelVacationRequest,
): Promise<VacationRequest> {
  return vacationRequest(
    `/api/v1/vacation/me/requests/${encodeURIComponent(publicId)}/cancel`,
    accessToken,
    locale,
    { method: "POST", body },
  );
}

export function listMyVacationBalances(
  accessToken: string,
  locale: string,
  signal?: AbortSignal,
): Promise<VacationBalance[]> {
  return vacationRequest("/api/v1/vacation/me/balances", accessToken, locale, {
    signal,
  });
}

export function listAdminVacationRequests(
  accessToken: string,
  locale: string,
  query: VacationAdminRequestQuery,
  signal?: AbortSignal,
): Promise<PagedVacationRequests> {
  const searchParams = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") searchParams.set(key, String(value));
  });
  return vacationRequest(
    `/api/v1/vacation/requests?${searchParams.toString()}`,
    accessToken,
    locale,
    { signal },
  );
}

export function getAdminVacationRequest(
  accessToken: string,
  locale: string,
  publicId: string,
  signal?: AbortSignal,
): Promise<VacationRequest> {
  return vacationRequest(
    `/api/v1/vacation/requests/${encodeURIComponent(publicId)}`,
    accessToken,
    locale,
    { signal },
  );
}

export function getAdminVacationRequestHistory(
  accessToken: string,
  locale: string,
  publicId: string,
  signal?: AbortSignal,
): Promise<VacationRequestHistory[]> {
  return vacationRequest(
    `/api/v1/vacation/requests/${encodeURIComponent(publicId)}/history`,
    accessToken,
    locale,
    { signal },
  );
}

async function vacationRequest<T>(
  path: string,
  accessToken: string,
  locale: string,
  options: {
    signal?: AbortSignal;
    method?: string;
    body?: object;
  } = {},
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Accept-Language": locale,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    credentials: "include",
    signal: options.signal,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (response.ok) return (await response.json()) as T;
  const problem = (await response.json().catch(() => null)) as ProblemDetails | null;
  throw new ApiError(
    problem?.title ?? "The Vacation request could not be completed.",
    problem ?? undefined,
    response.status,
  );
}

async function requestLeaveTypes(
  path: string,
  accessToken: string,
  locale: string,
  signal?: AbortSignal,
): Promise<LeaveType[]> {
  const response = await request(path, accessToken, locale, signal);
  return (await response.json()) as LeaveType[];
}

async function requestLeaveTypeDetails(
  path: string,
  accessToken: string,
  locale: string,
  signal?: AbortSignal,
  method = "GET",
  body?: CreateLeaveTypeRequest | UpdateLeaveTypeRequest,
): Promise<LeaveTypeDetails> {
  const response = await request(
    path,
    accessToken,
    locale,
    signal,
    method,
    body,
  );
  return (await response.json()) as LeaveTypeDetails;
}

async function request(
  path: string,
  accessToken: string,
  locale: string,
  signal?: AbortSignal,
  method = "GET",
  body?: CreateLeaveTypeRequest | UpdateLeaveTypeRequest,
): Promise<Response> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Accept-Language": locale,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    credentials: "include",
    signal,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.ok) {
    return response;
  }

  const problem = (await response.json().catch(() => null)) as ProblemDetails | null;
  throw new ApiError(
    problem?.title ?? "The Vacation data could not be loaded.",
    problem ?? undefined,
    response.status,
  );
}
