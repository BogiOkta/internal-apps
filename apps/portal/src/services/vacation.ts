import { ApiError } from "@/services/auth";
import type { ProblemDetails } from "@/types/auth";
import type {
  CreateLeaveTypeRequest,
  LeaveType,
  LeaveTypeDetails,
  LeaveTypeQuery,
  UpdateLeaveTypeRequest,
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
