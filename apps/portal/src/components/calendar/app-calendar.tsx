"use client";

import { useMemo, useRef, useState } from "react";
import FullCalendar, {
  type CalendarRef,
  type DateSelectInfo,
  type DatesSetInfo,
  type EventClickInfo,
} from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import listPlugin from "@fullcalendar/react/list";
import enGbLocale from "@fullcalendar/react/locales/en-gb";
import srLocale from "@fullcalendar/react/locales/sr";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import formaThemePlugin from "@fullcalendar/react/themes/forma";
import { useAppearance } from "@/components/appearance-provider";
import { CalendarEvent } from "@/components/calendar/calendar-event";
import { CalendarLegend } from "@/components/calendar/calendar-legend";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import type {
  AppCalendarEvent,
  AppCalendarLabels,
  AppCalendarProps,
  CalendarView,
} from "@/components/calendar/calendar-types";
import {
  calendarViewNames,
  fromFullCalendarView,
  toFullCalendarEvents,
} from "@/components/calendar/calendar-utils";
import { useTranslations } from "@/i18n/use-translations";
import styles from "@/components/calendar/app-calendar.module.css";

export function AppCalendar<TResource = unknown>({
  events,
  onEventClick,
  onDateSelect,
  initialDate,
  initialView = "month",
  locale,
  timeZone = "local",
  firstDay = 1,
  isLoading = false,
  labels: configuredLabels,
  showLegend = true,
  className = "",
}: AppCalendarProps<TResource>) {
  const calendarRef = useRef<CalendarRef>(null);
  const { resolvedAppearance } = useAppearance();
  const { locale: platformLocale, t } = useTranslations();
  const [title, setTitle] = useState("");
  const [view, setView] = useState<CalendarView>(initialView);
  const labels = useMemo<AppCalendarLabels>(() => ({
    previous: configuredLabels?.previous ?? t("calendar.previous"),
    next: configuredLabels?.next ?? t("calendar.next"),
    today: configuredLabels?.today ?? t("calendar.today"),
    view: configuredLabels?.view ?? t("calendar.view"),
    month: configuredLabels?.month ?? t("calendar.month"),
    week: configuredLabels?.week ?? t("calendar.week"),
    day: configuredLabels?.day ?? t("calendar.day"),
    agenda: configuredLabels?.agenda ?? t("calendar.agenda"),
    loading: configuredLabels?.loading ?? t("calendar.loading"),
    emptyTitle: configuredLabels?.emptyTitle ?? t("calendar.emptyTitle"),
    emptyDescription:
      configuredLabels?.emptyDescription ?? t("calendar.emptyDescription"),
    allDay: configuredLabels?.allDay ?? t("calendar.allDay"),
    more: configuredLabels?.more ?? ((count) => t("calendar.more", { count })),
    status: {
      pending: t("calendar.status.pending"),
      approved: t("calendar.status.approved"),
      rejected: t("calendar.status.rejected"),
      cancelled: t("calendar.status.cancelled"),
      ...configuredLabels?.status,
    },
  }), [configuredLabels, t]);
  const calendarEvents = useMemo(() => toFullCalendarEvents(events), [events]);
  const fullCalendarLocale = (locale ?? platformLocale).toLowerCase().startsWith("sr")
    ? srLocale
    : enGbLocale;

  function api() {
    return calendarRef.current?.getApi();
  }

  function changeView(nextView: CalendarView) {
    api()?.changeView(calendarViewNames[nextView]);
  }

  function handleDatesSet(info: DatesSetInfo) {
    setTitle(info.view.title);
    setView(fromFullCalendarView(info.view.type));
  }

  function handleEventClick(info: EventClickInfo) {
    const event = info.event.extendedProps.appCalendarEvent as
      | AppCalendarEvent<TResource>
      | undefined;
    if (event) onEventClick?.(event);
  }

  function handleDateSelect(info: DateSelectInfo) {
    onDateSelect?.({ start: info.start, end: info.end, allDay: info.allDay });
  }

  return (
    <section className={`${styles.root} overflow-hidden rounded-lg border border-slate-300 shadow-sm ${className}`}
      data-color-scheme={resolvedAppearance} data-view={view}
      aria-label={t("calendar.regionLabel")}>
      <CalendarToolbar title={title} view={view} labels={labels}
        onPrevious={() => api()?.prev()} onNext={() => api()?.next()}
        onToday={() => api()?.today()} onViewChange={changeView} />

      {isLoading ? (
        <CalendarLoadingState label={labels.loading} />
      ) : (
        <>
          {events.length === 0 && (
            <div role="status" className="mx-4 mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold">{labels.emptyTitle}</p>
              <p className="mt-1 text-sm text-slate-600">{labels.emptyDescription}</p>
            </div>
          )}
          <div className={styles.viewport}>
            <div className={styles.canvas}>
              <FullCalendar ref={calendarRef}
                plugins={[
                  formaThemePlugin,
                  interactionPlugin,
                  dayGridPlugin,
                  timeGridPlugin,
                  listPlugin,
                ]}
                initialView={calendarViewNames[initialView]}
                initialDate={initialDate}
                events={calendarEvents}
                locale={fullCalendarLocale}
                timeZone={timeZone}
                firstDay={firstDay}
                headerToolbar={false}
                height="auto"
                nowIndicator
                selectable={Boolean(onDateSelect)}
                selectMirror
                select={handleDateSelect}
                eventClick={handleEventClick}
                datesSet={handleDatesSet}
                eventContent={(info) => (
                  <CalendarEvent info={info} statusLabels={labels.status} />
                )}
                eventDidMount={(info) => {
                  const source = info.event.extendedProps.appCalendarEvent as
                    | AppCalendarEvent<TResource>
                    | undefined;
                  const status = source?.status
                    ? labels.status[source.status] ?? source.status
                    : undefined;
                  info.el.setAttribute("aria-label",
                    [info.event.title, status].filter(Boolean).join(", "));
                }}
                allDayText={labels.allDay}
                moreLinkContent={(info) => labels.more(info.num)}
                noEventsText={labels.emptyTitle}
                dayMaxEvents={3}
                eventDisplay="block"
                eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
                scrollTime="08:00:00"
              />
            </div>
          </div>
        </>
      )}

      {!isLoading && showLegend && (
        <CalendarLegend events={events} statusLabels={labels.status}
          label={t("calendar.legend")} />
      )}
    </section>
  );
}

function CalendarLoadingState({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="animate-pulse p-4">
      <span className="sr-only">{label}</span>
      <div className="mb-3 h-8 w-48 rounded bg-slate-200" />
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200">
        {Array.from({ length: 35 }, (_, index) => (
          <div key={index} className="h-20 bg-white sm:h-24" />
        ))}
      </div>
    </div>
  );
}
