import { ApiError } from "@/services/auth";
import type { ProblemDetails } from "@/types/auth";
import type { LeaveType, LeaveTypeQuery } from "@/types/vacation";

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
): Promise<LeaveType> {
  return requestLeaveType(
    `/api/v1/vacation/leave-types/${encodeURIComponent(publicId)}`,
    accessToken,
    locale,
    signal,
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

async function requestLeaveType(
  path: string,
  accessToken: string,
  locale: string,
  signal?: AbortSignal,
): Promise<LeaveType> {
  const response = await request(path, accessToken, locale, signal);
  return (await response.json()) as LeaveType;
}

async function request(
  path: string,
  accessToken: string,
  locale: string,
  signal?: AbortSignal,
): Promise<Response> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Accept-Language": locale,
    },
    credentials: "include",
    signal,
  });

  if (response.ok) {
    return response;
  }

  const problem = (await response.json().catch(() => null)) as ProblemDetails | null;
  throw new ApiError(
    problem?.title ?? "The Vacation data could not be loaded.",
    problem ?? undefined,
  );
}
