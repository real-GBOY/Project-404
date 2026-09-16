import { useMemo } from "react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { ProgressBar } from "@/components/ui/progress-bar";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { ApiError } from "@/config";
import { useTeam } from "@/api/team";
import { useLeads, useActivities, useFollowups } from "@/api/crm";
import { downloadCsv } from "@/lib/csv-export";
import { useToast } from "@/lib/toast/toast-provider";

function followUpColor(pct: number): string {
  if (pct >= 85) return "var(--color-success)";
  if (pct >= 70) return "var(--color-primary)";
  return "var(--color-danger-solid)";
}

interface AgentRow {
  id: string;
  name: string;
  role: string;
  leads: number;
  qualified: number;
  viewings: number;
  sales: number;
  conversionPct: number;
  revenueEgpM: number;
  followUpPct: number;
}

const QUALIFIED_STAGES = new Set(["qualified", "contacted", "viewing", "negotiation", "reserved", "contracted", "sold"]);

export function AgentPerformancePage() {
  const toast = useToast();
  const team = useTeam();
  const leads = useLeads();
  const activities = useActivities();
  const followups = useFollowups();

  const loading = team.isLoading || leads.isLoading || activities.isLoading || followups.isLoading;
  const error = team.error ?? leads.error ?? activities.error ?? followups.error;

  const rows: AgentRow[] = useMemo(() => {
    if (!team.data) return [];
    return team.data.items
      .map((m) => {
        const agentLeads = (leads.data ?? []).filter((l) => l.agentId === m.id);
        const qualified = agentLeads.filter((l) => QUALIFIED_STAGES.has(l.stage)).length;
        const sold = agentLeads.filter((l) => l.stage === "sold");
        const viewings = (activities.data ?? []).filter((a) => a.agentId === m.id && a.type === "viewing").length;
        const agentFollowups = (followups.data ?? []).filter((f) => f.agentId === m.id);
        return {
          id: m.id,
          name: m.name,
          role: m.role,
          leads: agentLeads.length,
          qualified,
          viewings,
          sales: sold.length,
          conversionPct: agentLeads.length ? Math.round((sold.length / agentLeads.length) * 100) : 0,
          revenueEgpM: sold.reduce((s, l) => s + l.valueEgp, 0) / 1e6,
          followUpPct: agentFollowups.length ? Math.round((agentFollowups.filter((f) => f.status === "done").length / agentFollowups.length) * 100) : 0,
        };
      })
      .sort((a, b) => b.revenueEgpM - a.revenueEgpM);
  }, [team.data, leads.data, activities.data, followups.data]);

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title="Agent Performance" />
        <RowsSkeleton rows={7} cols={7} />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <PageHeader title="Agent Performance" />
        <ErrorState title="Couldn't load agent performance" message={error instanceof ApiError ? error.message : "The request failed."} />
      </PageContainer>
    );
  }

  const maxRevenue = Math.max(...rows.map((a) => a.revenueEgpM), 1);
  const topRevenue = [...rows].slice(0, 3);
  const topLeads = [...rows].sort((a, b) => b.leads - a.leads).slice(0, 3);
  const topFollowUp = [...rows].sort((a, b) => b.followUpPct - a.followUpPct).slice(0, 3);

  return (
    <PageContainer>
      <PageHeader
        title="Agent Performance"
        description={`Ranked by revenue this period across ${rows.length} agents`}
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon="download"
            onClick={() => {
              downloadCsv(
                `agent-performance-${new Date().toISOString().slice(0, 10)}.csv`,
                rows.map((a) => ({
                  agent: a.name,
                  role: a.role,
                  leads: a.leads,
                  qualified: a.qualified,
                  viewings: a.viewings,
                  sales: a.sales,
                  conversionPct: a.conversionPct,
                  revenueEgpM: a.revenueEgpM.toFixed(1),
                  followUpPct: a.followUpPct,
                })),
              );
              toast.push({ kind: "success", title: "Exported", body: "Agent performance downloaded as CSV." });
            }}
          >
            Export
          </Button>
        }
      />

      <div className="mb-3.5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <AgentGroupCard label="Top by Revenue" color="var(--color-success)" agents={topRevenue.map((a) => `${a.name} · EGP ${a.revenueEgpM.toFixed(1)}M`)} />
        <AgentGroupCard label="Most Leads" color="var(--color-primary)" agents={topLeads.map((a) => `${a.name} · ${a.leads} leads`)} />
        <AgentGroupCard label="Best Follow-up Rate" color="var(--color-warning)" agents={topFollowUp.map((a) => `${a.name} · ${a.followUpPct}%`)} />
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
        {rows.map((a, i) => (
          <div key={a.id} className="grid grid-cols-[24px_1.3fr_.6fr_.6fr_.6fr_.6fr_.7fr_1fr_1.3fr] items-center gap-2 border-b border-border-row px-3 py-2 last:border-0">
            <div className="font-mono text-[10.5px] text-subtle">{String(i + 1).padStart(2, "0")}</div>
            <div className="flex min-w-0 items-center gap-2">
              <Avatar name={a.name} size={22} />
              <div className="min-w-0">
                <div className="truncate text-[11.5px] font-semibold">{a.name}</div>
                <div className="truncate text-[9.5px] text-subtle">{a.role}</div>
              </div>
            </div>
            <div className="text-end font-mono text-[11px]">{a.leads}</div>
            <div className="text-end font-mono text-[11px]">{a.qualified}</div>
            <div className="text-end font-mono text-[11px]">{a.viewings}</div>
            <div className="text-end font-mono text-[11px]">{a.sales}</div>
            <div className="text-end font-mono text-[11px]">{a.conversionPct}%</div>
            <div className="flex items-center justify-end gap-1.5">
              <div className="h-1.5 w-10 bg-surface-track">
                <div className="h-full bg-primary" style={{ width: `${(a.revenueEgpM / maxRevenue) * 100}%` }} />
              </div>
              <span className="font-mono text-[11px] font-semibold">EGP {a.revenueEgpM.toFixed(1)}M</span>
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

function AgentGroupCard({ label, color, agents }: { label: string; color: string; agents: string[] }) {
  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-border-row px-3 py-2.5">
        <span className="size-1.5 flex-none rounded-full" style={{ background: color }} />
        <span className="text-[11.5px] font-semibold">{label}</span>
      </div>
      <div className="px-3 pb-3 pt-2">
        <ul className="flex flex-col gap-1.5">
          {agents.length === 0 ? <li className="text-[11px] text-subtle">No data yet.</li> : agents.map((it) => <li key={it} className="text-[11px] text-body">{it}</li>)}
        </ul>
      </div>
    </Card>
  );
}
