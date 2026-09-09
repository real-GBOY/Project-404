import { httpClient } from "@/lib/api/http-client";

export interface ToolActivity {
  name: string;
  ok: boolean;
  mutates: boolean;
  error?: string;
}

export interface ChatResponse {
  conversationId: string;
  message: string;
  toolActivity: ToolActivity[];
  usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

export interface CurrentContext {
  screen?: string;
  matterId?: string;
  clientId?: string;
}

export interface ChatRequest {
  conversationId?: string;
  message: string;
  currentContext?: CurrentContext;
}

/** POST /api/ai/chat — one assistant turn. Throws `ApiError` on failure. */
export const sendChat = (body: ChatRequest, signal?: AbortSignal) =>
  httpClient<ChatResponse>("/ai/chat", { method: "POST", body, signal });

export interface ConversationTranscript {
  id: string;
  title: string | null;
  messages: Array<{ role: "user" | "assistant"; content: string; at: string }>;
}

export const getConversation = (id: string, signal?: AbortSignal) =>
  httpClient<ConversationTranscript>(`/ai/conversations/${id}`, { signal });
