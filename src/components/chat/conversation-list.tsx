"use client";

import { MessageSquare } from "lucide-react";

import { ConversationItem } from "@/components/chat/conversation-item";
import { useConversations } from "@/components/chat/conversations-provider";

export function ConversationList({ onNavigate }: { onNavigate?: () => void }) {
  const { conversations } = useConversations();

  if (conversations.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-2 px-4 py-10 text-center text-sm">
        <MessageSquare className="size-5" aria-hidden="true" />
        No conversations yet. Start a new chat to begin.
      </div>
    );
  }

  return (
    <nav aria-label="Conversations" className="flex flex-col gap-0.5 p-2">
      {conversations.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}
