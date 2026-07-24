"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import FullCalendar, {
  type CalendarRef,
  type DatesSetInfo,
} from "@fullcalendar/react";
import interactionPlugin from "@fullcalendar/react/interaction";
import enGbLocale from "@fullcalendar/react/locales/en-gb";
import srLocale from "@fullcalendar/react/locales/sr";
import multiMonthPlugin from "@fullcalendar/react/multimonth";
import formaThemePlugin from "@fullcalendar/react/themes/forma";
import { useAppearance } from "@/components/appearance-provider";
import type {
  DateRangePickerProps,
  DateRangeValue,
} from "@/components/date-range/date-range-types";
import {
  addDays,
  isDateDisabled,
  isSameDay,
  startOfDay,
} from "@/components/date-range/date-range-utils";
import { useTranslations } from "@/i18n/use-translations";
import styles from "@/components/date-range/date-range-picker.module.css";

type ActiveBoundary = "from" | "to";

export function DateRangePicker({
  value,
  onChange,
  minDate,
  maxDate,
  disabledDates,
  locale,
  numberOfMonths = 2,
  summary,
  disabled = false,
  className = "",
}: DateRangePickerProps) {
  const calendarRef = useRef<CalendarRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedAppearance } = useAppearance();
  const { locale: platformLocale, t } = useTranslations();
  const resolvedLocale = locale ?? platformLocale;
  const [activeBoundary, setActiveBoundary] =
    useState<ActiveBoundary>(value.from && !value.to ? "to" : "from");
  const [visibleMonths, setVisibleMonths] = useState<1 | 2>(numberOfMonths);
  const [title, setTitle] = useState("");
  const fullCalendarLocale = resolvedLocale.toLowerCase().startsWith("sr")
    ? srLocale
    : enGbLocale;
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(resolvedLocale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    [resolvedLocale],
  );

  useEffect(() => {
    if (numberOfMonths === 1) {
      setVisibleMonths(1);
      return;
    }

    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setVisibleMonths(entry.contentRect.width < 680 ? 1 : 2);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [numberOfMonths]);

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const nextView = visibleMonths === 1 ? "dateRangeOneMonth" : "dateRangeTwoMonths";
    if (api.view.type !== nextView) api.changeView(nextView);
  }, [visibleMonths]);

  function chooseDate(date: Date) {
    if (
      disabled ||
      isDateDisabled(date, minDate, maxDate, disabledDates)
    ) {
      return;
    }

    const day = startOfDay(date);
    if (activeBoundary === "from") {
      onChange({
        from: day,
        to: value.to && day <= startOfDay(value.to) ? value.to : null,
      });
      setActiveBoundary("to");
      return;
    }

    if (!value.from || day < startOfDay(value.from)) {
      onChange({ from: day, to: value.from });
    } else {
      onChange({ from: value.from, to: day });
    }
    setActiveBoundary("from");
  }

  function clearRange() {
    onChange({ from: null, to: null });
    setActiveBoundary("from");
    calendarRef.current?.getApi().unselect();
  }

  function handleFieldKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    boundary: ActiveBoundary,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setActiveBoundary(boundary);
    }
  }

  const validRange =
    minDate || maxDate
      ? {
          start: minDate ? startOfDay(minDate) : undefined,
          end: maxDate ? addDays(startOfDay(maxDate), 1) : undefined,
        }
      : undefined;

  return (
    <section
      ref={containerRef}
      className={`${styles.root} rounded-lg border border-slate-300 bg-white p-4 shadow-sm ${className}`}
      data-color-scheme={resolvedAppearance}
      aria-label={t("dateRange.regionLabel")}
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <BoundaryButton
          label={t("dateRange.from")}
          value={value.from}
          isActive={activeBoundary === "from"}
          disabled={disabled}
          formattedValue={value.from ? dateFormatter.format(value.from) : t("dateRange.notSelected")}
          onClick={() => setActiveBoundary("from")}
          onKeyDown={(event) => handleFieldKeyDown(event, "from")}
        />
        <BoundaryButton
          label={t("dateRange.to")}
          value={value.to}
          isActive={activeBoundary === "to"}
          disabled={disabled}
          formattedValue={value.to ? dateFormatter.format(value.to) : t("dateRange.notSelected")}
          onClick={() => setActiveBoundary("to")}
          onKeyDown={(event) => handleFieldKeyDown(event, "to")}
        />
        <button
          type="button"
          onClick={clearRange}
          disabled={disabled || (!value.from && !value.to)}
          className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("dateRange.clear")}
        </button>
      </div>

      <p className="sr-only">{t("dateRange.instructions")}</p>
      <div className="mb-3 flex items-center justify-between gap-3">
        <button type="button" onClick={() => calendarRef.current?.getApi().prev()}
          disabled={disabled} aria-label={t("dateRange.previous")}
          className="min-h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50">
          ←
        </button>
        <h3 className="text-center text-sm font-semibold text-slate-950">{title}</h3>
        <button type="button" onClick={() => calendarRef.current?.getApi().next()}
          disabled={disabled} aria-label={t("dateRange.next")}
          className="min-h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50">
          →
        </button>
      </div>

      <div className={styles.calendar}>
        <FullCalendar
          ref={calendarRef}
          plugins={[formaThemePlugin, interactionPlugin, multiMonthPlugin]}
          initialView={visibleMonths === 1 ? "dateRangeOneMonth" : "dateRangeTwoMonths"}
          views={{
            dateRangeOneMonth: { type: "multiMonth", duration: { months: 1 } },
            dateRangeTwoMonths: { type: "multiMonth", duration: { months: 2 } },
          }}
          locale={fullCalendarLocale}
          headerToolbar={false}
          height="auto"
          dayCellClass={(info) => {
            const classes: string[] = [];
            if (isDateDisabled(info.date, minDate, maxDate, disabledDates)) {
              classes.push("date-range-disabled");
            }
            if (
              value.from &&
              value.to &&
              startOfDay(info.date) >= startOfDay(value.from) &&
              startOfDay(info.date) <= startOfDay(value.to)
            ) {
              classes.push("date-range-selected");
            }
            if (
              (value.from && isSameDay(info.date, value.from)) ||
              (value.to && isSameDay(info.date, value.to))
            ) {
              classes.push("date-range-boundary");
            }
            return classes.join(" ");
          }}
          dayCellTopContent={(info) => {
            const isUnavailable =
              disabled ||
              isDateDisabled(info.date, minDate, maxDate, disabledDates);
            return (
              <button
                type="button"
                className="date-range-day-button"
                disabled={isUnavailable}
                aria-label={dateFormatter.format(info.date)}
                aria-pressed={Boolean(
                  value.from &&
                  value.to &&
                  startOfDay(info.date) >= startOfDay(value.from) &&
                  startOfDay(info.date) <= startOfDay(value.to),
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  chooseDate(info.date);
                }}
              >
                {info.dayNumberText}
              </button>
            );
          }}
          dayCellDidMount={(info) => {
            if (isDateDisabled(info.date, minDate, maxDate, disabledDates)) {
              info.el.setAttribute("aria-disabled", "true");
            }
          }}
          validRange={validRange}
          datesSet={(info: DatesSetInfo) => setTitle(info.view.title)}
          firstDay={1}
          fixedWeekCount={false}
          showNonCurrentDates={false}
          multiMonthMaxColumns={visibleMonths}
          navLinks={false}
          events={[]}
        />
      </div>

      {summary && (
        <div className="mt-4 border-t border-slate-200 pt-4">{summary}</div>
      )}
    </section>
  );
}

function BoundaryButton({
  label,
  value,
  formattedValue,
  isActive,
  disabled,
  onClick,
  onKeyDown,
}: {
  label: string;
  value: Date | null;
  formattedValue: string;
  isActive: boolean;
  disabled: boolean;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button type="button" onClick={onClick} onKeyDown={onKeyDown}
      disabled={disabled} aria-pressed={isActive}
      className={`min-h-16 rounded-md border bg-white px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50 ${
        isActive ? "border-blue-600 ring-1 ring-blue-600" : "border-slate-300"
      }`}>
      <span className="block text-xs font-medium text-slate-600">{label}</span>
      <span className={`mt-1 block text-sm font-semibold ${value ? "text-slate-950" : "text-slate-500"}`}>
        {formattedValue}
      </span>
    </button>
  );
}
