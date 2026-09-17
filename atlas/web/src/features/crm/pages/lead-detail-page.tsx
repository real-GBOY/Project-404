import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageContainer } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { KpiStrip, KpiTile } from "@/components/ui/kpi-tile";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Chip } from "@/components/ui/chip";
import { TabBar } from "@/components/ui/tabs";
import { ProgressBar } from "@/components/ui/progress-bar";
import { AiBubble } from "@/components/domain/chat-bubble";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { useTeamDirectory } from "@/api/team";
import { useActivities, useExtractLeadRequirements, useLead, useLeadSalesBrief, type LeadIntelligenceBrief, type UnitMatchResult } from "@/api/crm";
import { formatEgp, formatEgpExact } from "@/lib/money";
import { timeAgo } from "@/lib/time";
import { titleCase } from "@/lib/text";
import { ApiError } from "@/config";

const TABS = ["Overview", "AI Intelligence", "Activity"] as const;
type LeadTab = (typeof TABS)[number];

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<LeadTab>("Overview");

  const lead = useLead(id);
  const team = useTeamDirectory();
  const activities = useActivities({ relatedType: "lead", relatedId: id });

  if (lead.isLoading || team.isLoading) {
    return (
      <PageContainer>
        <BackLink />
        <RowsSkeleton rows={6} cols={3} />
      </PageContainer>
    );
  }

  if (lead.error) {
    return (
      <PageContainer>
        <BackLink />
        <ErrorState title="Couldn't load this lead" message={lead.error instanceof ApiError ? lead.error.message : "The request failed."} onRetry={() => lead.refetch()} />
      </PageContainer>
    );
  }

  if (!lead.data) {
    return (
      <PageContainer>
        <BackLink />
        <EmptyState icon="lead" title="Lead not found" description={`No lead with ID "${id ?? ""}" exists in this workspace.`} />
      </PageContainer>
    );
  }

  const l = lead.data;
  const agentName = team.byId.get(l.agentId) ?? l.agentId;

  return (
    <PageContainer>
      <BackLink />

      <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={l.name} size={44} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="m-0 text-[18px] font-semibold tracking-[-0.02em] text-foreground">{l.name}</h1>
              <StatusBadge status={titleCase(l.status)} />
              <span className="font-mono text-[10.5px] text-subtle">{l.id}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-secondary">
              <span>{l.phone}</span>
              <span>{l.email ?? "—"}</span>
              <span>{agentName}</span>
              <span>Last activity {timeAgo(l.lastActivityAt)}</span>
            </div>
          </div>
        </div>
      </div>

      <KpiStrip className="mb-3.5">
        <KpiTile label="Score" value={String(l.score)} compact />
        <KpiTile label="Value" value={formatEgp(l.valueEgp)} compact />
        <KpiTile label="Stage" value={titleCase(l.stage)} compact />
        <KpiTile label="Agent" value={agentName} compact />
      </KpiStrip>

      <TabBar value={tab} onChange={setTab} tabs={TABS} className="mb-3.5" />

      {tab === "Overview" && (
        <Card>
          <div className="divide-y divide-border-row">
            <InfoRow label="Phone" value={l.phone} />
            <InfoRow label="Email" value={l.email ?? "—"} />
            <InfoRow label="Source" value={titleCase(l.source)} />
            <InfoRow label="Status" value={titleCase(l.status)} />
            <InfoRow label="Stage" value={titleCase(l.stage)} />
            <InfoRow label="Interest" value={l.interestText ?? "—"} />
            <InfoRow label="Value" value={formatEgpExact(l.valueEgp)} />
            <InfoRow label="Agent" value={agentName} />
          </div>
        </Card>
      )}

      {tab === "AI Intelligence" && (
        <AiIntelligenceTab leadId={l.id} leadName={l.name} requirementsNotes={l.requirementsNotes} initialRequirements={l.requirements} />
      )}

      {tab === "Activity" && (
        <Card className="p-3">
          {activities.isLoading ? (
            <RowsSkeleton rows={4} cols={2} />
          ) : (activities.data ?? []).length === 0 ? (
            <EmptyState icon="history" title="No activity recorded" description="Calls, viewings and notes logged against this lead will appear here." />
          ) : (
            <div className="flex flex-col">
              {(activities.data ?? []).map((entry, i, arr) => (
                <div key={entry.id} className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 size-2 flex-none rounded-full bg-primary" />
                    {i < arr.length - 1 && <span className="w-px flex-1 bg-border-row" />}
                  </div>
                  <div className="min-w-0 flex-1 pb-3.5">
                    <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">{titleCase(entry.type)}</div>
                    <div className="mt-0.5 text-[11.5px] text-body">{entry.subject}{entry.outcome ? ` — ${entry.outcome}` : ""}</div>
                    <div className="mt-0.5 text-[10px] text-subtle">{timeAgo(entry.occurredAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </PageContainer>
  );
}

function BackLink() {
  return (
    <Link to="/leads" className="mb-3 inline-flex w-fit items-center gap-1 text-[11px] font-medium text-secondary hover:text-foreground">
      <Icon name="chevron-left" size={12} />
      Back to Leads
    </Link>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5">
      <span className="text-[10.5px] text-subtle">{label}</span>
      <span className="text-[11.5px] font-medium text-body">{value}</span>
    </div>
  );
}

/**
 * The Lead AI Intelligence workflow: notes -> AI requirement extraction
 * (deterministic on the wire, AI on the inside) -> deterministic property
 * matching -> a best-effort AI explanation/draft message. Every deterministic
 * result (score, reasons, next action) renders in plain cards; every
 * AI-generated block renders inside an `AiBubble` — never mixed, so the
 * agent always knows which is which.
 */
function AiIntelligenceTab({
  leadId,
  leadName,
  requirementsNotes,
  initialRequirements,
}: {
  leadId: string;
  leadName: string;
  requirementsNotes: string | null;
  initialRequirements: LeadIntelligenceBrief["requirements"] | null;
}) {
  const [notes, setNotes] = useState(requirementsNotes ?? "");
  const extract = useExtractLeadRequirements();
  const brief = useLeadSalesBrief();

  // A fresh "Analyze" in this session wins; otherwise fall back to whatever
  // was already persisted on the lead from a previous visit.
  const latestRequirements = extract.data?.requirements ?? initialRequirements;
  const hasRequirements = latestRequirements !== null;

  function handleAnalyze() {
    if (!notes.trim()) return;
    extract.mutate({ id: leadId, notes: notes.trim() });
  }

  function handleGenerateBrief() {
    brief.mutate(leadId);
  }

  return (
    <div className="flex flex-col gap-3.5">
      <Card className="p-3.5">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
          <Icon name="spark" size={13} className="text-primary" />
          Client Requirements
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder='e.g. "Looking for a 3 bedroom apartment in New Cairo around 8-10M, preferably first floor, delivery within two years."'
          rows={3}
          className="w-full resize-none rounded-btn border border-border bg-surface px-2.5 py-2 text-[11.5px] text-foreground outline-none placeholder:text-placeholder focus-visible:border-primary"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-subtle">English, Arabic or a mix of both — the AI reads either.</span>
          <Button size="sm" icon="spark" loading={extract.isPending} disabled={!notes.trim()} onClick={handleAnalyze}>
            Analyze Requirements
          </Button>
        </div>

        {extract.isError && (
          <div className="mt-2.5">
            <ErrorState title="Couldn't analyze these requirements" message={extract.error instanceof ApiError ? extract.error.message : "The request failed."} onRetry={handleAnalyze} />
          </div>
        )}

        {latestRequirements && <RequirementsSummary requirements={latestRequirements} />}
      </Card>

      {!hasRequirements ? (
        <Card>
          <EmptyState icon="spark" title="No requirements captured yet" description="Analyze the client's notes above to unlock deterministic property matching and the AI sales brief." />
        </Card>
      ) : (
        <Card className="p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
              <Icon name="spark" size={13} className="text-primary" />
              AI Sales Brief
            </div>
            <Button size="sm" variant="secondary" icon="history" loading={brief.isPending} onClick={handleGenerateBrief}>
              Generate Sales Brief
            </Button>
          </div>

          {brief.isPending && <RowsSkeleton rows={3} cols={2} />}

          {brief.isError && (
            <ErrorState title="Couldn't generate the sales brief" message={brief.error instanceof ApiError ? brief.error.message : "The request failed."} onRetry={handleGenerateBrief} />
          )}

          {!brief.isPending && !brief.data && !brief.isError && (
            <p className="text-[11px] text-subtle">Generate a brief to see ranked matches, a recommended next action and a draft client message.</p>
          )}

          {brief.data && <SalesBriefView leadName={leadName} brief={brief.data} />}
        </Card>
      )}
    </div>
  );
}

function RequirementsSummary({ requirements }: { requirements: LeadIntelligenceBrief["requirements"] }) {
  const chips: Array<{ label: string }> = [];
  if (requirements.budgetMinEgp !== null || requirements.budgetMaxEgp !== null) {
    chips.push({ label: `Budget ${requirements.budgetMinEgp ? formatEgp(requirements.budgetMinEgp) : "?"}–${requirements.budgetMaxEgp ? formatEgp(requirements.budgetMaxEgp) : "?"}` });
  }
  if (requirements.locations.length) chips.push({ label: `Location ${requirements.locations.join(", ")}` });
  if (requirements.propertyTypes.length) chips.push({ label: `Type ${requirements.propertyTypes.join(", ")}` });
  if (requirements.bedroomsMin !== null || requirements.bedroomsMax !== null) {
    chips.push({ label: `Bedrooms ${requirements.bedroomsMin ?? requirements.bedroomsMax}${requirements.bedroomsMax && requirements.bedroomsMax !== requirements.bedroomsMin ? `–${requirements.bedroomsMax}` : ""}` });
  }
  if (requirements.preferredFloors.length) chips.push({ label: `Floor ${requirements.preferredFloors.join(", ")}` });
  if (requirements.deliveryWithinMonths !== null) chips.push({ label: `Delivery ≤ ${requirements.deliveryWithinMonths}mo` });

  return (
    <div className="mt-3 border-t border-border-row pt-3">
      <div className="mb-1.5 flex items-center gap-2">
        {requirements.summary && <span className="text-[11px] text-body">{requirements.summary}</span>}
        {requirements.intent !== "unknown" && <StatusBadge status={`${titleCase(requirements.intent)} Intent`} />}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <Chip key={c.label} disabled className="cursor-default hover:bg-surface">
            {c.label}
          </Chip>
        ))}
        {chips.length === 0 && <span className="text-[10.5px] text-subtle">No specific criteria were extracted — try adding more detail.</span>}
      </div>
      {requirements.otherPreferences.length > 0 && (
        <div className="mt-1.5 text-[10.5px] text-secondary">Also mentioned: {requirements.otherPreferences.join(" · ")}</div>
      )}
    </div>
  );
}

function SalesBriefView({ leadName, brief }: { leadName: string; brief: LeadIntelligenceBrief }) {
  const [message, setMessage] = useState(brief.suggestedMessage);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setMessage(brief.suggestedMessage);
    setCopied(false);
  }, [brief.suggestedMessage]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser — the text is still
      // selectable/editable in the box either way, so this is non-fatal.
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">Top Matches</div>
        {brief.matches.length === 0 ? (
          <EmptyState icon="unit" title="No available units match yet" description="Present alternative projects or timelines to the client." />
        ) : (
          <div className="flex flex-col gap-2">
            {brief.matches.map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">Recommended Next Action</div>
        <div className="rounded-card border border-primary-border bg-primary-surface-pale px-3 py-2.5">
          <div className="text-[12px] font-semibold text-primary">{brief.nextAction.action}</div>
          <div className="mt-0.5 text-[10.5px] text-secondary">{brief.nextAction.reason}</div>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">
          Explanation
          {!brief.aiGenerated && <span className="rounded-badge bg-surface-track px-1 py-0.5 text-[9px] font-normal text-subtle">AI unavailable — deterministic fallback</span>}
        </div>
        <AiBubble>
          <div className="text-[12px] leading-relaxed text-body">{brief.explanation}</div>
        </AiBubble>
      </div>

      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">Suggested Message to {leadName}</div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="w-full resize-none rounded-btn border border-border bg-surface px-2.5 py-2 text-[11.5px] text-foreground outline-none focus-visible:border-primary"
        />
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[10px] text-subtle">Editable — nothing is ever sent automatically.</span>
          <Button size="sm" variant="secondary" icon={copied ? "check" : "doc"} onClick={handleCopy}>
            {copied ? "Copied" : "Copy message"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MatchRow({ match }: { match: UnitMatchResult }) {
  return (
    <div className="rounded-card border border-border p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] font-semibold text-body">{match.code}</span>
            <span className="text-[11px] text-secondary">{match.projectName}</span>
          </div>
          <div className="mt-0.5 text-[10.5px] text-subtle">
            {match.unitType} · Floor {match.floor} · {match.areaSqm}sqm · {formatEgpExact(match.basePriceEgp)}
          </div>
        </div>
        <div className="flex flex-none items-center gap-1.5">
          <span className="text-[13px] font-semibold text-foreground">{match.score}%</span>
        </div>
      </div>
      <ProgressBar value={match.score} className="mt-2" height={4} />
      {match.reasons.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          {match.reasons.map((r) => (
            <span key={r.key} className={`flex items-center gap-1 text-[10px] ${r.met ? "text-success" : "text-subtle"}`}>
              <Icon name={r.met ? "check" : "close"} size={10} />
              {r.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
