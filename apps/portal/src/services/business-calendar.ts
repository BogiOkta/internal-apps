import { getApiBaseUrl } from "@/services/api-config";
import { ApiError } from "@/services/auth";
import type { ProblemDetails } from "@/types/auth";
import type {
  NonWorkingDay,
  SaveNonWorkingDayRequest,
} from "@/types/business-calendar";

const apiBaseUrl = getApiBaseUrl();
const resourcePath = "/api/v1/business-calendar/non-working-days";

export function listNonWorkingDays(
  accessToken: string,
  year: number,
  signal?: AbortSignal,
): Promise<NonWorkingDay[]> {
  return request(`${resourcePath}?year=${year}`, accessToken, { signal });
}

export function createNonWorkingDay(
  accessToken: string,
  body: SaveNonWorkingDayRequest,
): Promise<NonWorkingDay> {
  return request(resourcePath, accessToken, { method: "POST", body });
}

export function updateNonWorkingDay(
  accessToken: string,
  publicId: string,
  body: SaveNonWorkingDayRequest,
): Promise<NonWorkingDay> {
  return request(`${resourcePath}/${encodeURIComponent(publicId)}`, accessToken, {
    method: "PUT",
    body,
  });
}

export function deleteNonWorkingDay(
  accessToken: string,
  publicId: string,
): Promise<void> {
  return request(`${resourcePath}/${encodeURIComponent(publicId)}`, accessToken, {
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
  if (response.ok) {
    return response.status === 204
      ? (undefined as T)
      : ((await response.json()) as T);
  }
  const problem = (await response.json().catch(() => null)) as ProblemDetails | null;
  throw new ApiError(
    problem?.detail ?? problem?.title ?? "Business Calendar request failed.",
    problem ?? undefined,
    response.status,
  );
}
