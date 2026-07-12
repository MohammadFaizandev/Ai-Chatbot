"use client";

import { UserButton } from "@clerk/nextjs";
import { MessageSquareText, SquarePen } from "lucide-react";
import Link from "next/link";

import { ConversationList } from "@/components/chat/conversation-list";
import { useConversations } from "@/components/chat/conversations-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { APP_NAME } from "@/lib/brand";

export function ChatSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { createConversation, isCreating } = useConversations();

  const handleNewChat = async () => {
    const conversation = await createConversation();
    if (conversation) onNavigate?.();
  };

  return (
    <div className="bg-sidebar text-sidebar-foreground flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
            <MessageSquareText className="size-4" aria-hidden="true" />
          </span>
          {APP_NAME}
        </Link>
      </div>

      <div className="p-3 pb-1">
        <Button
          className="w-full"
          onClick={handleNewChat}
          disabled={isCreating}
        >
          <SquarePen className="size-4" aria-hidden="true" />
          {isCreating ? "Creating…" : "New chat"}
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ConversationList onNavigate={onNavigate} />
      </ScrollArea>

      <div className="flex items-center justify-between border-t p-3">
        <UserButton />
        <ThemeToggle />
      </div>
    </div>
  );
}
