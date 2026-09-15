import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, ENDPOINTS } from "@/config";

export interface ConversationSummary {
  id: string;
  title: string | null;
  updatedAt: string;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  at: string;
}

export interface ConversationDetail {
  id: string;
  title: string | null;
  messages: ConversationTurn[];
}

export interface ToolActivity {
  name: string;
  ok: boolean;
  mutates: boolean;
  error?: string;
}

export interface ChatResult {
  conversationId: string;
  message: string;
  toolActivity: ToolActivity[];
  usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

export interface CurrentContext {
  screen?: string;
  projectId?: string;
  leadId?: string;
  customerId?: string;
}

/** Backed by the real Atlas Copilot — Groq-hosted LLM with tool-orchestration
 *  over the existing real-estate use cases. See docs/atlas-assistant.md. */
export function useConversations() {
  return useQuery({
    queryKey: ["copilot-conversations"],
    queryFn: () => get<{ items: ConversationSummary[] }>(ENDPOINTS.copilot.conversations).then((r) => r.items),
  });
}

export function useConversation(conversationId: string | undefined) {
  return useQuery({
    queryKey: ["copilot-conversation", conversationId],
    queryFn: () => get<ConversationDetail>(ENDPOINTS.copilot.conversation(conversationId!)),
    enabled: !!conversationId,
  });
}

export function useAsk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, question, currentContext }: { conversationId?: string; question: string; currentContext?: CurrentContext }) =>
      post<ChatResult>(ENDPOINTS.copilot.ask, { conversationId, question, currentContext }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["copilot-conversation", data.conversationId] });
      qc.invalidateQueries({ queryKey: ["copilot-conversations"] });
    },
  });
}
