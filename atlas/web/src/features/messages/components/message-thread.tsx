import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { cn } from "@/lib/cn";
import { ApiError } from "@/config";
import {
  deleteMessage,
  downloadAttachment,
  editMessage,
  reactToMessage,
  unreactToMessage,
  useThread,
} from "@/api/messaging";
import type { ConversationDto, MessageDto } from "../contracts/messaging-types";
import { conversationTitle } from "../lib/conversation-cache";
import { EMPTY_PENDING, type PendingMessage, useMessagingState } from "../realtime/messaging-store";
import { useMessaging } from "../realtime/messaging-provider";
import { Composer } from "./composer";

const NEAR_BOTTOM_PX = 120;
const LOAD_OLDER_AT_PX = 80;

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const dayOf = (iso: string) => new Date(iso).toDateString();

interface Props {
  conversation: ConversationDto;
  meId: string;
}

/**
 * One conversation: its history (newest page first, older pages on scroll-up), live
 * messages from the socket, the user's own not-yet-acknowledged sends, the typing
 * indicator, and the composer. All server data comes from the React Query cache the
 * realtime layer writes into — nothing here fetches on a timer.
 */
export function MessageThread({ conversation, meId }: Props) {
  const messaging = useMessaging();
  const thread = useThread(conversation.id);
  const pending = useMessagingState((s) => s.pending[conversation.id] ?? EMPTY_PENDING);
  const typing = useMessagingState((s) => s.typing[conversation.id]);
  const status = useMessagingState((s) => s.status);

  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const prevHeight = useRef(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageDto | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const names = useMemo(() => new Map(conversation.members.map((m) => [m.userId, m.displayName])), [conversation.members]);
  const messages = useMemo(() => thread.data?.messages ?? [], [thread.data?.messages]);
  const bySeq = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  // Tell the provider which conversation is on screen (read receipts + unread counting).
  useEffect(() => {
    messaging.setActiveConversation(conversation.id);
    setReplyTo(null);
    setEditing(null);
    stickToBottom.current = true;
    return () => messaging.setActiveConversation(null);
  }, [conversation.id, messaging]);

  // Keep the view anchored: follow new messages when the user is at the bottom, and hold position when older history is prepended.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prevHeight.current && !stickToBottom.current) {
      el.scrollTop += el.scrollHeight - prevHeight.current; // history was prepended above
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
    prevHeight.current = 0;
  }, [messages.length, pending.length, typing]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || thread.data?.olderCursor == null) return;
    setLoadingOlder(true);
    prevHeight.current = scroller.current?.scrollHeight ?? 0;
    try {
      await messaging.loadOlder(conversation.id);
    } finally {
      setLoadingOlder(false);
    }
  }, [conversation.id, loadingOlder, messaging, thread.data?.olderCursor]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (el.scrollTop < LOAD_OLDER_AT_PX) void loadOlder();
  }

  // Who has read up to where (by creation `seq`): drives "Seen".
  const readers = useMemo(() => {
    const seqOf = (id: string | null) => (id ? (bySeq.get(id)?.seq ?? 0) : 0);
    return conversation.members
      .filter((m) => m.userId !== meId && !m.leftAt)
      .map((m) => ({ userId: m.userId, name: m.displayName, seq: seqOf(m.lastReadMessageId) }));
  }, [conversation.members, bySeq, meId]);
  const lastMineSeq = useMemo(() => [...messages].reverse().find((m) => m.senderId === meId && !m.deletedAt)?.seq ?? 0, [messages, meId]);

  const typers = Object.keys(typing ?? {})
    .filter((id) => id !== meId)
    .map((id) => names.get(id) ?? "Someone");

  const title = conversationTitle(conversation, meId);
  const archived = conversation.archivedAt !== null;

  if (thread.error) {
    return (
      <div className="flex-1 p-6">
        <ErrorState title="Couldn't load this conversation" message={thread.error instanceof ApiError ? thread.error.message : "The request failed."} />
      </div>
    );
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col" aria-label={`Conversation with ${title}`}>
      <header className="flex items-center gap-2.5 border-b border-border-row bg-surface px-4 py-2.5">
        <Avatar name={title} size={28} />
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-semibold text-foreground">{title}</h2>
          <PresenceLine conversation={conversation} meId={meId} />
        </div>
      </header>

      {status !== "connected" && status !== "idle" && (
        <div role="status" className="flex items-center gap-1.5 border-b border-border-row bg-primary-surface-pale px-4 py-1 text-[10.5px] text-primary">
          <Icon name="clock" size={11} />
          {status === "connecting" ? "Connecting…" : "Reconnecting — new messages will catch up automatically."}
        </div>
      )}

      <div ref={scroller} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-3" data-testid="message-scroller">
        {thread.isLoading && <RowsSkeleton rows={5} cols={1} />}
        {thread.data?.olderCursor != null && (
          <div className="mb-2 text-center">
            <Button variant="ghost" size="sm" onClick={() => void loadOlder()} loading={loadingOlder}>
              Load earlier messages
            </Button>
          </div>
        )}
        {thread.data && messages.length === 0 && pending.length === 0 && (
          <p className="mt-10 text-center text-[12px] text-subtle">No messages yet. Say hello.</p>
        )}

        <ol className="flex flex-col gap-1.5">
          {messages.map((m, i) => {
            const mine = m.senderId === meId;
            const prev = messages[i - 1];
            const newDay = !prev || dayOf(prev.createdAt) !== dayOf(m.createdAt);
            const grouped = !!prev && !newDay && prev.senderId === m.senderId && !prev.deletedAt;
            const seenBy = mine && m.seq === lastMineSeq ? readers.filter((r) => r.seq >= m.seq) : [];
            return (
              <li key={m.id}>
                {newDay && (
                  <div className="my-2 text-center text-[10px] uppercase tracking-[0.08em] text-subtle">
                    {new Date(m.createdAt).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}
                  </div>
                )}
                <MessageRow
                  message={m}
                  mine={mine}
                  senderName={names.get(m.senderId) ?? "Former member"}
                  showSender={!mine && !grouped}
                  parent={m.replyToMessageId ? bySeq.get(m.replyToMessageId) : undefined}
                  parentName={m.replyToMessageId ? names.get(bySeq.get(m.replyToMessageId)?.senderId ?? "") : undefined}
                  meId={meId}
                  editing={editing?.id === m.id ? editing : null}
                  onEditChange={setEditing}
                  onReply={() => setReplyTo(m)}
                  conversationId={conversation.id}
                  archived={archived}
                />
                {seenBy.length > 0 && (
                  <div className="mt-0.5 text-end text-[9.5px] text-subtle" aria-label="Seen">
                    {conversation.type === "direct" ? "Seen" : `Seen by ${seenBy.map((s) => s.name.split(" ")[0]).join(", ")}`}
                  </div>
                )}
              </li>
            );
          })}
          {pending.map((p) => (
            <li key={p.clientMessageId}>
              <PendingRow pending={p} onRetry={() => messaging.retry(conversation.id, p.clientMessageId)} onDiscard={() => messaging.discard(conversation.id, p.clientMessageId)} />
            </li>
          ))}
        </ol>

        <div className="mt-1 h-4 text-[10.5px] italic text-subtle" aria-live="polite">
          {typers.length > 0 && `${typers.join(", ")} ${typers.length > 1 ? "are" : "is"} typing…`}
        </div>
      </div>

      <Composer
        conversationId={conversation.id}
        disabled={archived}
        replyTo={replyTo}
        replyToName={replyTo ? (names.get(replyTo.senderId) ?? null) : null}
        onClearReply={() => setReplyTo(null)}
      />
    </section>
  );
}

function PresenceLine({ conversation, meId }: Props) {
  const online = useMessagingState((s) => s.onlineUserIds);
  const active = conversation.members.filter((m) => !m.leftAt);
  if (conversation.type === "direct") {
    const other = active.find((m) => m.userId !== meId);
    const isOn = other ? online.has(other.userId) : false;
    return (
      <p className="flex items-center gap-1 text-[10.5px] text-secondary">
        <span className={cn("size-1.5 rounded-full", isOn ? "bg-success" : "bg-faint")} aria-hidden="true" />
        {isOn ? "Online" : "Offline"}
      </p>
    );
  }
  const onlineCount = active.filter((m) => online.has(m.userId)).length;
  return (
    <p className="text-[10.5px] text-secondary">
      {active.length} members · {onlineCount} online
    </p>
  );
}

function PendingRow({ pending, onRetry, onDiscard }: { pending: PendingMessage; onRetry: () => void; onDiscard: () => void }) {
  return (
    <div className="flex justify-end">
      <div className={cn("max-w-[78%] rounded-chat px-3 py-2 text-[12.5px]", pending.status === "failed" ? "border border-danger-border bg-danger-surface text-danger" : "bg-foreground/70 text-white")}>
        {pending.body && <p className="whitespace-pre-wrap break-words">{pending.body}</p>}
        {pending.attachmentNames.map((n) => (
          <p key={n} className="text-[10.5px] opacity-80">📎 {n}</p>
        ))}
        <p className="mt-0.5 flex items-center gap-2 text-[9.5px] opacity-80">
          {pending.status === "sending" ? "Sending…" : (pending.error ?? "Not sent")}
          {pending.status === "failed" && (
            <>
              <button type="button" className="underline" onClick={onRetry}>Retry</button>
              <button type="button" className="underline" onClick={onDiscard}>Discard</button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function MessageRow(props: {
  message: MessageDto;
  mine: boolean;
  senderName: string;
  showSender: boolean;
  parent: MessageDto | undefined;
  parentName: string | undefined;
  meId: string;
  editing: { id: string; text: string } | null;
  onEditChange: (e: { id: string; text: string } | null) => void;
  onReply: () => void;
  conversationId: string;
  archived: boolean;
}) {
  const { message: m, mine, conversationId } = props;
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work.");
    }
  };

  if (m.deletedAt) {
    return (
      <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
        <p className="rounded-chat border border-dashed border-border px-3 py-1.5 text-[11px] italic text-subtle">Message deleted</p>
      </div>
    );
  }

  const myReactions = new Set(m.reactions.filter((r) => r.userIds.includes(props.meId)).map((r) => r.emoji));

  return (
    <div className={cn("group flex items-end gap-2", mine ? "flex-row-reverse" : "flex-row")}>
      <div className={cn("flex max-w-[78%] flex-col", mine ? "items-end" : "items-start")}>
        {props.showSender && <span className="mb-0.5 text-[10px] font-semibold text-secondary">{props.senderName}</span>}
        <div className={cn("rounded-chat px-3 py-2 text-[12.5px]", mine ? "bg-foreground text-white" : "border border-border bg-surface text-foreground")}>
          {m.replyToMessageId && (
            <p className={cn("mb-1 border-s-2 ps-2 text-[10.5px]", mine ? "border-white/50 text-white/80" : "border-primary text-secondary")}>
              {props.parent ? (
                <>
                  <strong>{props.parentName ?? "Message"}</strong>: {props.parent.deletedAt ? "deleted" : props.parent.body || "attachment"}
                </>
              ) : (
                "Earlier message"
              )}
            </p>
          )}
          {props.editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await editMessage(conversationId, m.id, props.editing!.text);
                  props.onEditChange(null);
                });
              }}
            >
              <textarea
                ref={(el) => el?.focus()}
                aria-label="Edit message"
                value={props.editing.text}
                onChange={(e) => props.onEditChange({ id: m.id, text: e.target.value })}
                className="w-full min-w-48 resize-none rounded-sm bg-white p-1 text-[12px] text-foreground outline-none"
              />
              <div className="mt-1 flex gap-2 text-[10px]">
                <button type="submit" className="underline">Save</button>
                <button type="button" className="underline" onClick={() => props.onEditChange(null)}>Cancel</button>
              </div>
            </form>
          ) : (
            m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>
          )}
          {m.attachments.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => void run(() => downloadAttachment(conversationId, a))}
              className={cn("mt-1 flex items-center gap-1.5 rounded-sm border px-1.5 py-1 text-[10.5px]", mine ? "border-white/30 hover:bg-white/10" : "border-border hover:bg-surface-subtle")}
            >
              <Icon name="doc" size={11} />
              <span className="truncate">{a.fileName}</span>
              <span className="opacity-70">{Math.max(1, Math.round(a.byteSize / 1024))} KB</span>
            </button>
          ))}
        </div>

        {m.reactions.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {m.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                aria-pressed={myReactions.has(r.emoji)}
                onClick={() => void run(() => (myReactions.has(r.emoji) ? unreactToMessage(conversationId, m.id, r.emoji) : reactToMessage(conversationId, m.id, r.emoji)))}
                className={cn("rounded-pill border px-1.5 text-[10.5px]", myReactions.has(r.emoji) ? "border-primary bg-primary-surface-pale" : "border-border bg-surface")}
              >
                {r.emoji} {r.userIds.length}
              </button>
            ))}
          </div>
        )}
        <span className="mt-0.5 text-[9.5px] text-subtle">
          {timeOf(m.createdAt)}
          {m.editedAt && " · edited"}
        </span>
        {error && <span role="alert" className="text-[10px] text-danger">{error}</span>}
      </div>

      {!props.editing && !props.archived && (
        <div className="mb-4 flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button type="button" aria-label="React 👍" className="px-1 text-[12px]" onClick={() => void run(() => (myReactions.has("👍") ? unreactToMessage(conversationId, m.id, "👍") : reactToMessage(conversationId, m.id, "👍")))}>👍</button>
          <button type="button" aria-label="Reply" className="px-1 text-subtle hover:text-foreground" onClick={props.onReply}><Icon name="arrow-right" size={12} /></button>
          {mine && (
            <>
              <button type="button" aria-label="Edit message" className="px-1 text-subtle hover:text-foreground" onClick={() => props.onEditChange({ id: m.id, text: m.body })}><Icon name="edit" size={12} /></button>
              <button type="button" aria-label="Delete message" className="px-1 text-subtle hover:text-danger" onClick={() => void run(() => deleteMessage(conversationId, m.id))}><Icon name="trash" size={12} /></button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
