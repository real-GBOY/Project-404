import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { AiBubble, ActionBubble, CitationChip, FollowUpPill, UserBubble } from "@/components/domain/chat-bubble";
import { ApiError } from "@/lib/api/client";
import { useConversations, useMessages, useCopilotSuggestions, useAsk, type MessageRow } from "@/api/ai";

/**
 * `isCopilot` screen — its own 230px history rail + chat pane, not the
 * standard `PageContainer`/`PageHeader` shell. Backed by the real assistant
 * module (`/api/realestate/copilot/*`) — a server-side keyword-matched
 * canned-answer stub, no LLM (see `assistant.domain.ts`).
 */
export function CopilotPage() {
  const conversations = useConversations();
  const suggestions = useCopilotSuggestions();
  const ask = useAsk();
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const messages = useMessages(activeId);

  function handleAsk(question: string) {
    const text = question.trim();
    if (!text) return;
    setInput("");
    ask.mutate(
      { conversationId: activeId, question: text },
      { onSuccess: (data) => setActiveId(data.conversationId) },
    );
  }

  if (conversations.error) {
    return (
      <div className="p-6">
        <ErrorState title="Couldn't load Copilot" message={conversations.error instanceof ApiError ? conversations.error.message : "The request failed."} />
      </div>
    );
  }

  const chat: MessageRow[] = messages.data ?? [];

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-[230px] flex-none flex-col overflow-hidden border-r border-border-row bg-surface">
        <div className="border-b border-border-row p-3">
          <Button variant="dark" size="sm" className="w-full" onClick={() => setActiveId(undefined)}>
            + New conversation
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto py-1.5">
          {conversations.isLoading ? (
            <RowsSkeleton rows={4} cols={1} />
          ) : (
            (conversations.data ?? []).map((c) => (
              <div
                key={c.id}
                onClick={() => setActiveId(c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveId(c.id);
                  }
                }}
                role="button"
                tabIndex={0}
                className={`cursor-pointer truncate px-3 py-1.5 text-[11px] hover:bg-primary-surface-pale hover:text-primary ${c.id === activeId ? "bg-primary-surface-pale text-primary" : "text-body"}`}
              >
                {c.title}
              </div>
            ))
          )}
        </div>
        <div className="border-t border-border-row p-3 text-[10px] leading-relaxed text-subtle">
          Copilot reads live Atlas data through controlled tools and respects your role permissions. Actions always
          require approval.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-5 pb-2.5 pt-4">
          <div className="mx-auto flex max-w-[760px] flex-col gap-4">
            {activeId && messages.isLoading && <RowsSkeleton rows={3} cols={1} />}
            {!activeId && chat.length === 0 && (
              <div className="mt-10 text-center text-[12px] text-subtle">Ask a question below to start a conversation.</div>
            )}
            {chat.map((turn) =>
              turn.role === "user" ? (
                <UserBubble key={turn.id} text={turn.text} />
              ) : turn.isAction ? (
                <ActionBubble key={turn.id} text={turn.text} detail={turn.detail ?? undefined} recommend={turn.recommend ?? undefined} cites={turn.cites ?? undefined} onAct={() => {}} onDismiss={() => {}} />
              ) : (
                <AiBubble key={turn.id}>
                  <div className="text-pretty text-[12.5px] leading-relaxed">{turn.text}</div>

                  {turn.stats && turn.stats.length > 0 && (
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-px overflow-hidden rounded-card border border-border bg-border">
                      {turn.stats.map((s) => (
                        <div key={s.label} className="bg-surface px-2.5 py-2">
                          <div className="truncate text-[9px] font-semibold uppercase tracking-[0.09em] text-muted">{s.label}</div>
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
                        <div key={r.name} className="grid grid-cols-[1.6fr_1fr_1fr] items-center gap-2.5 border-b border-border-row bg-surface px-2.5 py-1.5 last:border-b-0">
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
                        <FollowUpPill key={f} label={f} onClick={() => handleAsk(f)} />
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
              {(suggestions.data ?? []).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleAsk(s)}
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
                  if (e.key === "Enter") handleAsk(input);
                }}
                placeholder="Ask about sales, inventory, leads, collections or a specific customer…"
                className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-placeholder"
              />
              <span className="flex-none text-[10px] text-subtle">Role-scoped</span>
              <Button size="sm" loading={ask.isPending} onClick={() => handleAsk(input)}>
                Ask
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
