import type { CalendarView } from "@/components/calendar/calendar-types";

type CalendarToolbarProps = {
  title: string;
  view: CalendarView;
  labels: {
    previous: string;
    next: string;
    today: string;
    view: string;
    month: string;
    week: string;
    day: string;
    agenda: string;
  };
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
};

const buttonClassName =
  "min-h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

export function CalendarToolbar({
  title,
  view,
  labels,
  onPrevious,
  onNext,
  onToday,
  onViewChange,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onPrevious} aria-label={labels.previous}
          title={labels.previous} className={buttonClassName}>
          <span aria-hidden="true">‹</span>
        </button>
        <button type="button" onClick={onToday} className={buttonClassName}>
          {labels.today}
        </button>
        <button type="button" onClick={onNext} aria-label={labels.next}
          title={labels.next} className={buttonClassName}>
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <h2 aria-live="polite" className="min-w-0 text-base font-semibold text-slate-950 sm:text-lg">
        {title}
      </h2>

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <span className="sr-only sm:not-sr-only">{labels.view}</span>
        <select value={view}
          onChange={(event) => onViewChange(event.target.value as CalendarView)}
          className="min-h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">
          <option value="month">{labels.month}</option>
          <option value="week">{labels.week}</option>
          <option value="day">{labels.day}</option>
          <option value="agenda">{labels.agenda}</option>
        </select>
      </label>
    </div>
  );
}
