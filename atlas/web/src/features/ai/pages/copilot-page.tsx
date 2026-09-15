import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { AiBubble, UserBubble, FollowUpPill, ToolActivityRow } from "@/components/domain/chat-bubble";
import { ApiError } from "@/config";
import { useConversations, useConversation, useAsk } from "@/api/ai";

const SUGGESTIONS = [
  "Which projects have the highest sales velocity?",
  "Show me the units most likely to sell soon.",
  "Which high-value leads haven't been contacted recently?",
  "How much revenue is currently outstanding?",
  "Summarise a customer's history.",
];

/**
 * `isCopilot` screen — its own 230px history rail + chat pane, not the
 * standard `PageContainer`/`PageHeader` shell. Backed by the real Atlas
 * Copilot: a Groq-hosted LLM orchestrating tool calls over the existing
 * real-estate use cases (`/api/realestate/copilot/ask`). See
 * docs/atlas-assistant.md.
 */
export function CopilotPage() {
  const conversations = useConversations();
  const ask = useAsk();
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [lastActivity, setLastActivity] = useState<Record<string, { name: string; ok: boolean }[]>>({});
  const [lastQuestion, setLastQuestion] = useState("");
  const conversation = useConversation(activeId);

  function handleAsk(question: string) {
    const text = question.trim();
    if (!text) return;
    setInput("");
    setLastQuestion(text);
    ask.mutate(
      { conversationId: activeId, question: text },
      {
        onSuccess: (data) => {
          setActiveId(data.conversationId);
          setLastActivity((prev) => ({ ...prev, [data.conversationId]: data.toolActivity }));
        },
      },
    );
  }

  if (conversations.error) {
    return (
      <div className="p-6">
        <ErrorState title="Couldn't load Copilot" message={conversations.error instanceof ApiError ? conversations.error.message : "The request failed."} />
      </div>
    );
  }

  const turns = conversation.data?.messages ?? [];
  const activity = activeId ? (lastActivity[activeId] ?? []) : [];

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
                {c.title ?? "New conversation"}
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
            {activeId && conversation.isLoading && <RowsSkeleton rows={3} cols={1} />}
            {!activeId && turns.length === 0 && (
              <div className="mt-10 text-center text-[12px] text-subtle">Ask a question below to start a conversation.</div>
            )}
            {conversation.error && (
              <ErrorState
                title="Couldn't load this conversation"
                message={conversation.error instanceof ApiError ? conversation.error.message : "The request failed."}
              />
            )}
            {turns.map((turn, i) =>
              turn.role === "user" ? (
                <UserBubble key={i} text={turn.content} />
              ) : (
                <AiBubble key={i}>
                  <div className="text-pretty text-[12.5px] leading-relaxed">{turn.content}</div>
                  {i === turns.length - 1 && <ToolActivityRow items={activity} />}
                </AiBubble>
              ),
            )}
            {ask.isPending && (
              <AiBubble>
                <div className="flex items-center gap-1.5 text-[11px] text-subtle">
                  <Icon name="spark" size={12} className="animate-pulse text-primary" />
                  Thinking…
                </div>
              </AiBubble>
            )}
            {ask.isError && (
              <ErrorState
                title="Couldn't get a response"
                message={ask.error instanceof ApiError ? ask.error.message : "The request failed."}
                onRetry={() => handleAsk(lastQuestion)}
              />
            )}
          </div>
        </div>

        <div className="flex-none border-t border-border bg-surface px-5 py-3">
          <div className="mx-auto max-w-[760px]">
            {turns.length === 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <FollowUpPill key={s} label={s} onClick={() => handleAsk(s)} />
                ))}
              </div>
            )}
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
