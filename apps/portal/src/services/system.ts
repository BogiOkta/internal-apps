import { getApiBaseUrl } from "@/services/api-config";
import type { SystemInfo } from "@/types/system";

const apiBaseUrl = getApiBaseUrl();

export async function getSystemInfo(): Promise<SystemInfo | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/system/info`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as SystemInfo;
  } catch {
    return null;
  }
}
