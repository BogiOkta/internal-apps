/**
 * Portal shared status badge (apps/portal/src/components).
 * Compact status label for active/inactive and yes/no business states.
 * Domain leave-request status chips remain in
 * features/vacation/components/vacation-status-badge.tsx.
 */
export function StatusBadge({
  tone,
  label,
}: {
  tone: "active" | "inactive" | "positive" | "neutral";
  label: string;
}) {
  const toneClass =
    tone === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "positive"
        ? "border-blue-200 bg-blue-50 text-blue-800"
        : "border-slate-300 bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${toneClass}`}
    >
      {label}
    </span>
  );
}
