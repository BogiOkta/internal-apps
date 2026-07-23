export type CurrentUser = {
  publicId: string;
  username: string;
  displayName: string;
  roles: string[];
  permissions: string[];
};

export type AuthResponse = {
  accessToken: string;
  expiresAt: string;
  user: CurrentUser;
};

export type LoginCredentials = {
  username: string;
  password: string;
};

export type ProblemDetails = {
  title?: string;
  detail?: string;
  code?: string;
  traceId?: string;
  errors?: Record<string, string[]>;
};
