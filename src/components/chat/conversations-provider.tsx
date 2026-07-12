"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import type { ConversationRow } from "@/types/database";

type ConversationsContextValue = {
  conversations: ConversationRow[];
  isCreating: boolean;
  createConversation: () => Promise<ConversationRow | null>;
  renameConversation: (id: string, title: string) => Promise<boolean>;
  deleteConversation: (id: string) => Promise<boolean>;
  /** Local-only update (e.g. auto-title after the first message). */
  applyLocalUpdate: (
    id: string,
    update: Partial<Pick<ConversationRow, "title" | "updated_at">>,
  ) => void;
};

const ConversationsContext = createContext<ConversationsContextValue | null>(
  null,
);

function sortByUpdatedAt(conversations: ConversationRow[]): ConversationRow[] {
  return [...conversations].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export function ConversationsProvider({
  initialConversations,
  children,
}: {
  initialConversations: ConversationRow[];
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [conversations, setConversations] = useState(initialConversations);
  const [isCreating, setIsCreating] = useState(false);

  const createConversation =
    useCallback(async (): Promise<ConversationRow | null> => {
      setIsCreating(true);
      try {
        const response = await fetch("/api/conversations", { method: "POST" });
        if (!response.ok) throw new Error();
        const { conversation } = (await response.json()) as {
          conversation: ConversationRow;
        };
        setConversations((previous) => [conversation, ...previous]);
        router.push(`/chat/${conversation.id}`);
        return conversation;
      } catch {
        toast.error("Could not create a new conversation. Please try again.");
        return null;
      } finally {
        setIsCreating(false);
      }
    }, [router]);

  const renameConversation = useCallback(
    async (id: string, title: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/conversations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error);
        }
        const { conversation } = (await response.json()) as {
          conversation: ConversationRow;
        };
        setConversations((previous) =>
          sortByUpdatedAt(
            previous.map((item) => (item.id === id ? conversation : item)),
          ),
        );
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error && error.message
            ? error.message
            : "Could not rename the conversation.",
        );
        return false;
      }
    },
    [],
  );

  const deleteConversation = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/conversations/${id}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error();
        setConversations((previous) =>
          previous.filter((item) => item.id !== id),
        );
        if (pathname?.startsWith(`/chat/${id}`)) {
          router.push("/chat");
        }
        return true;
      } catch {
        toast.error("Could not delete the conversation. Please try again.");
        return false;
      }
    },
    [pathname, router],
  );

  const applyLocalUpdate = useCallback(
    (
      id: string,
      update: Partial<Pick<ConversationRow, "title" | "updated_at">>,
    ) => {
      setConversations((previous) =>
        sortByUpdatedAt(
          previous.map((item) =>
            item.id === id ? { ...item, ...update } : item,
          ),
        ),
      );
    },
    [],
  );

  const value = useMemo(
    () => ({
      conversations,
      isCreating,
      createConversation,
      renameConversation,
      deleteConversation,
      applyLocalUpdate,
    }),
    [
      conversations,
      isCreating,
      createConversation,
      renameConversation,
      deleteConversation,
      applyLocalUpdate,
    ],
  );

  return (
    <ConversationsContext.Provider value={value}>
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversations(): ConversationsContextValue {
  const context = useContext(ConversationsContext);
  if (!context) {
    throw new Error(
      "useConversations must be used within ConversationsProvider",
    );
  }
  return context;
}
