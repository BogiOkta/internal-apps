import type { ReactNode } from "react";
import { OrganizationPersistentShell } from "@/features/organization/components/organization-shell";

/**
 * Shared Company workspace layout. Owns one persistent Organization shell for
 * `/organization/*` and `/business-calendar/admin/non-working-days` so
 * cross-prefix navigation keeps sidebar and breadcrumb chrome mounted.
 * The pathless `(company)` route group does not change public URLs.
 */
export default function CompanyLayout({ children }: { children: ReactNode }) {
  return <OrganizationPersistentShell>{children}</OrganizationPersistentShell>;
}
