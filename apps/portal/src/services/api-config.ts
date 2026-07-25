const configuredApiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL;

export function getApiBaseUrl(): string {
  return configuredApiBaseUrl?.replace(/\/$/, "") ?? "";
}
