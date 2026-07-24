import type { AppCalendarEvent } from "@/components/calendar/calendar-types";
import {
  getCalendarEventColor,
  getCalendarStatusLabel,
} from "@/components/calendar/calendar-utils";

export function CalendarLegend({
  events,
  statusLabels,
  label,
}: {
  events: AppCalendarEvent[];
  statusLabels: Record<string, string>;
  label: string;
}) {
  const items = Array.from(
    new Map(
      events
        .filter((event) => event.status)
        .map((event) => [
          event.status!,
          {
            status: event.status!,
            color: getCalendarEventColor(event.status, event.color),
          },
        ]),
    ).values(),
  );

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-200 px-4 py-3"
      aria-label={label}>
      {items.map((item) => (
        <span key={item.status} className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }}
            aria-hidden="true" />
          {getCalendarStatusLabel(item.status, statusLabels)}
        </span>
      ))}
    </div>
  );
}
