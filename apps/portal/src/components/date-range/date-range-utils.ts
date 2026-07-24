import type { DisabledDateMatcher } from "@/components/date-range/date-range-types";

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function isSameDay(left: Date, right: Date) {
  return startOfDay(left).getTime() === startOfDay(right).getTime();
}

export function isDateDisabled(
  date: Date,
  minDate?: Date,
  maxDate?: Date,
  disabledDates?: DisabledDateMatcher,
) {
  const day = startOfDay(date);
  if (minDate && day < startOfDay(minDate)) return true;
  if (maxDate && day > startOfDay(maxDate)) return true;
  if (!disabledDates) return false;
  if (typeof disabledDates === "function") return disabledDates(day);
  return disabledDates.some((disabledDate) => isSameDay(day, disabledDate));
}
