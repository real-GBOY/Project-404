import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { ProgressBar } from "@/components/ui/progress-bar";
import { AGENTS_PERF, AGENT_GROUPS } from "@/mocks/fixtures/analytics";

const MAX_REVENUE = Math.max(...AGENTS_PERF.map((a) => a.revenueEgpM));

function followUpColor(pct: number): string {
  if (pct >= 85) return "var(--color-success)";
  if (pct >= 70) return "var(--color-primary)";
  return "var(--color-danger-solid)";
}

export function AgentPerformancePage() {
  return (
    <PageContainer>
      <PageHeader
        title="Agent Performance"
        description="Ranked by revenue this month across 7 agents · 3 teams"
        actions={
          <Button variant="secondary" size="sm" icon="download">
            Export
          </Button>
        }
      />

      <div className="mb-3.5 grid grid-cols-1 gap-3 md:grid-cols-3">
        {AGENT_GROUPS.map((g) => (
          <Card key={g.label}>
            <div className="flex items-center gap-2 border-b border-border-row px-3 py-2.5">
              <span className="size-1.5 flex-none rounded-full" style={{ background: g.color }} />
              <span className="text-[11.5px] font-semibold">{g.label}</span>
            </div>
            <div className="px-3 pb-3 pt-2">
              <p className="mb-2 text-[10.5px] text-subtle">{g.note}</p>
              <ul className="flex flex-col gap-1.5">
                {g.items.map((it) => (
                  <li key={it} className="text-[11px] text-body">
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Full ranking" />
        <div className="grid grid-cols-[24px_1.3fr_.6fr_.6fr_.6fr_.6fr_.7fr_1fr_1.3fr] gap-2 border-b border-border-row bg-surface-subtle px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">
          <div>#</div>
          <div>Agent</div>
          <div className="text-end">Leads</div>
          <div className="text-end">Qual.</div>
          <div className="text-end">Views</div>
          <div className="text-end">Sales</div>
          <div className="text-end">Conv.</div>
          <div className="text-end">Revenue</div>
          <div>Follow-up</div>
        </div>
        {AGENTS_PERF.map((a, i) => (
          <div
            key={a.name}
            className="grid grid-cols-[24px_1.3fr_.6fr_.6fr_.6fr_.6fr_.7fr_1fr_1.3fr] items-center gap-2 border-b border-border-row px-3 py-2 last:border-0"
          >
            <div className="font-mono text-[10.5px] text-subtle">{String(i + 1).padStart(2, "0")}</div>
            <div className="flex min-w-0 items-center gap-2">
              <Avatar name={a.name} size={22} />
              <div className="min-w-0">
                <div className="truncate text-[11.5px] font-semibold">{a.name}</div>
                <div className="truncate text-[9.5px] text-subtle">{a.team}</div>
              </div>
            </div>
            <div className="text-end font-mono text-[11px]">{a.leads}</div>
            <div className="text-end font-mono text-[11px]">{a.qualified}</div>
            <div className="text-end font-mono text-[11px]">{a.viewings}</div>
            <div className="text-end font-mono text-[11px]">{a.sales}</div>
            <div className="text-end font-mono text-[11px]">{a.conversionPct}%</div>
            <div className="flex items-center justify-end gap-1.5">
              <div className="h-1.5 w-10 bg-surface-track">
                <div className="h-full bg-primary" style={{ width: `${(a.revenueEgpM / MAX_REVENUE) * 100}%` }} />
              </div>
              <span className="font-mono text-[11px] font-semibold">EGP {a.revenueEgpM}M</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ProgressBar value={a.followUpPct} color={followUpColor(a.followUpPct)} className="max-w-[70px] flex-1" />
              <span className="w-8 flex-none font-mono text-[10px] text-secondary">{a.followUpPct}%</span>
            </div>
          </div>
        ))}
      </Card>
    </PageContainer>
  );
}
