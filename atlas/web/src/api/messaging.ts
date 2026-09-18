import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, patch, del, http, ENDPOINTS } from "@/config";
import type {
  ConversationDto,
  MessageAttachmentDto,
  MessageHistoryPage,
  MessageSyncResult,
  Page,
  SendMessageResult,
} from "@/features/messages/contracts/messaging-types";
import type { ConversationInsightsDto } from "@/features/messages/contracts/insights-types";
import { threadFromHistory, type ThreadCache } from "@/features/messages/lib/thread-cache";

/**
 * Messaging over REST. The socket carries everything live; REST is for what the
 * socket is bad at: history (cursor-paginated), reconnect resync, file upload, and
 * the request/response CRM actions. The React Query cache is the store the realtime
 * layer writes into (see `features/messages/realtime/messaging-provider.tsx`), so
 * these queries never poll or refetch on focus — an event, not a timer, updates them.
 */

export const messagingKeys = {
  conversations: ["conversations"] as const,
  thread: (conversationId: string) => ["messages", conversationId] as const,
  insights: (conversationId: string) => ["insights", conversationId] as const,
};

// ── REST calls ───────────────────────────────────────────────────────────────

export const fetchConversations = () =>
  get<Page<ConversationDto>>(ENDPOINTS.conversations.list, { limit: 100 });

export const fetchHistory = (conversationId: string, params: { before?: number; limit?: number } = {}) =>
  get<MessageHistoryPage>(ENDPOINTS.conversations.messages(conversationId), { limit: 40, ...params });

export const fetchSync = (conversationId: string, afterChangeSeq: number) =>
  get<MessageSyncResult>(ENDPOINTS.conversations.sync(conversationId), { afterChangeSeq, limit: 200 });

export const sendMessageRest = (conversationId: string, body: { body: string; clientMessageId: string }) =>
  post<SendMessageResult>(ENDPOINTS.conversations.messages(conversationId), body);

export const markReadRest = (conversationId: string) => post(ENDPOINTS.conversations.read(conversationId), {});

// ── hooks ────────────────────────────────────────────────────────────────────

/** The inbox. Kept live by socket events; refetched only on (re)connect, never on a timer. */
export function useConversations() {
  return useQuery({
    queryKey: messagingKeys.conversations,
    queryFn: fetchConversations,
    select: (page) => page.items,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/** One conversation's message window, as a `ThreadCache` the realtime layer mutates in place. */
export function useThread(conversationId: string | undefined) {
  return useQuery<ThreadCache>({
    queryKey: messagingKeys.thread(conversationId ?? "none"),
    queryFn: async () => threadFromHistory(await fetchHistory(conversationId!)),
    enabled: !!conversationId,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useInsights(conversationId: string | undefined) {
  return useQuery({
    queryKey: messagingKeys.insights(conversationId ?? "none"),
    queryFn: () => get<ConversationInsightsDto>(ENDPOINTS.conversations.insights(conversationId!)),
    enabled: !!conversationId,
    staleTime: Infinity, // pushed by `atlas:conversation:ai_updated`
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      type: "direct" | "group";
      title?: string;
      memberIds: string[];
      subjectType?: string;
      subjectId?: string;
    }) => post<ConversationDto>(ENDPOINTS.conversations.list, body),
    onSuccess: (created) => {
      qc.setQueryData<Page<ConversationDto>>(messagingKeys.conversations, (page) =>
        page
          ? { ...page, items: [created, ...page.items.filter((c) => c.id !== created.id)] }
          : { items: [created], nextCursor: null },
      );
    },
  });
}

export function useRefreshInsights(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => post<ConversationInsightsDto>(ENDPOINTS.conversations.insightsRefresh(conversationId)),
    // The result arrives over the socket; show "analysing" straight away.
    onSuccess: () =>
      qc.setQueryData<ConversationInsightsDto>(messagingKeys.insights(conversationId), (cur) =>
        cur ? { ...cur, status: "running" } : cur,
      ),
  });
}

export function useApplyRequirements(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId?: string) =>
      post(ENDPOINTS.conversations.applyRequirements(conversationId), leadId ? { leadId } : {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useCreateFollowup(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { leadId?: string; reason: string; dueAt: string; priority: "high" | "medium" | "low" }) =>
      post(ENDPOINTS.conversations.createFollowup(conversationId), body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["followups"] }),
  });
}

/** Edit / delete / react go over REST; the resulting change comes back to EVERY client (this one included) as a socket event. */
export const editMessage = (conversationId: string, messageId: string, body: string) =>
  patch(`${ENDPOINTS.conversations.messages(conversationId)}/${messageId}`, { body });
export const deleteMessage = (conversationId: string, messageId: string) =>
  del(`${ENDPOINTS.conversations.messages(conversationId)}/${messageId}`);
export const reactToMessage = (conversationId: string, messageId: string, emoji: string) =>
  http.put(`${ENDPOINTS.conversations.messages(conversationId)}/${messageId}/reactions`, { emoji });
export const unreactToMessage = (conversationId: string, messageId: string, emoji: string) =>
  del(`${ENDPOINTS.conversations.messages(conversationId)}/${messageId}/reactions/${encodeURIComponent(emoji)}`);

export function useLeaveConversation() {
  return useMutation({
    mutationFn: ({ conversationId, userId }: { conversationId: string; userId: string }) =>
      del(`${ENDPOINTS.conversations.members(conversationId)}/${userId}`),
  });
}

export function useRenameConversation() {
  return useMutation({
    mutationFn: ({ conversationId, title }: { conversationId: string; title: string }) =>
      patch<ConversationDto>(ENDPOINTS.conversations.byId(conversationId), { title }),
  });
}

// ── files (Core's presigned upload → confirm; the socket only ever carries the id) ──

export interface UploadedAttachment {
  fileId: string;
  fileName: string;
}

interface CreateUploadResponse {
  fileId: string;
  upload: { url: string; method: "PUT"; headers: Record<string, string> };
}

export async function uploadAttachment(file: File): Promise<UploadedAttachment> {
  const contentType = file.type || "application/octet-stream";
  const { fileId, upload } = await post<CreateUploadResponse>(ENDPOINTS.files.createUpload, {
    originalName: file.name,
    contentType,
    byteSize: file.size,
  });

  if (upload.url.startsWith("/")) {
    // Local driver: the API's own authenticated route (through the axios instance = Bearer token, base URL).
    await http.put(upload.url, file, { headers: { "Content-Type": "application/octet-stream", ...upload.headers } });
  } else {
    // Object storage (R2): a presigned URL — direct to storage, and NEVER with our bearer token.
    const res = await fetch(upload.url, { method: upload.method, headers: upload.headers, body: file });
    if (!res.ok) throw new Error(`Upload failed (${res.status}).`);
  }
  await post(ENDPOINTS.files.confirm(fileId));
  return { fileId, fileName: file.name };
}

/** Download an attachment through the membership-checked route and hand it to the browser. */
export async function downloadAttachment(conversationId: string, attachment: MessageAttachmentDto): Promise<void> {
  const res = await http.get<Blob>(ENDPOINTS.conversations.attachment(conversationId, attachment.id), {
    responseType: "blob",
  });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = attachment.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
