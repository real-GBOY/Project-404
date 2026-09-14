export interface BarChartPoint {
  label: string;
  top: string;
  a: number;
  b: number;
}

/** Dual-series bar chart (Revenue vs Collections): two adjacent bars per slot. */
export function DualBarChart({ data, height = 172 }: { data: BarChartPoint[]; height?: number }) {
  return (
    <div className="flex items-end gap-2 px-3 pb-2 pt-3.5" style={{ height }}>
      {data.map((m, i) => (
        <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
          <div className="font-mono text-[9.5px] text-secondary">{m.top}</div>
          <div className="flex h-full w-full items-end gap-px">
            <div className="flex-1 bg-chart-primary" style={{ height: `${m.a}%` }} />
            <div className="flex-1 bg-chart-secondary" style={{ height: `${m.b}%` }} />
          </div>
          <div className="text-[9.5px] text-subtle">{m.label}</div>
        </div>
      ))}
    </div>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <>
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-[10px] text-body">
          <i className="inline-block size-2" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </>
  );
}
