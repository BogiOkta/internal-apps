import type { CSSProperties } from "react";
import type { EventDisplayInfo } from "@fullcalendar/react";
import type { AppCalendarEvent } from "@/components/calendar/calendar-types";
import { getCalendarStatusLabel } from "@/components/calendar/calendar-utils";

export function CalendarEvent({
  info,
  statusLabels,
}: {
  info: EventDisplayInfo;
  statusLabels: Record<string, string>;
}) {
  const source = info.event.extendedProps.appCalendarEvent as
    | AppCalendarEvent
    | undefined;
  const statusLabel = getCalendarStatusLabel(source?.status, statusLabels);
  const style = {
    "--app-calendar-event-color": info.color,
  } as CSSProperties;

  return (
    <div className="app-calendar-event" style={style}>
      <span className="app-calendar-event__dot" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">
        {info.timeText && <span className="mr-1 font-semibold">{info.timeText}</span>}
        <span>{info.event.title}</span>
      </span>
      {statusLabel && (
        <span className="app-calendar-event__status">{statusLabel}</span>
      )}
    </div>
  );
}
