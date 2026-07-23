import type {
  AuthResponse,
  CurrentUser,
  LoginCredentials,
  ProblemDetails,
} from "@/types/auth";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly problem?: ProblemDetails,
  ) {
    super(message);
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T;
  }

  const problem = (await response.json().catch(() => null)) as ProblemDetails | null;
  throw new ApiError(
    problem?.detail ?? problem?.title ?? "The request could not be completed.",
    problem ?? undefined,
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
