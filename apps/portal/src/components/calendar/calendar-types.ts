export type CalendarView = "month" | "week" | "day" | "agenda";

export type CalendarEventStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | (string & {});

export type AppCalendarEvent<TResource = unknown> = {
  id: string | number;
  title: string;
  start: Date | string;
  end: Date | string;
  color?: string;
  status?: CalendarEventStatus;
  resource?: TResource;
  allDay?: boolean;
};

export type CalendarDateSelection = {
  start: Date;
  end: Date;
  allDay: boolean;
};

export type AppCalendarLabels = {
  previous: string;
  next: string;
  today: string;
  view: string;
  month: string;
  week: string;
  day: string;
  agenda: string;
  loading: string;
  emptyTitle: string;
  emptyDescription: string;
  allDay: string;
  more: (count: number) => string;
  status: Record<string, string>;
};

export type AppCalendarProps<TResource = unknown> = {
  events: AppCalendarEvent<TResource>[];
  onEventClick?: (event: AppCalendarEvent<TResource>) => void;
  onDateSelect?: (selection: CalendarDateSelection) => void;
  initialDate?: Date | string;
  initialView?: CalendarView;
  locale?: string;
  timeZone?: string;
  firstDay?: number;
  isLoading?: boolean;
  labels?: Partial<Omit<AppCalendarLabels, "status">> & {
    status?: Record<string, string>;
  };
  showLegend?: boolean;
  className?: string;
};
