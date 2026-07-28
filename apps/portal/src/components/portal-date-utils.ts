export const portalDatePlaceholder = "dd.MM.yyyy.";

export function dateControlClassName({
  invalid = false,
  active = false,
  focusWithin = false,
}: {
  invalid?: boolean;
  active?: boolean;
  focusWithin?: boolean;
} = {}) {
  const focus = focusWithin ? "focus-within" : "focus";
  return `rounded-md border bg-white px-3 text-sm outline-none transition-colors hover:bg-slate-50 ${focus}:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:hover:bg-slate-100 ${
    invalid
      ? `border-red-400 ${focus}:border-red-600 ${focus}:ring-red-100`
      : active
        ? `border-blue-600 ring-1 ring-blue-600 ${focus}:border-blue-600 ${focus}:ring-blue-100`
        : `border-slate-300 ${focus}:border-blue-600 ${focus}:ring-blue-100`
  }`;
}

export function formatPortalEditableDate(isoDate: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate ?? "");
  return match && isCalendarDate(match[1], match[2], match[3])
    ? `${match[3]}.${match[2]}.${match[1]}.`
    : "";
}

export function normalizePortalDateInput(value: string): { day: string; month: string; year: string } {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return { day: digits.slice(0, 2), month: digits.slice(2, 4), year: digits.slice(4, 8) };
}

export function portalDateToIso(day: string, month: string, year: string): string | null {
  return day.length === 2 && month.length === 2 && year.length === 4 && isCalendarDate(year, month, day)
    ? `${year}-${month}-${day}`
    : null;
}

export function isoToPortalDateParts(isoDate: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate ?? "");
  return match && isCalendarDate(match[1], match[2], match[3])
    ? { day: match[3], month: match[2], year: match[1] }
    : { day: "", month: "", year: "" };
}

export function isCalendarDate(year: string, month: string, day: string) {
  const candidate = new Date(Number(year), Number(month) - 1, Number(day));
  return candidate.getFullYear() === Number(year) && candidate.getMonth() === Number(month) - 1 && candidate.getDate() === Number(day);
}
