import type { ReactNode } from "react";

export type DateRangeValue = {
  from: Date | null;
  to: Date | null;
};

export type DisabledDateMatcher = Date[] | ((date: Date) => boolean);

export type DateRangePickerProps = {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: DisabledDateMatcher;
  locale?: string;
  numberOfMonths?: 1 | 2;
  summary?: ReactNode;
  disabled?: boolean;
  className?: string;
};
