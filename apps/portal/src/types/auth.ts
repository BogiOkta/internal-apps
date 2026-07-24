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

export const usersManagePermission = "identity.users.manage";

export type ManagedUser = {
  publicId: string;
  username: string;
  displayName: string;
  isActive: boolean;
  roles: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateManagedUserRequest = {
  username: string;
  displayName: string;
  initialPassword: string;
  isActive: boolean;
};
