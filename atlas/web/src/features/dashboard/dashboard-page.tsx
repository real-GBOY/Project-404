import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { KpiStrip, KpiTile } from "@/components/ui/kpi-tile";
import { Card, CardHeader, CardLink } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Icon } from "@/components/ui/icon";
import { InsightCard } from "@/components/domain/insight-card";
import { DualBarChart, ChartLegend } from "@/components/charts/bar-chart";
import { LineChart, StatFooter } from "@/components/charts/line-chart";
import { Funnel, StackedBarLegend } from "@/components/charts/funnel";
import { useConfirm } from "@/lib/confirm/confirm-provider";
import { useToast } from "@/lib/toast/toast-provider";
import { toneFromHex, deltaSignFromHex } from "@/lib/hex-tone";
import { useSimulatedFeed } from "@/lib/realtime/simulated-feed";
import { DASHBOARD_KPIS, REVENUE_CHART, INVENTORY_BREAKDOWN, DASHBOARD_MISC } from "@/mocks/fixtures/dashboard";
import { DASHBOARD_INSIGHTS } from "@/mocks/fixtures/ai-insights";
import { CRM_FUNNEL } from "@/mocks/fixtures/pipeline-stages";
import { PROJECTS } from "@/mocks/fixtures/projects";
import { ACTIVITY_FEED } from "@/mocks/fixtures/activity-feed";

const RANGES = [
  { value: "mtd", label: "MTD" },
  { value: "qtd", label: "QTD" },
  { value: "ytd", label: "YTD" },
  { value: "12m", label: "12M" },
] as const;

const VELOCITY_SERIES = [9.8, 10.4, 11.2, 10.9, 12, 12.6, 11.9, 13.4, 13.1, 14, 13.6, 14.2];
const COLLECTION_SERIES = [86, 88, 87, 90, 89, 91, 88, 92, 90, 93, 89, 91.3];

export function DashboardPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("mtd");
  const feed = useSimulatedFeed(
    ACTIVITY_FEED.map((a) => ({ text: a.text, who: a.who, color: a.color })),
    ACTIVITY_FEED,
  );

  async function handleDecay() {
    const ok = await confirm({
      title: "Create 23 follow-up tasks?",
      body: "Atlas will assign a follow-up task to each lead's owning agent and record this action in the audit log.",
      cta: "Create tasks",
    });
    if (ok) toast.push({ kind: "success", title: "23 follow-up tasks created", body: "Assigned to owning agents." });
  }

  return (
    <PageContainer>
      <PageHeader
        title="Executive Dashboard"
        description={`Portfolio across 5 projects · 14 buildings · 1,286 units · updated ${DASHBOARD_MISC.updatedAt}`}
        actions={
          <>
            <SegmentedControl value={range} onChange={setRange} options={RANGES} />
            <Button variant="secondary" size="sm" icon="download">
              Export
            </Button>
          </>
        }
      />

      <KpiStrip className="mb-3.5">
        {DASHBOARD_KPIS.map((k) => (
          <KpiTile
            key={k.label}
            label={k.label}
            value={k.value}
            delta={k.delta}
            deltaSign={deltaSignFromHex(k.deltaFg)}
            spark={k.sparkValues.map((v) => ({ h: (v / Math.max(...k.sparkValues)) * 100 }))}
          />
        ))}
      </KpiStrip>

      <Card className="mb-3.5 border-primary-border">
        <div className="flex items-center gap-2 border-b border-primary-border bg-primary-surface-pale px-3 py-2">
          <Icon name="spark" size={14} className="text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-primary">AI Insights</span>
          <span className="text-[10.5px] text-secondary">
            3 new · generated {DASHBOARD_MISC.insightTime} from live portfolio data
          </span>
          <div className="flex-1" />
          <button onClick={() => navigate("/copilot")} className="text-[11px] font-medium text-primary hover:underline">
            Open Copilot →
          </button>
        </div>
        <div className="grid grid-cols-1 gap-px bg-border-row md:grid-cols-3">
          {DASHBOARD_INSIGHTS.map((i) => (
            <InsightCard
              key={i.key}
              insight={{
                id: i.key,
                tag: i.tag,
                tagTone: toneFromHex(i.tagFg),
                confidence: i.confidence.replace("confidence ", ""),
                text: i.text,
                detail: i.detail,
                cta: i.cta,
              }}
              onAct={i.key === "decay" ? handleDecay : () => i.targetRoute && navigate(`/${i.targetRoute.replace("an_", "analytics/")}`)}
              onDismiss={() => toast.push({ title: "Insight dismissed" })}
            />
          ))}
        </div>
      </Card>

      <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-2.5 border-b border-border-row px-3 py-2.5">
            <span className="text-[11.5px] font-semibold">Revenue vs. Collections</span>
            <span className="text-[10px] text-subtle">EGP millions · trailing 12 months</span>
            <div className="flex-1" />
            <ChartLegend items={[{ label: "Contracted", color: "var(--color-chart-primary)" }, { label: "Collected", color: "var(--color-chart-secondary)" }]} />
          </div>
          <DualBarChart data={REVENUE_CHART.map((m) => ({ label: m.month, top: m.month === "Mar" ? "1.42B" : "", a: m.contracted, b: m.collected }))} />
        </Card>

        <Card>
          <CardHeader title="Inventory" subtitle="1,286 units" />
          <div className="p-3">
            <StackedBarLegend
              segments={INVENTORY_BREAKDOWN.map((s) => ({ label: s.label, n: parseInt(s.count, 10), pct: s.pct, color: s.color }))}
            />
          </div>
        </Card>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader title="Lead Conversion Funnel" />
          <div className="p-3">
            <Funnel stages={CRM_FUNNEL.map((f) => ({ label: f.label, n: parseInt(f.count.replace(/,/g, ""), 10), rate: f.rate, pct: f.pct, color: f.color }))} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Sales Velocity" subtitle="units / week" />
          <div className="px-3 pt-3">
            <LineChart data={VELOCITY_SERIES.map((v, i) => ({ label: String(i), value: v }))} />
          </div>
          <StatFooter items={[{ label: "Current", value: "14.2 u/wk" }, { label: "vs. last month", value: "+18.4%", valueClassName: "text-success" }]} />
        </Card>

        <Card>
          <CardHeader title="Collection Trend" subtitle="% of due collected" />
          <div className="px-3 pt-3">
            <LineChart data={COLLECTION_SERIES.map((v, i) => ({ label: String(i), value: v }))} color="var(--color-success)" />
          </div>
          <StatFooter items={[{ label: "Collection rate", value: "91.3%" }, { label: "Overdue", value: "EGP 42.6M", valueClassName: "text-danger" }]} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center border-b border-border-row px-3 py-2.5">
            <span className="flex-1 text-[11.5px] font-semibold">Project Performance</span>
            <CardLink to="/projects">All projects →</CardLink>
          </div>
          <div className="grid grid-cols-[1.4fr_.7fr_.8fr_.8fr_1.1fr] gap-2 border-b border-border-row bg-surface-subtle px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">
            <div>Project</div>
            <div className="text-end">Sold</div>
            <div className="text-end">Revenue</div>
            <div className="text-end">Velocity</div>
            <div>Sell-through</div>
          </div>
          {PROJECTS.map((p) => {
            const vel = parseFloat(p.velocity);
            return (
              <div
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className="grid cursor-pointer grid-cols-[1.4fr_.7fr_.8fr_.8fr_1.1fr] items-center gap-2 border-b border-border-row px-3 py-2 last:border-0 hover:bg-surface-hover"
              >
                <div className="min-w-0">
                  <div className="truncate text-[11.5px] font-medium">{p.name}</div>
                  <div className="truncate text-[10px] text-subtle">{p.location}</div>
                </div>
                <div className="text-end font-mono text-[11px]">{p.soldUnits}</div>
                <div className="text-end font-mono text-[11px]">EGP {p.revenueEgp}</div>
                <div className={`text-end font-mono text-[11px] ${vel >= 9 ? "text-success" : "text-warning"}`}>{p.velocity}</div>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 flex-1 bg-surface-track">
                    <div className="h-full bg-primary" style={{ width: `${p.sellThroughPct}%` }} />
                  </div>
                  <span className="w-8 flex-none font-mono text-[10px] text-secondary">{p.sellThroughPct}%</span>
                </div>
              </div>
            );
          })}
        </Card>

        <Card className="flex flex-col">
          <div className="flex items-center border-b border-border-row px-3 py-2.5">
            <span className="flex-1 text-[11.5px] font-semibold">Live Activity</span>
            <span className="text-[10px] text-success">● streaming</span>
          </div>
          <div className="max-h-[340px] flex-1 overflow-y-auto">
            {feed.map((a) => (
              <div key={a.id} className="flex gap-2 border-b border-border-row px-3 py-2 last:border-0" style={{ animation: "fadein .4s ease" }}>
                <span className="mt-1 size-1.5 flex-none rounded-full" style={{ background: a.color }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] leading-snug">{a.text}</div>
                  <div className="mt-0.5 text-[10px] text-subtle">
                    {a.who} · {a.when}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
