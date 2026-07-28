import type { ReactNode } from "react";

/**
 * Preserves the flex `min-height: 0` chain for viewport-filling administration
 * pages so AdministrativeGridShell can opt into fillViewport safely.
 */
export function AdministrationPageBody({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-3 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      {children}
    </div>
  );
}
