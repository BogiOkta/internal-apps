import { ApiError } from "@/services/auth";
import { getApiBaseUrl } from "@/services/api-config";
import type { ProblemDetails } from "@/types/auth";
import type { AssignedApplication } from "@/types/application";

const apiBaseUrl = getApiBaseUrl();

export async function getAssignedApplications(
  accessToken: string,
  signal?: AbortSignal,
): Promise<AssignedApplication[]> {
  const response = await fetch(`${apiBaseUrl}/api/v1/me/applications`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: "include",
    signal,
  });

  if (response.ok) {
    return (await response.json()) as AssignedApplication[];
  }

  const problem = (await response.json().catch(() => null)) as ProblemDetails | null;
  throw new ApiError(
    problem?.detail ??
      problem?.title ??
      "Your applications could not be loaded.",
    problem ?? undefined,
  );
}
