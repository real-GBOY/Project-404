import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { EmptyState } from "@/components/feedback/empty-state";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/time";
import type { ConversationDto } from "../contracts/messaging-types";
import { conversationTitle } from "../lib/conversation-cache";
import { useMessagingState } from "../realtime/messaging-store";

interface Props {
  conversations: ConversationDto[] | undefined;
  loading: boolean;
  activeId: string | undefined;
  meId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}

function previewOf(c: ConversationDto): string {
  const m = c.lastMessage;
  if (!m) return "No messages yet";
  if (m.deletedAt) return "Message deleted";
  if (m.body) return m.body;
  return m.attachments.length ? `📎 ${m.attachments[0]!.fileName}` : "";
}

/** Left rail: the caller's conversations, newest activity first, with unread badges and presence. */
export function ConversationList({ conversations, loading, activeId, meId, onSelect, onNew }: Props) {
  const [q, setQ] = useState("");
  const online = useMessagingState((s) => s.onlineUserIds);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return conversations ?? [];
    return (conversations ?? []).filter((c) => conversationTitle(c, meId).toLowerCase().includes(needle) || previewOf(c).toLowerCase().includes(needle));
  }, [conversations, q, meId]);

  return (
    <aside className="flex w-[300px] flex-none flex-col overflow-hidden border-r border-border-row bg-surface" aria-label="Conversations">
      <div className="flex items-center gap-2 border-b border-border-row p-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations" aria-label="Search conversations" />
        <Button variant="dark" size="sm" onClick={onNew} icon="plus" aria-label="New conversation">
          New
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && <RowsSkeleton rows={6} cols={1} />}
        {!loading && visible.length === 0 && (
          <EmptyState
            icon="message"
            title={q ? "No matches" : "No conversations yet"}
            description={q ? "Try a different search." : "Start one with a teammate, or link it to a lead to get AI insights."}
          />
        )}
        {visible.map((c) => {
          const title = conversationTitle(c, meId);
          const unread = c.me?.unreadCount ?? 0;
          const other = c.type === "direct" ? c.members.find((m) => m.userId !== meId) : undefined;
          const isOnline = other ? online.has(other.userId) : false;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              aria-current={c.id === activeId ? "true" : undefined}
              className={cn(
                "flex w-full items-start gap-2.5 border-b border-border-row px-3 py-2.5 text-start transition-colors hover:bg-primary-surface-pale",
                c.id === activeId && "bg-primary-surface-pale",
              )}
            >
              <span className="relative flex-none">
                <Avatar name={title} size={30} />
                {isOnline && (
                  <span
                    className="absolute -bottom-0.5 -end-0.5 size-2 rounded-full border border-surface bg-success"
                    role="img"
                    aria-label="Online"
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className={cn("truncate text-[12px] text-foreground", unread > 0 ? "font-bold" : "font-semibold")}>{title}</span>
                  <span className="ms-auto flex-none text-[9.5px] text-subtle">
                    {c.lastMessageAt ? timeAgo(c.lastMessageAt) : ""}
                  </span>
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                  <span className={cn("truncate text-[11px]", unread > 0 ? "text-foreground" : "text-secondary")}>{previewOf(c)}</span>
                  {unread > 0 && (
                    <span
                      className="ms-auto flex h-4 min-w-4 flex-none items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground"
                      aria-label={`${unread} unread`}
                    >
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </span>
                {c.subjectType === "lead" && (
                  <span className="mt-1 inline-flex items-center gap-1 text-[9.5px] text-primary">
                    <Icon name="lead" size={10} /> Lead conversation
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
