import { useSyncExternalStore } from "react";
import type { ConnectionStatus } from "./realtime-client";

/**
 * Client-only, ephemeral messaging state — the things that must NOT live in the
 * server-state cache because the server never stores them (or hasn't yet):
 *
 *  - connection status and who is online (presence),
 *  - who is typing where (expires by itself — a lost `typing:stop` must not stick),
 *  - messages the user sent that the server has not acknowledged yet.
 *
 * Server-owned data (conversations, messages, insights) lives in the React Query
 * cache and is reconciled by `thread-cache.ts`.
 */

export interface PendingMessage {
  /** The idempotency key — a retry with the same id can never duplicate the message. */
  clientMessageId: string;
  conversationId: string;
  body: string;
  attachmentFileIds: string[];
  attachmentNames: string[];
  replyToMessageId: string | null;
  createdAt: string;
  status: "sending" | "failed";
  error?: string;
}

interface State {
  status: ConnectionStatus;
  onlineUserIds: ReadonlySet<string>;
  /** conversationId → userId → epoch ms when the indicator lapses */
  typing: Readonly<Record<string, Readonly<Record<string, number>>>>;
  pending: Readonly<Record<string, readonly PendingMessage[]>>;
}

const TYPING_TTL_MS = 5_000;

let state: State = { status: "idle", onlineUserIds: new Set(), typing: {}, pending: {} };
const listeners = new Set<() => void>();
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

function set(next: Partial<State>): void {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const messagingStore = {
  getState: () => state,

  setStatus: (status: ConnectionStatus) => set({ status }),

  setOnline: (ids: Iterable<string>) => set({ onlineUserIds: new Set(ids) }),
  setPresence(userId: string, online: boolean) {
    const next = new Set(state.onlineUserIds);
    if (online) next.add(userId);
    else next.delete(userId);
    set({ onlineUserIds: next });
  },

  /** Someone is typing. The indicator expires on its own if no `typing:stop` follows. */
  typingStart(conversationId: string, userId: string) {
    const key = `${conversationId}:${userId}`;
    clearTimeout(typingTimers.get(key));
    typingTimers.set(key, setTimeout(() => messagingStore.typingStop(conversationId, userId), TYPING_TTL_MS));
    set({
      typing: {
        ...state.typing,
        [conversationId]: { ...state.typing[conversationId], [userId]: Date.now() + TYPING_TTL_MS },
      },
    });
  },
  typingStop(conversationId: string, userId: string) {
    const key = `${conversationId}:${userId}`;
    clearTimeout(typingTimers.get(key));
    typingTimers.delete(key);
    const room = { ...state.typing[conversationId] };
    if (!(userId in room)) return;
    delete room[userId];
    set({ typing: { ...state.typing, [conversationId]: room } });
  },

  addPending(message: PendingMessage) {
    const list = state.pending[message.conversationId] ?? [];
    if (list.some((p) => p.clientMessageId === message.clientMessageId)) return;
    set({ pending: { ...state.pending, [message.conversationId]: [...list, message] } });
  },
  updatePending(conversationId: string, clientMessageId: string, patch: Partial<PendingMessage>) {
    const list = state.pending[conversationId];
    if (!list) return;
    set({
      pending: {
        ...state.pending,
        [conversationId]: list.map((p) => (p.clientMessageId === clientMessageId ? { ...p, ...patch } : p)),
      },
    });
  },
  removePending(conversationId: string, clientMessageId: string) {
    const list = state.pending[conversationId];
    if (!list?.some((p) => p.clientMessageId === clientMessageId)) return;
    set({ pending: { ...state.pending, [conversationId]: list.filter((p) => p.clientMessageId !== clientMessageId) } });
  },

  /** Test/logout reset. */
  reset() {
    for (const t of typingTimers.values()) clearTimeout(t);
    typingTimers.clear();
    state = { status: "idle", onlineUserIds: new Set(), typing: {}, pending: {} };
    for (const l of listeners) l();
  },
};

export function useMessagingState<T>(select: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(state));
}

export const EMPTY_PENDING: readonly PendingMessage[] = [];
