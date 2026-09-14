import { useNavigate } from "react-router-dom";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { KpiStrip, KpiTile } from "@/components/ui/kpi-tile";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ErrorState } from "@/components/feedback/error-state";
import { DualBarChart } from "@/components/charts/bar-chart";
import { LineChart, StatFooter } from "@/components/charts/line-chart";
import { ANALYTICS, ANALYTICS_FILTERS } from "@/mocks/fixtures/analytics";
import { REVENUE_CHART } from "@/mocks/fixtures/dashboard";
import { PROJECTS } from "@/mocks/fixtures/projects";

type AnalyticsRoute = keyof typeof ANALYTICS;

const VELOCITY_SERIES = [9.8, 10.4, 11.2, 10.9, 12, 12.6, 11.9, 13.4, 13.1, 14, 13.6, 14.2];
const COLLECTION_SERIES = [86, 88, 87, 90, 89, 91, 88, 92, 90, 93, 89, 91.3];

function deltaSign(delta: string): "up" | "down" | "flat" {
  if (!delta) return "flat";
  return delta.trim().startsWith("-") ? "down" : "up";
}

export function AnalyticsPage({ route }: { route: AnalyticsRoute }) {
  const navigate = useNavigate();
  const config = ANALYTICS[route];
  const series = config.lineKind === "velocity" ? VELOCITY_SERIES : COLLECTION_SERIES;

  return (
    <PageContainer>
      <PageHeader
        title={config.title}
        description={config.subtitle}
        actions={
          <>
            <Button variant="secondary" size="sm" icon="download">
              Export
            </Button>
            <Button size="sm">Save view</Button>
          </>
        }
        below={
          <div className="flex flex-wrap gap-1.5">
            {ANALYTICS_FILTERS.map((f) => (
              <Chip key={f} activeVariant="pale">
                {f}
              </Chip>
            ))}
          </div>
        }
      />

      <KpiStrip className="mb-3.5">
        {config.kpis.map((k) => (
          <KpiTile key={k.label} label={k.label} value={k.value} delta={k.delta} deltaSign={deltaSign(k.delta)} compact />
        ))}
      </KpiStrip>

      {config.error ? (
        <div className="mb-3">
          <ErrorState
            title="Forecast model didn't return in time"
            message="The revenue forecast integration timed out. Everything else on this page reflects live data."
            traceId="req_8f21ac9e"
            onRetry={() => undefined}
          />
        </div>
      ) : (
        <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader title={config.bars} />
            <DualBarChart data={REVENUE_CHART.map((m) => ({ label: m.month, top: "", a: m.contracted, b: m.collected }))} height={150} />
          </Card>
          <Card>
            <CardHeader title={config.line} />
            <div className="px-3 pt-3">
              <LineChart data={series.map((v, i) => ({ label: String(i), value: v }))} height={80} />
            </div>
            <StatFooter items={[{ label: "Latest", value: String(series[series.length - 1]) }, { label: "12mo change", value: `${(((series[series.length - 1] - series[0]) / series[0]) * 100).toFixed(1)}%`, valueClassName: "text-success" }]} />
          </Card>
        </div>
      )}

      <Card>
        <CardHeader title={config.breakdown} />
        <div className="grid grid-cols-[1.6fr_.8fr_.8fr_1.2fr] gap-2 border-b border-border-row bg-surface-subtle px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">
          <div>Project</div>
          <div className="text-end">Units sold</div>
          <div className="text-end">Revenue</div>
          <div>Sell-through</div>
        </div>
        {PROJECTS.map((p) => (
          <div
            key={p.id}
            onClick={() => navigate(`/projects/${p.id}`)}
            className="grid cursor-pointer grid-cols-[1.6fr_.8fr_.8fr_1.2fr] items-center gap-2 border-b border-border-row px-3 py-2 last:border-0 hover:bg-surface-hover"
          >
            <div className="truncate text-[11.5px] font-medium">{p.name}</div>
            <div className="text-end font-mono text-[11px]">{p.soldUnits}</div>
            <div className="text-end font-mono text-[11px]">EGP {p.revenueEgp}</div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 flex-1 bg-surface-track">
                <div className="h-full bg-primary" style={{ width: `${p.sellThroughPct}%` }} />
              </div>
              <span className="w-8 flex-none font-mono text-[10px] text-secondary">{p.sellThroughPct}%</span>
            </div>
          </div>
        ))}
      </Card>
    </PageContainer>
  );
}
