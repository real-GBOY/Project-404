import { useState } from "react";
import { useAnalytics, type Analytics, type AnalyticsRange } from "@/api/analytics";
import { METHOD_LABEL } from "@/api/billing";
import { SOURCE_LABEL } from "@/api/reservations";
import { Card } from "@/components/ui/card";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { formatDayHeader, formatEgp, formatIsoDate } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Analytics (design: "Analytics"): 7 / 30 / 90-night range, the design's KPI cards (ADR,
 * RevPAR, average stay, cancellation rate), revenue and occupancy over time, booking sources and
 * payment methods. Figures come from the server (definitions in analytics/domain/kpis.ts); the
 * page only lays them out, with each KPI compared to the period before.
 */
export function AnalyticsPage() {
  const [days, setDays] = useState<AnalyticsRange>(30);
  const report = useAnalytics(days);

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={
          report.data
            ? `${formatIsoDate(report.data.range.from)} – ${formatIsoDate(
                addDay(report.data.range.to, -1),
                true,
              )} · compared with the ${days} nights before`
            : undefined
        }
        actions={
          <FilterTabs
            label="Range"
            size="sm"
            value={String(days) as "7" | "30" | "90"}
            onChange={(v) => setDays(Number(v) as AnalyticsRange)}
            tabs={[
              { value: "7", label: "7d" },
              { value: "30", label: "30d" },
              { value: "90", label: "90d" },
            ]}
          />
        }
      />
      {report.isLoading ? (
        <LoadingState />
      ) : report.error ? (
        <ErrorState error={report.error} />
      ) : (
        <Report r={report.data!} />
      )}
    </>
  );
}

function addDay(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function Delta({ now, before, unit = "%" }: { now: number; before: number; unit?: "%" | "pts" }) {
  if (before === 0 && now === 0) return <span className="text-faint">No change</span>;
  if (before === 0) return <span className="text-faint">New this period</span>;
  const change =
    unit === "pts"
      ? Math.round((now - before) * 10) / 10
      : Math.round(((now - before) / before) * 1000) / 10;
  const up = change >= 0;
  return (
    <span className={up ? "text-success" : "text-danger"}>
      {up ? "↑" : "↓"} {Math.abs(change)}
      {unit === "pts" ? " pts" : "%"} vs previous
    </span>
  );
}

function Report({ r }: { r: Analytics }) {
  const p = r.performance;
  const kpis = [
    {
      label: "ADR",
      value: formatEgp(Math.round(p.adr)),
      sub: <Delta now={p.adr} before={r.previous.adr} />,
      hint: "Room revenue per room-night sold",
    },
    {
      label: "RevPAR",
      value: formatEgp(Math.round(p.revpar)),
      sub: <Delta now={p.revpar} before={r.previous.revpar} />,
      hint: "Room revenue per room-night available",
    },
    {
      label: "Avg. Stay",
      value: `${r.avgStayNights} nights`,
      sub: <span className="text-faint">{r.bookings} bookings due in</span>,
    },
    {
      label: "Cancellation Rate",
      value: `${r.cancellationRatePct}%`,
      sub: <span className="text-faint">No-shows {r.noShowRatePct}%</span>,
    },
  ];

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            aria-label={k.label}
            title={k.hint}
            className="rounded-card border border-border bg-surface p-4"
          >
            <div className="mb-2 text-label text-muted">{k.label}</div>
            <div className="text-[20px] font-extrabold">{k.value}</div>
            <div className="mt-1 text-label font-semibold">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Bars
          title="Revenue Over Time"
          headline={formatEgp(Math.round(p.totalRevenue))}
          sub={
            <>
              Rooms {formatEgp(Math.round(p.roomRevenue))} · Extras{" "}
              {formatEgp(Math.round(p.extrasRevenue))} ·{" "}
              <Delta now={p.totalRevenue} before={r.previous.totalRevenue} />
            </>
          }
          tone="bg-primary"
          points={r.series.map((d) => ({
            date: d.date,
            value: d.totalRevenue,
            label: formatEgp(Math.round(d.totalRevenue)),
          }))}
        />
        <Bars
          title="Occupancy Over Time"
          headline={`${p.occupancyPct}%`}
          sub={
            <>
              {p.roomNightsSold} of {p.roomNightsAvailable} room-nights ·{" "}
              <Delta now={p.occupancyPct} before={r.previous.occupancyPct} unit="pts" />
            </>
          }
          tone="bg-success"
          points={r.series.map((d) => ({
            date: d.date,
            value: d.occupancyPct,
            label: `${d.occupancyPct}%`,
          }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Shares
          title="Booking Sources"
          tone="bg-primary"
          rows={r.sources.map((s) => ({
            key: s.source,
            label: SOURCE_LABEL[s.source],
            pct: s.pct,
            detail: `${s.bookings} bookings · ${formatEgp(Math.round(s.revenue))}`,
          }))}
        />
        <Shares
          title="Payment Methods"
          tone="bg-success"
          rows={r.paymentMethods.map((m) => ({
            key: m.method,
            label: METHOD_LABEL[m.method],
            pct: m.pct,
            detail: formatEgp(Math.round(m.amount)),
          }))}
        />
      </div>
    </>
  );
}

/** The design's bar chart: bar height and opacity both follow the value. */
function Bars({
  title,
  headline,
  sub,
  tone,
  points,
}: {
  title: string;
  headline: string;
  sub: React.ReactNode;
  tone: string;
  points: Array<{ date: string; value: number; label: string }>;
}) {
  const max = Math.max(...points.map((p) => p.value), 1);
  const dense = points.length > 31;
  return (
    <Card>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-body font-bold">{title}</h2>
        <div className="text-body font-extrabold">{headline}</div>
      </div>
      <div className="mb-3.5 text-label text-muted">{sub}</div>
      <div
        role="list"
        aria-label={title}
        className={cn("flex h-[110px] items-end", dense ? "gap-px" : "gap-1.5 sm:gap-2")}
      >
        {points.map((p) => {
          const ratio = p.value / max;
          return (
            <div
              key={p.date}
              role="listitem"
              aria-label={`${p.date}: ${p.label}`}
              title={`${formatDayHeader(p.date)} · ${p.label}`}
              className={cn("min-w-0 flex-1 rounded-t-[3px]", tone)}
              style={{
                height: `${Math.max(Math.round(ratio * 110), p.value > 0 ? 2 : 0)}px`,
                opacity: 0.4 + ratio * 0.6,
              }}
            />
          );
        })}
      </div>
    </Card>
  );
}

function Shares({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: string;
  rows: Array<{ key: string; label: string; pct: number; detail: string }>;
}) {
  return (
    <Card>
      <h2 className="m-0 mb-3.5 text-body font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="m-0 text-small text-muted">Nothing in this period.</p>
      ) : (
        rows.map((row) => (
          <div key={row.key} className="mb-3 last:mb-0" aria-label={`${row.label} ${row.pct}%`}>
            <div className="mb-[5px] flex justify-between gap-3 text-label font-semibold">
              <span>{row.label}</span>
              <span>
                <span className="mr-2 font-normal text-faint">{row.detail}</span>
                {row.pct}%
              </span>
            </div>
            <div className="h-2 rounded-[4px] bg-neutral-soft">
              <div className={cn("h-2 rounded-[4px]", tone)} style={{ width: `${row.pct}%` }} />
            </div>
          </div>
        ))
      )}
    </Card>
  );
}
