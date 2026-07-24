import type { VacationRequestStatus } from "@/types/vacation";

const styles: Record<VacationRequestStatus, string> = {
  SUBMITTED: "border-amber-300 bg-amber-50 text-amber-800",
  APPROVED: "border-emerald-300 bg-emerald-50 text-emerald-800",
  REJECTED: "border-red-300 bg-red-50 text-red-800",
  CANCELLED: "border-slate-300 bg-slate-100 text-slate-700",
};

export function VacationStatusBadge({
  status,
  label,
}: {
  status: VacationRequestStatus;
  label: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {label}
    </span>
  );
}
