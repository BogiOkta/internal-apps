"use client";

export const administrativeGridPageSizes = [20, 50, 100] as const;

export function GridPagination({ page, pageSize, totalCount, onPageChange, onPageSizeChange, labels }: {
  page: number; pageSize: number; totalCount: number;
  onPageChange: (page: number) => void; onPageSizeChange: (pageSize: number) => void;
  labels: { range: (from: number, to: number, total: number) => string; pageSize: string; first: string; previous: string; next: string; last: string };
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  return <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
    <span>{labels.range(from, to, totalCount)}</span>
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1">{labels.pageSize}<select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="min-h-8 rounded border border-slate-300 bg-white px-1 text-sm">{administrativeGridPageSizes.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
      <div className="flex items-center gap-1">
        <button type="button" aria-label={labels.first} disabled={page === 1} onClick={() => onPageChange(1)} className="min-h-8 rounded border border-slate-300 bg-white px-2 disabled:opacity-40">«</button>
        <button type="button" aria-label={labels.previous} disabled={page === 1} onClick={() => onPageChange(page - 1)} className="min-h-8 rounded border border-slate-300 bg-white px-2 disabled:opacity-40">‹</button>
        <span className="px-1 text-xs">{page}/{totalPages}</span>
        <button type="button" aria-label={labels.next} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="min-h-8 rounded border border-slate-300 bg-white px-2 disabled:opacity-40">›</button>
        <button type="button" aria-label={labels.last} disabled={page >= totalPages} onClick={() => onPageChange(totalPages)} className="min-h-8 rounded border border-slate-300 bg-white px-2 disabled:opacity-40">»</button>
      </div>
    </div>
  </div>;
}
