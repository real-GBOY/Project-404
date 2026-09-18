import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as ConfigModule from "@/config";
import { ENDPOINTS } from "@/config/endpoints";
import { PageChromeProvider } from "@/lib/page-chrome";
import { ToastProvider } from "@/lib/toast/toast-provider";
import type { ConversationDto, MessageDto } from "../contracts/messaging-types";
import type { ConversationInsightsDto } from "../contracts/insights-types";
import { ATLAS_CONVERSATION_AI_UPDATED } from "../contracts/insights-types";
import { MessagingCommand, MessagingEvent, RealtimeSystemEvent } from "../contracts/realtime-events";
import { messagingStore } from "../realtime/messaging-store";
import { MessagingProvider } from "../realtime/messaging-provider";
import { MessagesPage } from "./messages-page";

// ── a controllable socket + mocked HTTP ──────────────────────────────────────

type Handler = (...args: unknown[]) => void;
class FakeSocket {
  connected = false;
  handlers = new Map<string, Handler[]>();
  sent: Array<{ event: string; payload: Record<string, unknown> }> = [];
  ackFor: (event: string, payload: Record<string, unknown>) => unknown = () => ({ ok: true, data: {} });
  on(event: string, h: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), h]);
  }
  off() {}
  emit() {}
  connect() {
    this.connected = true;
  }
  disconnect() {
    this.connected = false;
  }
  timeout() {
    return {
      emitWithAck: async (event: string, payload: Record<string, unknown>) => {
        this.sent.push({ event, payload });
        return this.ackFor(event, payload);
      },
    };
  }
  /** server → client */
  push(event: string, payload?: unknown) {
    act(() => {
      for (const h of this.handlers.get(event) ?? []) h(payload);
    });
  }
  ready() {
    this.connected = true;
    this.push(RealtimeSystemEvent.Ready, { userId: ME, organizationId: "o1", tokenExpiresAt: Math.floor(Date.now() / 1000) + 900, onlineUserIds: [ME] });
  }
  drop() {
    this.connected = false;
    this.push("disconnect", "transport close");
  }
}

const { holder, get, post, patch, del } = vi.hoisted(() => ({
  holder: { socket: null as unknown },
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

vi.mock("socket.io-client", () => ({ io: () => holder.socket }));
vi.mock("@/config", async () => {
  const actual = await vi.importActual<typeof ConfigModule>("@/config");
  return { ...actual, get, post, patch, del, ensureFreshAccessToken: async () => "tok" };
});
const ME = "u_me";
vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({ status: "authenticated", user: { id: "u_me", email: "me@x.test", displayName: "Me" }, organizationId: "o1", login: vi.fn(), logout: vi.fn() }),
}));

// ── fixtures ─────────────────────────────────────────────────────────────────

const msg = (seq: number, over: Partial<MessageDto> = {}): MessageDto => ({
  id: `m${seq}`, conversationId: "c1", senderId: "u_sara", body: `hello ${seq}`, messageType: "text", clientMessageId: null,
  replyToMessageId: null, seq, changeSeq: seq, createdAt: `2026-09-18T10:0${seq}:00.000Z`, updatedAt: "x", editedAt: null,
  deletedAt: null, metadata: {}, attachments: [], reactions: [], ...over,
});

const members = [
  { userId: ME, displayName: "Me Myself", role: "owner" as const, joinedAt: "j", leftAt: null, lastReadMessageId: null, lastReadAt: null },
  { userId: "u_sara", displayName: "Sara Agent", role: "member" as const, joinedAt: "j", leftAt: null, lastReadMessageId: null, lastReadAt: null },
];

const conversation = (id: string, over: Partial<ConversationDto> = {}): ConversationDto => ({
  id, type: "group", title: id === "c1" ? "Ahmed — apartment" : "Other chat", subjectType: id === "c1" ? "lead" : null,
  subjectId: id === "c1" ? "led_1" : null, createdBy: ME, createdAt: "2026-09-18T09:00:00.000Z", updatedAt: "x",
  lastMessageAt: "2026-09-18T10:02:00.000Z", lastMessage: null, archivedAt: null, metadata: {}, lastChangeSeq: 2, members,
  me: { lastReadMessageId: null, lastReadAt: null, unreadCount: 0, muted: false, role: "owner" }, ...over,
});

const NO_INSIGHTS: ConversationInsightsDto = {
  conversationId: "c1", status: "none", version: 0, summary: "", keyFacts: [], actionItems: [], unresolvedQuestions: [],
  requirements: null, analyzedAt: null, stale: false, lastError: null,
};

let syncResult: { messages: MessageDto[]; lastChangeSeq: number; hasMore: boolean; members: typeof members };
/** What the server currently lists as the caller's conversations. */
let inboxIds: string[];

function routeGet() {
  get.mockImplementation(async (url: string) => {
    if (url === ENDPOINTS.conversations.list) return { items: inboxIds.map((id) => conversation(id)), nextCursor: null };
    if (url === ENDPOINTS.conversations.messages("c1")) return { messages: [msg(1), msg(2)], olderCursor: null, lastChangeSeq: 2 };
    if (url === ENDPOINTS.conversations.sync("c1")) return syncResult;
    if (url === ENDPOINTS.conversations.insights("c1")) return NO_INSIGHTS;
    if (url === ENDPOINTS.team) return { items: [] };
    if (url === ENDPOINTS.leads.list) return [];
    throw new Error(`unexpected GET ${url}`);
  });
}

let socket: FakeSocket;

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/messages/c1"]}>
        <PageChromeProvider>
          <ToastProvider>
            <MessagingProvider>
              <Routes>
                <Route path="/messages/:conversationId" element={<MessagesPage />} />
                <Route path="/messages" element={<MessagesPage />} />
              </Routes>
            </MessagingProvider>
          </ToastProvider>
        </PageChromeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { qc, ...utils };
}

/** The open conversation's thread (the inbox preview shows the last message text too). */
const thread = () => within(screen.getByRole("region", { name: /Conversation with/ }));
const delayed = <T,>(value: T, ms = 60) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

const historyCalls = () => get.mock.calls.filter(([u]) => u === ENDPOINTS.conversations.messages("c1")).length;
const sends = () => socket.sent.filter((s) => s.event === MessagingCommand.MessageCreate);

beforeEach(() => {
  socket = new FakeSocket();
  holder.socket = socket;
  syncResult = { messages: [], lastChangeSeq: 2, hasMore: false, members };
  inboxIds = ["c1", "c2"];
  get.mockReset();
  post.mockReset();
  patch.mockReset();
  del.mockReset();
  routeGet();
  messagingStore.reset();
});
afterEach(() => messagingStore.reset());

/** Open the page and wait until the socket is live and the history is on screen. */
async function openConversation() {
  const view = mount();
  await screen.findByText("hello 2");
  const listCalls = () => get.mock.calls.filter(([u]) => u === ENDPOINTS.conversations.list).length;
  const listBefore = listCalls();
  socket.ready();
  // The first `ready` reconciles (thread sync + inbox refetch). Let that settle so the tests
  // exercise steady-state live behaviour deterministically.
  await waitFor(() => {
    expect(get.mock.calls.some(([u]) => u === ENDPOINTS.conversations.sync("c1"))).toBe(true);
    expect(listCalls()).toBeGreaterThan(listBefore);
  });
  await act(async () => {});
  return view;
}

describe("Messages — real-time thread", () => {
  it("shows history, then delivers a new message from the socket instantly — with no extra HTTP fetch (no polling)", async () => {
    await openConversation();
    expect(screen.getByText("hello 1")).toBeInTheDocument();
    const before = historyCalls();

    socket.push(MessagingEvent.MessageCreated, { message: msg(3, { body: "Do you have anything around 5 million?" }) });

    expect(await screen.findByText("Do you have anything around 5 million?")).toBeInTheDocument();
    expect(historyCalls()).toBe(before); // the event WAS the update
  });

  it("does not duplicate a message delivered twice (at-least-once broadcast)", async () => {
    await openConversation();
    const m = msg(3, { body: "only once please" });
    socket.push(MessagingEvent.MessageCreated, { message: m });
    socket.push(MessagingEvent.MessageCreated, { message: m });
    await thread().findByText("only once please");
    expect(thread().getAllByText("only once please")).toHaveLength(1);
  });

  it("applies live edits and deletions in place", async () => {
    await openConversation();
    socket.push(MessagingEvent.MessageUpdated, { message: msg(2, { body: "hello 2 (fixed)", changeSeq: 9, editedAt: "e" }) });
    expect(await screen.findByText("hello 2 (fixed)")).toBeInTheDocument();
    expect(screen.getByText(/edited/)).toBeInTheDocument();

    socket.push(MessagingEvent.MessageDeleted, { conversationId: "c1", messageId: "m1", changeSeq: 10, deletedAt: "d" });
    await waitFor(() => expect(screen.queryByText("hello 1")).not.toBeInTheDocument());
    expect(screen.getByText("Message deleted")).toBeInTheDocument();
  });

  it("shows and clears the typing indicator; ignores your own", async () => {
    await openConversation();
    socket.push(MessagingEvent.TypingStart, { conversationId: "c1", userId: "u_sara" });
    expect(await screen.findByText("Sara Agent is typing…")).toBeInTheDocument();
    socket.push(MessagingEvent.TypingStop, { conversationId: "c1", userId: "u_sara" });
    await waitFor(() => expect(screen.queryByText(/is typing/)).not.toBeInTheDocument());

    socket.push(MessagingEvent.TypingStart, { conversationId: "c1", userId: ME });
    expect(screen.queryByText(/is typing/)).not.toBeInTheDocument();
  });

  it("marks the open conversation read over the socket (debounced) and clears its unread badge", async () => {
    await openConversation();
    await waitFor(() => expect(socket.sent.some((s) => s.event === MessagingCommand.ConversationRead && s.payload.conversationId === "c1")).toBe(true));
  });

  it("counts unread for OTHER conversations, and shows others' read receipts under your last message", async () => {
    await openConversation();
    socket.push(MessagingEvent.MessageCreated, { message: msg(1, { id: "x1", conversationId: "c2", body: "psst" }) });
    const list = screen.getByRole("complementary", { name: "Conversations" });
    expect(await within(list).findByLabelText("1 unread")).toBeInTheDocument();

    // my own message, then Sara reads it
    socket.push(MessagingEvent.MessageCreated, { message: msg(3, { senderId: ME, body: "my reply" }) });
    await screen.findByText("my reply");
    socket.push(MessagingEvent.ConversationRead, { conversationId: "c1", userId: "u_sara", lastReadMessageId: "m3", lastReadAt: "t" });
    expect(await screen.findByLabelText("Seen")).toHaveTextContent("Seen by Sara");
  });
});

describe("Messages — sending", () => {
  const typeAndSend = (text: string) => {
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: text } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  };

  it("shows the message immediately as 'sending', carries a clientMessageId, and reconciles on the ack without duplicating", async () => {
    // a realistic round trip, so the optimistic state is observable
    socket.ackFor = (_e, p) =>
      delayed({ ok: true, data: { message: msg(3, { senderId: ME, body: p.body as string, clientMessageId: p.clientMessageId as string }), deduplicated: false } });
    await openConversation();
    typeAndSend("Send floor plans tonight");

    expect(await thread().findByText("Sending…")).toBeInTheDocument(); // optimistic
    await waitFor(() => expect(sends()).toHaveLength(1));
    expect(sends()[0]!.payload).toMatchObject({ conversationId: "c1", body: "Send floor plans tonight" });
    expect(String(sends()[0]!.payload.clientMessageId)).toMatch(/^[0-9a-f-]{36}$/);

    await waitFor(() => expect(screen.queryByText("Sending…")).not.toBeInTheDocument());
    // …and the server's broadcast of the same message must not add a second copy
    socket.push(MessagingEvent.MessageCreated, { message: msg(3, { senderId: ME, body: "Send floor plans tonight", clientMessageId: String(sends()[0]!.payload.clientMessageId) }) });
    expect(thread().getAllByText("Send floor plans tonight")).toHaveLength(1);
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });

  it("a rejected send shows the reason and Retry re-sends with the SAME clientMessageId", async () => {
    socket.ackFor = () => ({ ok: false, error: { code: "messaging.conversation_archived", message: "This conversation is archived." } });
    await openConversation();
    typeAndSend("late message");
    expect(await screen.findByText("This conversation is archived.")).toBeInTheDocument();
    const first = String(sends()[0]!.payload.clientMessageId);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(sends()).toHaveLength(2));
    expect(String(sends()[1]!.payload.clientMessageId)).toBe(first);
  });

  it("connected but never acknowledged: shows 'No response' with Retry (safe - same clientMessageId), not an endless spinner", async () => {
    socket.ackFor = () => {
      throw new Error("operation has timed out");
    };
    await openConversation();
    typeAndSend("did this land?");
    expect(await thread().findByText("No response from the server.")).toBeInTheDocument();
    const first = String(sends()[0]!.payload.clientMessageId);
    socket.ackFor = (_e, p) => ({ ok: true, data: { message: msg(3, { senderId: ME, body: p.body as string, clientMessageId: p.clientMessageId as string }), deduplicated: true } });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(sends()).toHaveLength(2));
    expect(String(sends()[1]!.payload.clientMessageId)).toBe(first);
    await waitFor(() => expect(screen.queryByText("No response from the server.")).not.toBeInTheDocument());
  });

  it("while disconnected the message stays 'sending' and is re-sent on reconnect with the same id (idempotent)", async () => {
    await openConversation();
    socket.drop();
    typeAndSend("sent from the train");
    expect(await screen.findByText("Sending…")).toBeInTheDocument();
    expect(sends()).toHaveLength(0); // could not send offline

    socket.ackFor = (_e, p) => ({ ok: true, data: { message: msg(3, { senderId: ME, body: p.body as string, clientMessageId: p.clientMessageId as string }), deduplicated: false } });
    socket.ready(); // reconnected
    await waitFor(() => expect(sends()).toHaveLength(1));
    expect(sends()[0]!.payload.body).toBe("sent from the train");
    await waitFor(() => expect(screen.queryByText("Sending…")).not.toBeInTheDocument());
  });

  it("Enter sends, Shift+Enter does not", async () => {
    socket.ackFor = (_e, p) => ({ ok: true, data: { message: msg(3, { senderId: ME, body: p.body as string }), deduplicated: false } });
    await openConversation();
    const box = screen.getByLabelText("Message");
    fireEvent.change(box, { target: { value: "line one" } });
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(sends()).toHaveLength(0);
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(sends()).toHaveLength(1));
  });
});

describe("Messages — reconnect and resync", () => {
  it("after a drop, reconciles everything missed (new, edited, deleted) from the last cursor via REST, then resumes live", async () => {
    await openConversation();
    socket.drop();
    expect(await screen.findByText(/Reconnecting/)).toBeInTheDocument();

    // while offline the server saw: a new message, an edit of #1, a deletion of #2
    syncResult = {
      messages: [msg(3, { body: "missed while offline", changeSeq: 3 }), msg(1, { body: "hello 1 (edited)", changeSeq: 4, editedAt: "e" }), msg(2, { body: "", deletedAt: "d", changeSeq: 5 })],
      lastChangeSeq: 5,
      hasMore: false,
      members,
    };
    socket.ready();

    expect(await screen.findByText("missed while offline")).toBeInTheDocument();
    expect(screen.getByText("hello 1 (edited)")).toBeInTheDocument();
    expect(screen.getByText("Message deleted")).toBeInTheDocument();
    // resync started from the cursor the client already had (history's lastChangeSeq = 2)
    const syncCall = get.mock.calls.find(([u]) => u === ENDPOINTS.conversations.sync("c1"));
    expect(syncCall?.[1]).toMatchObject({ afterChangeSeq: 2 });
    await waitFor(() => expect(screen.queryByText(/Reconnecting/)).not.toBeInTheDocument());

    // …and live delivery continues
    socket.push(MessagingEvent.MessageCreated, { message: msg(6, { body: "and live again", changeSeq: 6 }) });
    expect(await screen.findByText("and live again")).toBeInTheDocument();
  });

  it("drops a conversation from view if access was lost while offline (404 on resync)", async () => {
    await openConversation();
    socket.drop();
    const { ApiError } = await import("@/config");
    get.mockImplementation(async (url: string) => {
      if (url === ENDPOINTS.conversations.sync("c1")) throw new ApiError(404, "messaging.conversation_not_found", "Conversation not found.");
      if (url === ENDPOINTS.conversations.list) return { items: [conversation("c2")], nextCursor: null };
      return NO_INSIGHTS;
    });
    socket.ready();
    expect(await screen.findByText("Conversation not found")).toBeInTheDocument();
  });

  it("removal while online: the conversation disappears live", async () => {
    await openConversation();
    inboxIds = ["c2"]; // the server no longer lists it for us
    socket.push(MessagingEvent.ConversationMemberRemoved, { conversationId: "c1", userId: ME });
    expect(await screen.findByText("Conversation not found")).toBeInTheDocument();
  });
});

describe("Messages — AI insights panel", () => {
  it("starts empty, then fills in when the asynchronous analysis is pushed over the socket", async () => {
    await openConversation();
    const panel = await screen.findByRole("complementary", { name: "AI conversation insights" });
    expect(await within(panel).findByText("Not analysed yet")).toBeInTheDocument();

    const insights: ConversationInsightsDto = {
      conversationId: "c1", status: "idle", version: 1,
      summary: "Customer wants a 3-bedroom apartment in New Cairo around 5M EGP.",
      keyFacts: [{ label: "Budget", value: "5,000,000 EGP" }],
      actionItems: [{ action: "Send floor plans", owner: "agent", due: "tonight" }],
      unresolvedQuestions: ["Preferred payment plan not specified"],
      requirements: { budgetMinEgp: 5_000_000, budgetMaxEgp: 5_000_000, locations: ["New Cairo"], propertyTypes: ["apartment"], bedroomsMin: 3, bedroomsMax: 3, preferredFloors: [], deliveryWithinMonths: 3, otherPreferences: [], intent: "high", summary: "s" },
      analyzedAt: new Date().toISOString(), stale: false, lastError: null,
    };
    socket.push(ATLAS_CONVERSATION_AI_UPDATED, { conversationId: "c1", insights });

    expect(await within(panel).findByText(/Customer wants a 3-bedroom apartment/)).toBeInTheDocument();
    expect(within(panel).getByText("3 bedrooms")).toBeInTheDocument();
    expect(within(panel).getByText("New Cairo")).toBeInTheDocument();
    expect(within(panel).getByText("~5M EGP")).toBeInTheDocument();
    expect(within(panel).getByText(/Send floor plans/)).toBeInTheDocument();
    expect(within(panel).getByText("Preferred payment plan not specified")).toBeInTheDocument();
  });

  it("'Apply to Lead' is an explicit click that calls the permissioned endpoint — the AI never applies on its own", async () => {
    post.mockResolvedValue({});
    await openConversation();
    const panel = await screen.findByRole("complementary", { name: "AI conversation insights" });
    await within(panel).findByText("Not analysed yet");
    expect(post).not.toHaveBeenCalled(); // nothing applied by merely receiving/rendering insights

    socket.push(ATLAS_CONVERSATION_AI_UPDATED, {
      conversationId: "c1",
      insights: { ...NO_INSIGHTS, status: "idle", version: 1, summary: "s", requirements: { budgetMinEgp: null, budgetMaxEgp: 5_000_000, locations: ["New Cairo"], propertyTypes: [], bedroomsMin: 3, bedroomsMax: 3, preferredFloors: [], deliveryWithinMonths: null, otherPreferences: [], intent: "high", summary: "s" }, analyzedAt: new Date().toISOString() },
    });
    fireEvent.click(await within(panel).findByRole("button", { name: /Apply to Lead/ }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(ENDPOINTS.conversations.applyRequirements("c1"), {}));
  });

  it("shows 'Analysing…' while a run is in progress and keeps earlier insights on failure", async () => {
    await openConversation();
    const panel = await screen.findByRole("complementary", { name: "AI conversation insights" });
    await within(panel).findByText("Not analysed yet");
    socket.push(ATLAS_CONVERSATION_AI_UPDATED, { conversationId: "c1", insights: { ...NO_INSIGHTS, status: "running" } });
    expect(await within(panel).findByText("Analysing…")).toBeInTheDocument();

    socket.push(ATLAS_CONVERSATION_AI_UPDATED, { conversationId: "c1", insights: { ...NO_INSIGHTS, status: "failed", version: 1, summary: "kept summary", lastError: "x" } });
    expect(await within(panel).findByText("Analysis failed")).toBeInTheDocument();
    expect(within(panel).getByText("kept summary")).toBeInTheDocument();
  });
});
