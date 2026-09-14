export interface LineChartPoint {
  label: string;
  value: number;
}

/** A minimal SVG line chart — Sales Velocity / Collection Trend cards. */
export function LineChart({
  data,
  height = 92,
  color = "var(--color-primary)",
}: {
  data: LineChartPoint[];
  height?: number;
  color?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;
  const w = 100;
  const points = data.map((d, i) => {
    const x = (i / Math.max(1, data.length - 1)) * w;
    const y = height - ((d.value - min) / range) * height;
    return `${x},${y}`;
  });
  const path = `M${points.join(" L")}`;
  const area = `${path} L${w},${height} L0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <path d={area} fill={color} opacity={0.08} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function StatFooter({ items }: { items: { label: string; value: string; valueClassName?: string }[] }) {
  return (
    <div className="flex border-t border-border-row">
      {items.map((it, i) => (
        <div key={it.label} className={i > 0 ? "flex-1 border-l border-border-row px-3 py-2.5" : "flex-1 px-3 py-2.5"}>
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">{it.label}</div>
          <div className={`mt-0.5 text-[15px] font-semibold ${it.valueClassName ?? ""}`}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}
