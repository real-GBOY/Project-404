import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, ENDPOINTS } from "@/config";

export interface ChatStat {
  label: string;
  value: string;
  delta: string;
}

export interface ChatRow {
  name: string;
  value: string;
  meta: string;
}

export interface ConversationRow {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
}

export interface MessageRow {
  id: string;
  conversationId: string;
  role: "user" | "ai";
  text: string;
  detail: string | null;
  recommend: string | null;
  stats: ChatStat[] | null;
  rows: ChatRow[] | null;
  cites: string[] | null;
  follow: string[] | null;
  isAction: boolean;
  createdAt: string;
}

export function useConversations() {
  return useQuery({ queryKey: ["copilot-conversations"], queryFn: () => get<ConversationRow[]>(ENDPOINTS.copilot.conversations) });
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ["copilot-messages", conversationId],
    queryFn: () => get<MessageRow[]>(ENDPOINTS.copilot.messages(conversationId!)),
    enabled: !!conversationId,
  });
}

export function useCopilotSuggestions() {
  return useQuery({ queryKey: ["copilot-suggestions"], queryFn: () => get<string[]>(ENDPOINTS.copilot.suggestions) });
}

export function useAsk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, question }: { conversationId?: string; question: string }) =>
      post<{ conversationId: string; message: MessageRow }>(ENDPOINTS.copilot.ask, { conversationId, question }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["copilot-messages", data.conversationId] });
      qc.invalidateQueries({ queryKey: ["copilot-conversations"] });
    },
  });
}
