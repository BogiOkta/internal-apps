import type { ReactNode } from "react";
import { IdentityPersistentShell } from "@/features/identity/components/identity-shell";

/**
 * Identity workspace layout. Owns the persistent shell so Identity routes keep
 * sidebar and breadcrumb chrome mounted. Public URLs are unchanged.
 */
export default function IdentityLayout({ children }: { children: ReactNode }) {
  return <IdentityPersistentShell>{children}</IdentityPersistentShell>;
}
