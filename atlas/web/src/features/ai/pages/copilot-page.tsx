import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { AiBubble, ActionBubble, CitationChip, FollowUpPill, UserBubble } from "@/components/domain/chat-bubble";
import { useConfirm } from "@/lib/confirm/confirm-provider";
import { useToast } from "@/lib/toast/toast-provider";
import {
  COPILOT_CANNED_ANSWERS,
  COPILOT_HISTORY,
  COPILOT_INITIAL_TRANSCRIPT,
  COPILOT_SUGGESTIONS,
  type ChatTurnFixture,
} from "@/mocks/fixtures/copilot-transcripts";

/** Keyword routing for `ask(q)`, verbatim from the design's canned-answer lookup. */
function matchCannedAnswer(question: string): keyof typeof COPILOT_CANNED_ANSWERS {
  const q = question.toLowerCase();
  if (q.includes("velocit")) return "velocity";
  if (q.includes("outstand") || q.includes("revenue")) return "outstanding";
  if (q.includes("agent") || q.includes("underperf")) return "underperforming";
  if (q.includes("likely") || q.includes("unit")) return "likely";
  if (q.includes("summar") || q.includes("histor")) return "summar";
  return "velocity";
}

/**
 * `isCopilot` screen (PLAN §3.14) — its own 230px history rail + chat pane, not the
 * standard `PageContainer`/`PageHeader` shell (the design gives Copilot no page title).
 * Seeded from `COPILOT_INITIAL_TRANSCRIPT`; new questions are answered by keyword-matching
 * against `COPILOT_CANNED_ANSWERS`, same as the prototype's `ask(q)`.
 */
export function CopilotPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const [chat, setChat] = useState<ChatTurnFixture[]>(COPILOT_INITIAL_TRANSCRIPT);
  const [input, setInput] = useState("");

  function ask(question: string) {
    const text = question.trim();
    if (!text) return;
    const answer = COPILOT_CANNED_ANSWERS[matchCannedAnswer(text)];
    setChat((prev) => [
      ...prev,
      { role: "user", text },
      { role: "ai", text: answer.text, stats: answer.stats, rows: answer.rows, cites: answer.cites, follow: answer.follow },
    ]);
    setInput("");
  }

  async function handleAction(turn: ChatTurnFixture) {
    const ok = await confirm({
      title: "Create 23 follow-up tasks?",
      body: "One follow-up task per dormant lead, assigned to the current owner and due within 24 hours. Nine leads with overloaded agents are queued for reassignment review instead. Recorded in the audit log.",
      cta: "Create tasks",
    });
    if (ok) {
      toast.push({ kind: "success", title: "23 follow-up tasks created", body: "Assigned to owning agents." });
      setChat((prev) => prev.filter((t) => t !== turn));
    }
  }

  async function handleNewConversation() {
    const ok = await confirm({
      title: "Start a new conversation?",
      body: "This is a mock action — no backend is connected yet. The current thread will be cleared.",
      cta: "Start new",
    });
    if (ok) setChat([]);
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-[230px] flex-none flex-col overflow-hidden border-r border-border-row bg-surface">
        <div className="border-b border-border-row p-3">
          <Button variant="dark" size="sm" className="w-full" onClick={handleNewConversation}>
            + New conversation
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto py-1.5">
          {COPILOT_HISTORY.map((group) => (
            <div key={group.label}>
              <div className="px-3 pb-0.5 pt-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-subtle">
                {group.label}
              </div>
              {group.items.map((item) => (
                <div
                  key={item}
                  className="cursor-pointer truncate px-3 py-1.5 text-[11px] text-body hover:bg-primary-surface-pale hover:text-primary"
                >
                  {item}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-border-row p-3 text-[10px] leading-relaxed text-subtle">
          Copilot reads live Atlas data through controlled tools and respects your role permissions. Actions always
          require approval.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-5 pb-2.5 pt-4">
          <div className="mx-auto flex max-w-[760px] flex-col gap-4">
            {chat.map((turn, i) =>
              turn.role === "user" ? (
                <UserBubble key={i} text={turn.text} />
              ) : turn.isAction ? (
                <ActionBubble
                  key={i}
                  text={turn.text}
                  detail={turn.detail}
                  recommend={turn.recommend}
                  cites={turn.cites}
                  onAct={() => handleAction(turn)}
                  onDismiss={() => setChat((prev) => prev.filter((t) => t !== turn))}
                />
              ) : (
                <AiBubble key={i}>
                  <div className="text-pretty text-[12.5px] leading-relaxed">{turn.text}</div>

                  {turn.stats && turn.stats.length > 0 && (
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-px overflow-hidden rounded-card border border-border bg-border">
                      {turn.stats.map((s) => (
                        <div key={s.label} className="bg-surface px-2.5 py-2">
                          <div className="truncate text-[9px] font-semibold uppercase tracking-[0.09em] text-muted">
                            {s.label}
                          </div>
                          <div className="mt-1 flex items-baseline gap-1.5">
                            <span className="whitespace-nowrap text-[14px] font-semibold">{s.value}</span>
                            {s.delta && <span className="text-[10px] font-semibold text-success">{s.delta}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {turn.rows && turn.rows.length > 0 && (
                    <div className="overflow-hidden rounded-card border border-border">
                      {turn.rows.map((r) => (
                        <div
                          key={r.name}
                          className="grid grid-cols-[1.6fr_1fr_1fr] items-center gap-2.5 border-b border-border-row bg-surface px-2.5 py-1.5 last:border-b-0"
                        >
                          <div className="min-w-0 truncate text-[11px] font-medium">{r.name}</div>
                          <div className="text-right font-mono text-[11px]">{r.value}</div>
                          <div className="text-right text-[10.5px] text-subtle">{r.meta}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {turn.cites && turn.cites.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[9.5px] uppercase tracking-[0.07em] text-subtle">Sources</span>
                      {turn.cites.map((c) => (
                        <CitationChip key={c} label={c} />
                      ))}
                    </div>
                  )}

                  {turn.follow && turn.follow.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {turn.follow.map((f) => (
                        <FollowUpPill key={f} label={f} onClick={() => ask(f)} />
                      ))}
                    </div>
                  )}
                </AiBubble>
              ),
            )}
          </div>
        </div>

        <div className="flex-none border-t border-border bg-surface px-5 py-3">
          <div className="mx-auto max-w-[760px]">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {COPILOT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-pill border border-border bg-canvas px-2.5 py-1 text-[10.5px] text-body transition-colors hover:border-primary hover:bg-surface hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-btn border border-border-elevated px-2.5 py-2">
              <Icon name="spark" size={14} className="flex-none text-primary" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") ask(input);
                }}
                placeholder="Ask about sales, inventory, leads, collections or a specific customer…"
                className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-placeholder"
              />
              <span className="flex-none text-[10px] text-subtle">Role-scoped</span>
              <Button size="sm" onClick={() => ask(input)}>
                Ask
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
