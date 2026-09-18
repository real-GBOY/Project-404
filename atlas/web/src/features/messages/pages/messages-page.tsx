import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/config";
import { useAuth } from "@/features/auth/auth-provider";
import { useConversations } from "@/api/messaging";
import { usePageChrome } from "@/lib/page-chrome";
import { ConversationList } from "../components/conversation-list";
import { InsightsPanel } from "../components/insights-panel";
import { MessageThread } from "../components/message-thread";
import { NewConversationModal } from "../components/new-conversation-modal";
import { conversationTitle } from "../lib/conversation-cache";

/**
 * Messages — Core's real-time messaging, in Atlas.
 *
 *   ┌ conversations ┬ thread + composer ─────────────┬ AI insights ┐
 *
 * The thread updates over the WebSocket (no polling); the AI panel on the right
 * fills in asynchronously when Atlas' analysis of the conversation completes.
 * Routes: `/messages` and `/messages/:conversationId`.
 */
export function MessagesPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const meId = user?.id ?? "";
  const conversations = useConversations();
  const [creating, setCreating] = useState(false);

  const active = useMemo(() => conversations.data?.find((c) => c.id === conversationId), [conversations.data, conversationId]);
  usePageChrome({ title: active ? conversationTitle(active, meId) : "Messages", group: "Communication" });

  if (conversations.error) {
    return (
      <div className="p-6">
        <ErrorState
          title="Couldn't load messages"
          message={conversations.error instanceof ApiError ? conversations.error.message : "The request failed."}
        />
      </div>
    );
  }

  const go = (id: string) => navigate(`/messages/${id}`);

  return (
    <div className="flex h-full min-h-0">
      <ConversationList
        conversations={conversations.data}
        loading={conversations.isLoading}
        activeId={conversationId}
        meId={meId}
        onSelect={go}
        onNew={() => setCreating(true)}
      />

      {active ? (
        <>
          <MessageThread key={active.id} conversation={active} meId={meId} />
          <InsightsPanel key={`insights-${active.id}`} conversation={active} />
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          {conversationId && !conversations.isLoading ? (
            <EmptyState
              icon="message"
              title="Conversation not found"
              description="It may have been removed, or you may no longer be a member."
              action={<Button variant="secondary" onClick={() => navigate("/messages")}>Back to messages</Button>}
            />
          ) : (
            <EmptyState
              icon="message"
              title="Select a conversation"
              description="Messages arrive here instantly. Link a conversation to a lead and Atlas summarises it, pulls out requirements and action items."
              action={<Button onClick={() => setCreating(true)} icon="plus">New conversation</Button>}
            />
          )}
        </div>
      )}

      <NewConversationModal open={creating} meId={meId} onOpenChange={setCreating} onCreated={go} />
    </div>
  );
}
