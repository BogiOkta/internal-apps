export const portalDatePlaceholder = "dd.MM.yyyy.";

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
