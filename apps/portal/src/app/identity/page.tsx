import { redirect } from "next/navigation";

/**
 * Identity workspace default section. Resolves to Users without introducing a
 * separate overview surface (single-section workspace, Rule 3.6.3).
 */
export default function IdentityIndexPage() {
  redirect("/identity/users");
}
