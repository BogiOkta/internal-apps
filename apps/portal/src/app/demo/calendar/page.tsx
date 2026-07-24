"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  AppCalendar,
  type AppCalendarEvent,
} from "@/components/calendar";
import {
  DateRangePicker,
  type DateRangeValue,
} from "@/components/date-range";
import { useTranslations } from "@/i18n/use-translations";

type DemoResource = {
  kind: "person" | "room" | "asset";
  reference: string;
};

export default function CalendarDemoPage() {
  const { browserLocale, t } = useTranslations();
  const [displayState, setDisplayState] = useState<"events" | "loading" | "empty">("events");
  const [feedback, setFeedback] = useState(t("demo.calendar.instructions"));
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    from: null,
    to: null,
  });
  const events = useMemo(() => createDemoEvents(t), [t]);
  const visibleEvents = displayState === "empty" ? [] : events;

  return (
    <AppShell title={t("demo.calendar.title")}
      description={t("demo.calendar.description")}>
      <div className="space-y-4">
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">
              {t("demo.calendar.controls")}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("demo.calendar.controlsDescription")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="text-sm font-medium text-slate-700">
              <span className="mr-2">{t("demo.calendar.state")}</span>
              <select value={displayState}
                onChange={(event) => setDisplayState(
                  event.target.value as "events" | "loading" | "empty",
                )}
                className="min-h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">
                <option value="events">{t("demo.calendar.stateEvents")}</option>
                <option value="loading">{t("demo.calendar.stateLoading")}</option>
                <option value="empty">{t("demo.calendar.stateEmpty")}</option>
              </select>
            </label>
          </div>
        </section>

        <div role="status" className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {feedback}
        </div>

        <AppCalendar events={visibleEvents}
          isLoading={displayState === "loading"}
          onEventClick={(event) => setFeedback(
            t("demo.calendar.eventSelected", { title: event.title }),
          )}
          onDateSelect={(selection) => setFeedback(
            t("demo.calendar.dateSelected", {
              date: new Intl.DateTimeFormat(browserLocale, {
                dateStyle: "medium",
              }).format(selection.start),
            }),
          )}
        />

        <section className="space-y-4 pt-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              {t("demo.calendar.rangeTitle")}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("demo.calendar.rangeDescription")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setDateRange({ from: null, to: null })}
              className="min-h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600">
              {t("demo.calendar.rangeEmpty")}
            </button>
            <button type="button" onClick={() => {
              const today = startOfDay(new Date());
              setDateRange({ from: addDays(today, 2), to: addDays(today, 8) });
            }}
              className="min-h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600">
              {t("demo.calendar.rangeCompleted")}
            </button>
          </div>
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            minDate={startOfDay(new Date())}
            disabledDates={(date) => date < startOfDay(new Date())}
            locale={browserLocale}
            numberOfMonths={2}
            summary={
              <p className="text-sm font-medium text-slate-700">
                {dateRange.from && dateRange.to
                  ? t("demo.calendar.workingDays", {
                      count: countWeekdays(dateRange.from, dateRange.to),
                    })
                  : t("demo.calendar.rangeSummaryEmpty")}
              </p>
            }
          />
        </section>
      </div>
    </AppShell>
  );
}

function createDemoEvents(
  t: ReturnType<typeof useTranslations>["t"],
): AppCalendarEvent<DemoResource>[] {
  const today = startOfDay(new Date());

  return [
    {
      id: "today",
      title: t("demo.calendar.event.today"),
      start: atTime(today, 9, 30),
      end: atTime(today, 10, 30),
      status: "approved",
      resource: { kind: "room", reference: "ROOM-01" },
    },
    {
      id: "pending",
      title: t("demo.calendar.event.pending"),
      start: atTime(addDays(today, 1), 11, 0),
      end: atTime(addDays(today, 1), 12, 30),
      status: "pending",
      resource: { kind: "person", reference: "EMP-1042" },
    },
    {
      id: "approved",
      title: t("demo.calendar.event.approved"),
      start: atTime(addDays(today, 3), 13, 0),
      end: atTime(addDays(today, 3), 14, 0),
      status: "approved",
      resource: { kind: "asset", reference: "VEH-12" },
    },
    {
      id: "rejected",
      title: t("demo.calendar.event.rejected"),
      start: atTime(addDays(today, -2), 15, 0),
      end: atTime(addDays(today, -2), 16, 0),
      status: "rejected",
      resource: { kind: "room", reference: "ROOM-04" },
    },
    {
      id: "multi-day",
      title: t("demo.calendar.event.multiDay"),
      start: addDays(today, 5),
      end: addDays(today, 8),
      allDay: true,
      color: "#6d5bd0",
      status: "approved",
      resource: { kind: "person", reference: "EMP-1178" },
    },
    {
      id: "cancelled",
      title: t("demo.calendar.event.cancelled"),
      start: atTime(addDays(today, -4), 10, 0),
      end: atTime(addDays(today, -4), 11, 0),
      status: "cancelled",
      resource: { kind: "asset", reference: "ASSET-203" },
    },
  ];
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function atTime(date: Date, hours: number, minutes: number) {
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function countWeekdays(from: Date, to: Date) {
  let count = 0;
  for (let day = startOfDay(from); day <= startOfDay(to); day = addDays(day, 1)) {
    if (day.getDay() !== 0 && day.getDay() !== 6) count += 1;
  }
  return count;
}
