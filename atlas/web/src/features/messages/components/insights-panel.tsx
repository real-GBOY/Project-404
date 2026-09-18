import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/feedback/skeleton";
import { useToast } from "@/lib/toast/toast-provider";
import { timeAgo } from "@/lib/time";
import { ApiError } from "@/config";
import { useApplyRequirements, useCreateFollowup, useInsights, useRefreshInsights } from "@/api/messaging";
import type { ConversationDto } from "../contracts/messaging-types";
import type { ConversationInsightsDto, InsightActionItem } from "../contracts/insights-types";
import { requirementLines } from "../lib/requirements";

const OWNER_LABEL = { agent: "Agent", customer: "Customer", unknown: "—" } as const;

function StatusPill({ insights, refreshing }: { insights: ConversationInsightsDto; refreshing: boolean }) {
  if (refreshing || insights.status === "running") return <Pill tone="info" dot>Analysing…</Pill>;
  if (insights.status === "failed") return <Pill tone="danger">Analysis failed</Pill>;
  if (insights.version === 0) return <Pill tone="muted">Not analysed yet</Pill>;
  if (insights.stale) return <Pill tone="warning">Updating soon</Pill>;
  return <Pill tone="success">{insights.analyzedAt ? `Updated ${timeAgo(insights.analyzedAt)}` : "Up to date"}</Pill>;
}

/**
 * The AI panel. Everything here is a SUGGESTION: it fills in when the asynchronous
 * analysis lands (pushed over the socket — no polling) and never changes CRM data
 * on its own. "Apply to lead" and "Create follow-up" are explicit, permissioned
 * actions the agent chooses to take.
 */
export function InsightsPanel({ conversation }: { conversation: ConversationDto }) {
  const insights = useInsights(conversation.id);
  const refresh = useRefreshInsights(conversation.id);
  const apply = useApplyRequirements(conversation.id);
  const toast = useToast();
  const [followup, setFollowup] = useState<InsightActionItem | null>(null);
  const leadId = conversation.subjectType === "lead" ? conversation.subjectId : null;

  const data = insights.data;
  const error = insights.error instanceof ApiError ? insights.error : null;

  function onApply() {
    apply.mutate(undefined, {
      onSuccess: () => toast.push({ kind: "success", title: "Requirements applied to the lead" }),
      onError: (e) => toast.push({ kind: "danger", title: "Couldn't apply", body: e instanceof ApiError ? e.message : undefined }),
    });
  }

  return (
    <aside className="hidden w-[320px] flex-none flex-col overflow-y-auto border-s border-border-row bg-surface xl:flex" aria-label="AI conversation insights">
      <header className="flex items-center gap-2 border-b border-border-row px-3 py-2.5">
        <span className="flex size-6 flex-none items-center justify-center rounded-sm bg-primary-surface text-primary">
          <Icon name="spark" size={13} />
        </span>
        <h2 className="text-[12px] font-semibold text-foreground">AI Conversation Insights</h2>
        <Button
          variant="ghost"
          size="sm"
          className="ms-auto"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending || data?.status === "running"}
          aria-label="Re-analyse conversation"
        >
          <Icon name="history" size={12} />
        </Button>
      </header>

      <div className="flex flex-col gap-4 p-3 text-[11.5px]">
        {insights.isLoading && (
          <div className="flex flex-col gap-2" role="status" aria-label="Loading insights">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        )}

        {error && (
          <p className="text-secondary">
            {error.status === 403 ? "You don't have access to AI insights." : "Couldn't load insights."}
          </p>
        )}

        {data && (
          <>
            <StatusPill insights={data} refreshing={refresh.isPending} />
            {data.status === "failed" && <p className="text-danger">The last analysis didn't complete. Earlier insights are kept. Try re-analysing.</p>}

            {data.version === 0 ? (
              <p className="leading-relaxed text-secondary">
                {data.status === "running"
                  ? "Reading the conversation…"
                  : "Insights appear here once the AI has read the conversation — usually seconds after a message. Use the button above to analyse it now."}
              </p>
            ) : (
              <>
                <Section title="Summary">
                  <p className="leading-relaxed text-foreground">{data.summary || "—"}</p>
                </Section>

                {data.requirements && requirementLines(data.requirements).length > 0 && (
                  <Section title="Key Requirements">
                    <ul className="list-disc space-y-0.5 ps-4 text-foreground">
                      {requirementLines(data.requirements).map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                    <div className="mt-2">
                      {leadId ? (
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="secondary" onClick={onApply} loading={apply.isPending} icon="check">
                            Apply to Lead
                          </Button>
                          <Link className="text-[10.5px] text-primary hover:underline" to={`/leads/${leadId}`}>View lead</Link>
                        </div>
                      ) : (
                        <p className="text-[10.5px] text-subtle">Link this conversation to a lead to apply these to its profile.</p>
                      )}
                    </div>
                  </Section>
                )}

                {data.keyFacts.length > 0 && (
                  <Section title="Key Facts">
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                      {data.keyFacts.map((f) => (
                        <div key={`${f.label}-${f.value}`} className="contents">
                          <dt className="text-secondary">{f.label}</dt>
                          <dd className="text-foreground">{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </Section>
                )}

                {data.actionItems.length > 0 && (
                  <Section title="Action Items">
                    <ul className="space-y-1.5">
                      {data.actionItems.map((a) => (
                        <li key={a.action} className="flex items-start gap-1.5">
                          <span className="mt-0.5 text-primary">•</span>
                          <span className="min-w-0 flex-1 text-foreground">
                            {a.action}
                            <span className="ms-1 text-[10px] text-subtle">
                              {OWNER_LABEL[a.owner]}
                              {a.due ? ` · ${a.due}` : ""}
                            </span>
                          </span>
                          {leadId && (
                            <button type="button" className="flex-none text-[10px] text-primary hover:underline" onClick={() => setFollowup(a)}>
                              Follow-up
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {data.unresolvedQuestions.length > 0 && (
                  <Section title="Open Questions">
                    <ul className="list-disc space-y-0.5 ps-4 text-foreground">
                      {data.unresolvedQuestions.map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ul>
                  </Section>
                )}
              </>
            )}
            <p className="text-[9.5px] leading-relaxed text-subtle">AI-generated from this conversation. Review before acting — nothing is changed until you apply it.</p>
          </>
        )}
      </div>

      {followup && <FollowupModal conversationId={conversation.id} leadId={leadId!} item={followup} onClose={() => setFollowup(null)} />}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-subtle">{title}</h3>
      {children}
    </section>
  );
}

/** Default due: tomorrow 09:00 local — the agent adjusts it; the AI's free-text "tonight" is shown but never trusted. */
function defaultDue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function FollowupModal({ conversationId, leadId, item, onClose }: { conversationId: string; leadId: string; item: InsightActionItem; onClose: () => void }) {
  const create = useCreateFollowup(conversationId);
  const toast = useToast();
  const [reason, setReason] = useState(item.action);
  const [due, setDue] = useState(defaultDue);
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");

  function submit() {
    create.mutate(
      { leadId, reason, dueAt: new Date(due).toISOString(), priority },
      {
        onSuccess: () => {
          toast.push({ kind: "success", title: "Follow-up created" });
          onClose();
        },
        onError: (e) => toast.push({ kind: "danger", title: "Couldn't create follow-up", body: e instanceof ApiError ? e.message : undefined }),
      },
    );
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Create follow-up"
      description={item.due ? `The conversation says: "${item.due}". Pick the actual date.` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={create.isPending} disabled={!reason.trim() || !due}>Create</Button>
        </>
      }
    >
      <div className="mt-3 flex flex-col gap-2.5 text-[11.5px]">
        <label className="flex flex-col gap-1">
          Reason
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="h-8 rounded-btn border border-border px-2.5 outline-none focus-visible:border-primary" />
        </label>
        <label className="flex flex-col gap-1">
          Due
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="h-8 rounded-btn border border-border px-2.5 outline-none focus-visible:border-primary" />
        </label>
        <label className="flex flex-col gap-1">
          Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className="h-8 rounded-btn border border-border bg-surface px-2 outline-none focus-visible:border-primary">
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
      </div>
    </Modal>
  );
}
