import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL, ApiError, ensureFreshAccessToken } from "@/config";
import { useAuth } from "@/features/auth/auth-provider";
import { fetchHistory, fetchSync, messagingKeys, type UploadedAttachment } from "@/api/messaging";
import type { ConversationDto, MessageDto, Page } from "@auric/contracts/messaging";
import {
  type ConversationCreatedPayload,
  type ConversationMemberAddedPayload,
  type ConversationMemberRemovedPayload,
  type ConversationReadPayload,
  type ConversationUpdatedPayload,
  type MessageCreatedPayload,
  type MessageDeletedPayload,
  MessagingCommand,
  MessagingEvent,
  type MessageUpdatedPayload,
  type PresenceUpdatePayload,
  type TypingPayload,
} from "@auric/contracts/messaging";
import { ATLAS_CONVERSATION_AI_UPDATED, type ConversationAiUpdatedPayload, type ConversationInsightsDto } from "@atlas-contracts/insights";
import {
  applyMessageToInbox,
  applyReadToInbox,
  clearUnread,
  removeConversation,
  setMembers,
  upsertConversation,
} from "../lib/conversation-cache";
import { applyDeletion, prependHistory, resyncThread, upsertMessage, type ThreadCache } from "../lib/thread-cache";
import { messagingStore, type PendingMessage } from "./messaging-store";
import { RealtimeClient } from "./realtime-client";

export interface SendInput {
  body: string;
  attachments?: UploadedAttachment[];
  replyToMessageId?: string | null;
}

interface MessagingApi {
  /** Optimistic send: appears at once as "sending", reconciled when the server acks/broadcasts. */
  send(conversationId: string, input: SendInput): void;
  retry(conversationId: string, clientMessageId: string): void;
  discard(conversationId: string, clientMessageId: string): void;
  /** The conversation currently on screen (drives read receipts + unread counting). */
  setActiveConversation(conversationId: string | null): void;
  markRead(conversationId: string): void;
  /** Typing — throttled here, debounced to a stop; never persisted. */
  typing(conversationId: string, isTyping: boolean): void;
  loadOlder(conversationId: string): Promise<void>;
}

const MessagingContext = createContext<MessagingApi | null>(null);

/** The socket lives on the API's origin (which may differ from the SPA's, e.g. Vercel → VPS). */
function socketUrl(): string {
  return /^https?:\/\//i.test(API_BASE_URL) ? new URL(API_BASE_URL).origin : window.location.origin;
}

const TYPING_SEND_INTERVAL_MS = 2_000;
const TYPING_IDLE_MS = 3_000;
const READ_DEBOUNCE_MS = 350;

/**
 * Owns the realtime connection and keeps the React Query cache in step with it.
 *
 * Data flow: socket event → pure patch (`thread-cache` / `conversation-cache`) →
 * `queryClient.setQueryData` → components re-render. There is no polling and no
 * refetch-on-interval anywhere: a `MessageCreated` event IS the update.
 *
 * Trust model on reconnect: Socket.IO reconnecting only restores the transport, so
 * on every `realtime:ready` we reconcile through REST — for each thread we hold,
 * page `sync` from its last `changeSeq` cursor, then refetch the inbox — before
 * relying on live events again. Unacknowledged sends are re-sent with their original
 * `clientMessageId`; the server's unique index makes a replay a no-op.
 */
export function MessagingProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, user } = useAuth();
  const qc = useQueryClient();
  const meId = user?.id ?? null;

  const clientRef = useRef<RealtimeClient | null>(null);
  const activeRef = useRef<string | null>(null);
  const meRef = useRef<string | null>(meId);
  meRef.current = meId;
  const typingRef = useRef(new Map<string, { lastSent: number; idle?: ReturnType<typeof setTimeout> }>());
  const readTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // ── cache writers ──────────────────────────────────────────────────────────
  const patchInbox = useCallback(
    (fn: (inbox: Page<ConversationDto> | undefined) => Page<ConversationDto> | undefined) =>
      qc.setQueryData<Page<ConversationDto>>(messagingKeys.conversations, (cur) => fn(cur)),
    [qc],
  );
  const patchThread = useCallback(
    (conversationId: string, fn: (t: ThreadCache) => ThreadCache) =>
      // A thread nobody has opened is not cached — it will be fetched fresh when opened.
      qc.setQueryData<ThreadCache>(messagingKeys.thread(conversationId), (cur) => (cur ? fn(cur) : cur)),
    [qc],
  );

  const isViewing = (conversationId: string) =>
    activeRef.current === conversationId && document.visibilityState === "visible";

  // ── read receipts ──────────────────────────────────────────────────────────
  const markRead = useCallback(
    (conversationId: string) => {
      patchInbox((inbox) => clearUnread(inbox, conversationId)); // optimistic
      clearTimeout(readTimers.current.get(conversationId));
      readTimers.current.set(
        conversationId,
        setTimeout(() => {
          readTimers.current.delete(conversationId);
          clientRef.current?.command(MessagingCommand.ConversationRead, { conversationId }).catch(() => {
            /* offline: the read cursor is re-sent the next time the conversation is viewed */
          });
        }, READ_DEBOUNCE_MS),
      );
    },
    [patchInbox],
  );

  // ── sending ────────────────────────────────────────────────────────────────
  const transmit = useCallback(
    async (p: PendingMessage) => {
      const client = clientRef.current;
      if (!client) return;
      try {
        const ack = await client.command(MessagingCommand.MessageCreate, {
          conversationId: p.conversationId,
          body: p.body,
          clientMessageId: p.clientMessageId,
          ...(p.attachmentFileIds.length ? { attachmentFileIds: p.attachmentFileIds } : {}),
          ...(p.replyToMessageId ? { replyToMessageId: p.replyToMessageId } : {}),
        });
        if (ack.ok) {
          const { message } = ack.data;
          patchThread(p.conversationId, (t) => upsertMessage(t, message));
          patchInbox((inbox) => applyMessageToInbox(inbox, message, false));
          messagingStore.removePending(p.conversationId, p.clientMessageId);
        } else {
          messagingStore.updatePending(p.conversationId, p.clientMessageId, { status: "failed", error: ack.error.message });
        }
      } catch {
        // Offline: stay "sending" - it is re-sent on reconnect. Connected but no ack in time: surface it
        // with a Retry instead of spinning forever. Either way the retry is safe, because the server
        // dedupes on clientMessageId (a send that DID land is simply acknowledged again).
        if (messagingStore.getState().status === "connected") {
          messagingStore.updatePending(p.conversationId, p.clientMessageId, {
            status: "failed",
            error: "No response from the server.",
          });
        }
      }
    },
    [patchInbox, patchThread],
  );

  const api = useMemo<MessagingApi>(
    () => ({
      send(conversationId, input) {
        const pending: PendingMessage = {
          clientMessageId: crypto.randomUUID(),
          conversationId,
          body: input.body.trim(),
          attachmentFileIds: (input.attachments ?? []).map((a) => a.fileId),
          attachmentNames: (input.attachments ?? []).map((a) => a.fileName),
          replyToMessageId: input.replyToMessageId ?? null,
          createdAt: new Date().toISOString(),
          status: "sending",
        };
        messagingStore.addPending(pending);
        void transmit(pending);
      },
      retry(conversationId, clientMessageId) {
        const p = messagingStore.getState().pending[conversationId]?.find((x) => x.clientMessageId === clientMessageId);
        if (!p) return;
        messagingStore.updatePending(conversationId, clientMessageId, { status: "sending" });
        void transmit({ ...p, status: "sending" });
      },
      discard: (conversationId, clientMessageId) => messagingStore.removePending(conversationId, clientMessageId),
      setActiveConversation(conversationId) {
        activeRef.current = conversationId;
        if (conversationId) markRead(conversationId);
      },
      markRead,
      typing(conversationId, isTyping) {
        const client = clientRef.current;
        const state = typingRef.current.get(conversationId) ?? { lastSent: 0 };
        if (state.idle) clearTimeout(state.idle);
        if (!isTyping) {
          if (state.lastSent) client?.emitEphemeral(MessagingCommand.TypingStop, { conversationId });
          typingRef.current.set(conversationId, { lastSent: 0 });
          return;
        }
        // Throttle: at most one `start` per interval however fast the user types…
        if (Date.now() - state.lastSent >= TYPING_SEND_INTERVAL_MS) {
          client?.emitEphemeral(MessagingCommand.TypingStart, { conversationId });
          state.lastSent = Date.now();
        }
        // …and a `stop` once they pause.
        state.idle = setTimeout(() => api.typing(conversationId, false), TYPING_IDLE_MS);
        typingRef.current.set(conversationId, state);
      },
      async loadOlder(conversationId) {
        const thread = qc.getQueryData<ThreadCache>(messagingKeys.thread(conversationId));
        if (!thread || thread.olderCursor === null) return;
        const page = await fetchHistory(conversationId, { before: thread.olderCursor });
        patchThread(conversationId, (t) => prependHistory(t, page));
      },
    }),
    // (`api` is referenced inside `typing` for the idle stop; it is stable for the provider's lifetime.)
    [markRead, patchThread, qc, transmit],
  );

  // ── the connection + event wiring ─────────────────────────────────────────
  useEffect(() => {
    if (authStatus !== "authenticated" || !meId) return;

    const readTimerMap = readTimers.current;
    const client = new RealtimeClient({ url: socketUrl(), getToken: (min) => ensureFreshAccessToken(min) });
    clientRef.current = client;
    const offs: Array<() => void> = [];
    const me = () => meRef.current!;

    offs.push(client.onStatus((s) => messagingStore.setStatus(s)));

    /** Reconcile everything we hold with the server. Runs on the first ready AND every reconnect. */
    const resyncAll = async () => {
      const threads = qc.getQueriesData<ThreadCache>({ queryKey: ["messages"] });
      await Promise.all(
        threads.map(async ([key, thread]) => {
          const conversationId = key[1] as string;
          if (!thread) return;
          try {
            const { members } = await resyncThread({
              read: () => qc.getQueryData<ThreadCache>(key),
              write: (update) => qc.setQueryData<ThreadCache>(key, (cur) => (cur ? update(cur) : cur)),
              fetchPage: (after) => fetchSync(conversationId, after),
            });
            if (members) patchInbox((inbox) => setMembers(inbox, conversationId, members));
          } catch (err) {
            if (err instanceof ApiError && err.status === 404) {
              // We lost access while offline (removed / archived out from under us).
              qc.removeQueries({ queryKey: key });
              patchInbox((inbox) => removeConversation(inbox, conversationId));
            } else {
              void qc.invalidateQueries({ queryKey: key });
            }
          }
        }),
      );
      await qc.invalidateQueries({ queryKey: messagingKeys.conversations });
      await qc.invalidateQueries({ queryKey: ["insights"] });
    };

    offs.push(
      client.onReady((ready) => {
        messagingStore.setOnline(ready.onlineUserIds);
        void resyncAll();
        // Re-send anything unacknowledged (same clientMessageId ⇒ idempotent).
        for (const list of Object.values(messagingStore.getState().pending)) {
          for (const p of list) if (p.status === "sending") void transmit(p);
        }
        const active = activeRef.current;
        if (active && document.visibilityState === "visible") markRead(active);
      }),
    );

    offs.push(
      client.on<MessageCreatedPayload>(MessagingEvent.MessageCreated, ({ message }) => {
        patchThread(message.conversationId, (t) => upsertMessage(t, message));
        const mine = message.senderId === me();
        patchInbox((inbox) => applyMessageToInbox(inbox, message, !mine && !isViewing(message.conversationId)));
        if (message.clientMessageId) messagingStore.removePending(message.conversationId, message.clientMessageId);
        messagingStore.typingStop(message.conversationId, message.senderId); // they sent it; they are not typing
        if (!mine && isViewing(message.conversationId)) markRead(message.conversationId);
      }),
      client.on<MessageUpdatedPayload>(MessagingEvent.MessageUpdated, ({ message }) => {
        patchThread(message.conversationId, (t) => upsertMessage(t, message));
        patchInbox((inbox) => applyMessageToInbox(inbox, message, false));
      }),
      client.on<MessageDeletedPayload>(MessagingEvent.MessageDeleted, (d) => {
        patchThread(d.conversationId, (t) => applyDeletion(t, d));
        patchInbox((inbox) =>
          inbox && {
            ...inbox,
            items: inbox.items.map((c) =>
              c.id === d.conversationId && c.lastMessage?.id === d.messageId
                ? { ...c, lastMessage: { ...c.lastMessage, body: "", deletedAt: d.deletedAt } as MessageDto }
                : c,
            ),
          },
        );
      }),
      client.on<ConversationCreatedPayload>(MessagingEvent.ConversationCreated, ({ conversation }) =>
        patchInbox((inbox) => upsertConversation(inbox, conversation)),
      ),
      client.on<ConversationUpdatedPayload>(MessagingEvent.ConversationUpdated, ({ conversation }) =>
        patchInbox((inbox) => upsertConversation(inbox, conversation)),
      ),
      client.on<ConversationMemberAddedPayload>(MessagingEvent.ConversationMemberAdded, ({ conversation, member }) => {
        if (member.userId === me()) {
          // We were just added: this is our first sight of the conversation.
          patchInbox((inbox) => upsertConversation(inbox, conversation));
        } else {
          patchInbox((inbox) => setMembers(inbox, conversation.id, conversation.members));
        }
      }),
      client.on<ConversationMemberRemovedPayload>(MessagingEvent.ConversationMemberRemoved, ({ conversationId, userId }) => {
        if (userId === me()) {
          patchInbox((inbox) => removeConversation(inbox, conversationId));
          qc.removeQueries({ queryKey: messagingKeys.thread(conversationId) });
        } else {
          void qc.invalidateQueries({ queryKey: messagingKeys.conversations });
        }
      }),
      client.on<ConversationReadPayload>(MessagingEvent.ConversationRead, (read) =>
        patchInbox((inbox) => applyReadToInbox(inbox, read, me())),
      ),
      client.on<TypingPayload>(MessagingEvent.TypingStart, (p) => p.userId !== me() && messagingStore.typingStart(p.conversationId, p.userId)),
      client.on<TypingPayload>(MessagingEvent.TypingStop, (p) => messagingStore.typingStop(p.conversationId, p.userId)),
      client.on<PresenceUpdatePayload>(MessagingEvent.PresenceUpdate, (p) => messagingStore.setPresence(p.userId, p.status === "online")),
      // Atlas' asynchronous AI analysis landed — the insights panel updates in place.
      client.on<ConversationAiUpdatedPayload>(ATLAS_CONVERSATION_AI_UPDATED, ({ conversationId, insights }) =>
        qc.setQueryData<ConversationInsightsDto>(messagingKeys.insights(conversationId), insights),
      ),
    );

    const onVisible = () => {
      const active = activeRef.current;
      if (document.visibilityState === "visible" && active) markRead(active);
    };
    document.addEventListener("visibilitychange", onVisible);

    client.start();
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      for (const off of offs) off();
      for (const t of readTimerMap.values()) clearTimeout(t);
      readTimerMap.clear();
      client.stop();
      clientRef.current = null;
      messagingStore.reset();
    };
  }, [authStatus, meId, qc, patchInbox, patchThread, markRead, transmit]);

  return <MessagingContext.Provider value={api}>{children}</MessagingContext.Provider>;
}

export function useMessaging(): MessagingApi {
  const ctx = useContext(MessagingContext);
  if (!ctx) throw new Error("useMessaging must be used within <MessagingProvider>");
  return ctx;
}
