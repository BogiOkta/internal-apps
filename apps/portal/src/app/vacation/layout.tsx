import type { ReactNode } from "react";
import { VacationPersistentShell } from "@/features/vacation/components/vacation-shell";

/**
 * Vacation IA pilot layout. Owns the persistent workspace shell so in-module
 * navigations keep the sidebar and breadcrumb chrome mounted.
 */
export default function VacationLayout({ children }: { children: ReactNode }) {
  return <VacationPersistentShell>{children}</VacationPersistentShell>;
}
