"use client";

import { MessageSquare, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useConversations } from "@/components/chat/conversations-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** ChatGPT-style conversation search (also opens with Ctrl/Cmd+K). */
export function SearchDialog({
  open,
  onOpenChange,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: () => void;
}) {
  const { conversations } = useConversations();
  const router = useRouter();
  const [query, setQuery] = useState("");

  // Reset the query on close so the dialog always opens empty.
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setQuery("");
    onOpenChange(nextOpen);
  };

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations.slice(0, 25);
    return conversations
      .filter((conversation) =>
        conversation.title.toLowerCase().includes(needle),
      )
      .slice(0, 25);
  }, [conversations, query]);

  const openConversation = (id: string) => {
    handleOpenChange(false);
    onNavigate?.();
    router.push(`/chat/${id}`);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="top-[20%] max-w-lg translate-y-0 p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Search chats</DialogTitle>
          <DialogDescription>
            Find a conversation by its title.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats…"
            aria-label="Search chats"
            className="h-8 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="text-muted-foreground px-3 py-8 text-center text-sm">
              No chats match “{query.trim()}”.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {results.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => openConversation(conversation.id)}
                    className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm outline-none focus-visible:ring-2"
                  >
                    <MessageSquare
                      className="text-muted-foreground size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {conversation.title}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatWhen(conversation.updated_at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
