import { getApiBaseUrl } from "@/services/api-config";
import type {
  AuthResponse,
  CurrentUser,
  LoginCredentials,
  ProblemDetails,
  ManagedUser,
  CreateManagedUserRequest,
} from "@/types/auth";

const apiBaseUrl = getApiBaseUrl();

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly problem?: ProblemDetails,
    public readonly status?: number,
  ) {
    super(message);
  }
}

export async function listUsers(accessToken: string): Promise<ManagedUser[]> {
  return identityRequest("/api/v1/identity/users", accessToken);
}

export async function createUser(accessToken: string,
  request: CreateManagedUserRequest): Promise<ManagedUser> {
  return identityRequest("/api/v1/identity/users", accessToken, "POST", request);
}

export async function activateUser(accessToken: string, publicId: string): Promise<ManagedUser> {
  return identityRequest(`/api/v1/identity/users/${encodeURIComponent(publicId)}/activate`,
    accessToken, "POST");
}

export async function deactivateUser(accessToken: string, publicId: string): Promise<ManagedUser> {
  return identityRequest(`/api/v1/identity/users/${encodeURIComponent(publicId)}/deactivate`,
    accessToken, "POST");
}

async function identityRequest<T>(path: string, accessToken: string,
  method = "GET", body?: object): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method, credentials: "include",
    headers: { Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return parseResponse<T>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T;
  }

  const problem = (await response.json().catch(() => null)) as ProblemDetails | null;
  throw new ApiError(
    problem?.detail ?? problem?.title ?? "The request could not be completed.",
    problem ?? undefined,
    response.status,
  );
}

export async function login(
  credentials: LoginCredentials,
): Promise<AuthResponse> {
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  return parseResponse<AuthResponse>(response);
}

export async function refreshSession(): Promise<AuthResponse | null> {
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  return parseResponse<AuthResponse>(response);
}

export async function getCurrentUser(accessToken: string): Promise<CurrentUser> {
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: "include",
  });

  return parseResponse<CurrentUser>(response);
}

export async function logout(accessToken: string | null): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  if (!response.ok && response.status !== 401) {
    throw new ApiError("Logout could not be completed.");
  }
}
