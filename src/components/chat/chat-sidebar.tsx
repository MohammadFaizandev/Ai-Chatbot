"use client";

import { UserButton } from "@clerk/nextjs";
import { Search, SquarePen } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { ConversationList } from "@/components/chat/conversation-list";
import { useConversations } from "@/components/chat/conversations-provider";
import { SearchDialog } from "@/components/chat/search-dialog";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { APP_NAME } from "@/lib/brand";

const navItemClass =
  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring/50 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50";

export function ChatSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { createConversation, isCreating } = useConversations();
  const [searchOpen, setSearchOpen] = useState(false);

  const handleNewChat = async () => {
    const conversation = await createConversation();
    if (conversation) onNavigate?.();
  };

  // Ctrl/Cmd+K opens chat search, like most modern SaaS apps.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="bg-sidebar text-sidebar-foreground flex h-full min-h-0 flex-col">
      <div className="p-3 pb-1">
        <Link
          href="/"
          className="focus-visible:ring-sidebar-ring/50 flex items-center gap-2.5 rounded-lg p-1 font-semibold tracking-tight outline-none focus-visible:ring-2"
        >
          <BrandLogo />
          {APP_NAME}
        </Link>
      </div>

      <nav aria-label="Chat actions" className="flex flex-col gap-0.5 p-2">
        <button
          type="button"
          className={navItemClass}
          onClick={handleNewChat}
          disabled={isCreating}
        >
          <SquarePen className="size-4 shrink-0" aria-hidden="true" />
          {isCreating ? "Creating…" : "New chat"}
        </button>
        <button
          type="button"
          className={navItemClass}
          onClick={() => setSearchOpen(true)}
        >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          Search chats
          <kbd className="text-muted-foreground ml-auto hidden font-sans text-xs md:inline">
            Ctrl K
          </kbd>
        </button>
      </nav>

      <div className="text-muted-foreground px-4 pt-3 pb-1 text-xs font-medium">
        Recents
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ConversationList onNavigate={onNavigate} />
      </ScrollArea>

      <div className="border-sidebar-border flex items-center justify-between border-t p-3">
        <UserButton showName />
        <ThemeToggle />
      </div>

      <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onNavigate={onNavigate}
      />
    </div>
  );
}
