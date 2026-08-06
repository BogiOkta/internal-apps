/**
 * Platform-wide dependency inspection contract. Modules return stable codes and
 * counts; the Portal Dependency Inspector localizes labels and renders actions.
 */
export type DependencyInspection = {
  entityType: string;
  entityPublicId: string;
  canDelete: boolean;
  isSystemProtected: boolean;
  hasPermanentProtection: boolean;
  dependencies: DependencyGroup[];
};

export type DependencyGroup = {
  code: string;
  count: number;
  countUnit: string | null;
  details: DependencyDetail[];
  navigation: DependencyNavigation;
};

export type DependencyDetail = {
  code: string;
  count: number;
};

export type DependencyNavigation =
  | {
      kind: "portal_route";
      route: string;
      query?: Record<string, string> | null;
      infoCode?: null;
    }
  | {
      kind: "none";
      route?: null;
      query?: null;
      infoCode: string;
    };
