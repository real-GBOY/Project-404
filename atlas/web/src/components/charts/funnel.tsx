export interface FunnelStage {
  label: string;
  n: number;
  rate: string;
  pct: number;
  color: string;
}

/** Lead Conversion Funnel — stacked labeled bars. */
export function Funnel({ stages }: { stages: FunnelStage[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {stages.map((s) => (
        <div key={s.label}>
          <div className="mb-1 flex items-baseline gap-2">
            <span className="flex-1 text-[10px] uppercase tracking-[0.08em] text-secondary">{s.label}</span>
            <span className="font-mono text-[11px] font-semibold">{s.n}</span>
            <span className="font-mono text-[10px] text-subtle">{s.rate}</span>
          </div>
          <div className="h-3.5 bg-surface-track">
            <div className="h-full" style={{ width: `${s.pct}%`, background: s.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface StackedSegment {
  label: string;
  n: number;
  pct: number;
  color: string;
}

/** Inventory-split stacked bar + legend (donut-equivalent, flat design has no real donut). */
export function StackedBarLegend({ segments }: { segments: StackedSegment[] }) {
  return (
    <div>
      <div className="flex h-2.5 gap-px overflow-hidden rounded-sm">
        {segments.map((s) => (
          <div key={s.label} style={{ width: `${s.pct}%`, background: s.color }} />
        ))}
      </div>
      <div className="mt-3 flex flex-col">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 border-b border-border-row py-1.5 last:border-0">
            <i className="inline-block size-2 flex-none" style={{ background: s.color }} />
            <span className="flex-1 text-[11.5px]">{s.label}</span>
            <span className="font-mono text-[11px] font-semibold">{s.n}</span>
            <span className="w-10 flex-none text-end font-mono text-[10px] text-subtle">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
