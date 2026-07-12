"use client";

import { Menu, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ConversationsProvider } from "@/components/chat/conversations-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { APP_NAME } from "@/lib/brand";
import type { ConversationRow } from "@/types/database";

export function ChatShell({
  initialConversations,
  children,
}: {
  initialConversations: ConversationRow[];
  children: ReactNode;
}) {
  // The drawer closes via onNavigate callbacks passed to the sidebar.
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ConversationsProvider initialConversations={initialConversations}>
      <div className="flex h-dvh overflow-hidden">
        <aside className="hidden w-72 shrink-0 border-r md:block">
          <ChatSidebar />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3 md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Open conversation menu"
                  />
                }
              >
                <Menu className="size-4" />
              </SheetTrigger>
              <SheetContent side="left" className="w-80 gap-0 p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Conversations</SheetTitle>
                </SheetHeader>
                <ChatSidebar onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-semibold tracking-tight"
            >
              <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
                <MessageSquareText className="size-3.5" aria-hidden="true" />
              </span>
              {APP_NAME}
            </Link>
          </header>

          <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        </div>
      </div>
    </ConversationsProvider>
  );
}
