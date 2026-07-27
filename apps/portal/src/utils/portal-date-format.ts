/**
 * Shared Portal presentation standard for API dates and timestamps.
 * Transport values remain ISO; this utility is for user-visible text only.
 */
export function formatPortalDate(value: string | Date): string {
  const date = toDate(value);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${pad(date.getFullYear(), 4)}.`;
}

export function formatPortalDateTime(value: string | Date): string {
  const date = toDate(value);
  return `${formatPortalDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;

  // Date-only API values must not be parsed as UTC, which can shift the displayed day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}
