import type {
  AppCalendarEvent,
  CalendarEventStatus,
  CalendarView,
} from "@/components/calendar/calendar-types";

export const calendarViewNames: Record<CalendarView, string> = {
  month: "dayGridMonth",
  week: "timeGridWeek",
  day: "timeGridDay",
  agenda: "listMonth",
};

export const calendarStatusColors: Record<string, string> = {
  pending: "#b7791f",
  approved: "#2f855a",
  rejected: "#c53030",
  cancelled: "#64748b",
};

export function toFullCalendarEvents<TResource>(
  events: AppCalendarEvent<TResource>[],
) {
  return events.map((event) => ({
    id: String(event.id),
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    color: getCalendarEventColor(event.status, event.color),
    extendedProps: { appCalendarEvent: event },
  }));
}

export function getCalendarEventColor(
  status?: CalendarEventStatus,
  configuredColor?: string,
) {
  return configuredColor ?? (status ? calendarStatusColors[status] : undefined) ??
    "#2563eb";
}

export function getCalendarStatusLabel(
  status: CalendarEventStatus | undefined,
  labels: Record<string, string>,
) {
  if (!status) return undefined;
  return labels[status] ?? status.replaceAll("-", " ");
}

export function fromFullCalendarView(viewName: string): CalendarView {
  const entry = Object.entries(calendarViewNames).find(([, name]) => name === viewName);
  return (entry?.[0] as CalendarView | undefined) ?? "month";
}
