import type { TranslationKey } from "@/i18n/translations";

/**
 * Portal navigation registry descriptors (Vacation IA pilot).
 * Sections are presentation structure owned by the Portal; the API remains
 * the authority for authorization (PORTAL_INFORMATION_ARCHITECTURE.md §10.3).
 */

export type NavigationGroupId =
  | "my-work"
  | "company"
  | "operations"
  | "finance"
  | "platform"
  | "personal";

export type SectionDescriptor = {
  id: string;
  labelKey: TranslationKey;
  /** Stable collection route under the workspace prefix. */
  route: string;
  /** When set, the section is omitted unless the user holds this permission. */
  requiredPermission?: string;
  order: number;
  /**
   * When set, the section renders under an expandable non-routed group label
   * (currently only Administration / Administracija).
   */
  groupLabelKey?: TranslationKey;
};

export type WorkspaceDescriptor = {
  id: string;
  /** Assigned-application code used to match GET /api/v1/me/applications. */
  applicationCode: string;
  group: NavigationGroupId;
  labelKey: TranslationKey;
  routePrefix: string;
  order: number;
  defaultSectionId: string;
  sections: SectionDescriptor[];
};

export type BreadcrumbNode = {
  label: string;
  href?: string;
};
