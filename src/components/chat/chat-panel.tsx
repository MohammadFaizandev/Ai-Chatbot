"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatMessage } from "@/components/chat/chat-message";
import { useConversations } from "@/components/chat/conversations-provider";
import { PENDING_PROMPT_STORAGE_KEY } from "@/components/chat/empty-chat";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { useSelectedModel } from "@/hooks/use-selected-model";
import { generateLocalTitle } from "@/lib/validation";
import type {
  AttachmentMeta,
  ChatMessage as ChatMessageType,
  ChatStreamEvent,
  UsageInfo,
} from "@/types/chat";
import type { ConversationRow } from "@/types/database";

const DEFAULT_TITLE = "New Conversation";

export function ChatPanel({
  conversation,
  initialMessages,
  initialUsage,
}: {
  conversation: ConversationRow;
  initialMessages: ChatMessageType[];
  initialUsage: UsageInfo;
}) {
  const { conversations, applyLocalUpdate } = useConversations();
  const [messages, setMessages] = useState<ChatMessageType[]>(initialMessages);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [usage, setUsage] = useState(initialUsage);
  const [model, setModel] = useSelectedModel();
  // Prompt chosen on the empty-state screen, read once before first render.
  const [initialPrompt] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const pending = sessionStorage.getItem(PENDING_PROMPT_STORAGE_KEY);
      if (pending) {
        sessionStorage.removeItem(PENDING_PROMPT_STORAGE_KEY);
        return pending;
      }
    } catch {
      // sessionStorage unavailable — nothing to prefill.
    }
    return "";
  });
  const abortRef = useRef<AbortController | null>(null);

  const { containerRef, handleScroll } = useChatScroll(
    `${messages.length}:${streamingText?.length ?? 0}`,
  );

  const title =
    conversations.find((item) => item.id === conversation.id)?.title ??
    conversation.title;

  // Abort any in-flight generation when leaving the page.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const send = async (text: string, attachments: AttachmentMeta[]) => {
    if (isGenerating) return;
    setIsGenerating(true);

    const isFirstMessage = messages.length === 0;
    const temporaryId = `temp-${Date.now()}`;
    setMessages((previous) => [
      ...previous,
      {
        id: temporaryId,
        conversation_id: conversation.id,
        user_id: conversation.user_id,
        role: "user",
        content: text || null,
        status: "completed",
        created_at: new Date().toISOString(),
        attachments,
      },
    ]);

    // Keep the sidebar in sync: bump to top, auto-title on first message.
    const localUpdate: Partial<Pick<ConversationRow, "title" | "updated_at">> =
      { updated_at: new Date().toISOString() };
    if (isFirstMessage && title === DEFAULT_TITLE && text) {
      localUpdate.title = generateLocalTitle(text);
    }
    applyLocalUpdate(conversation.id, localUpdate);

    const controller = new AbortController();
    abortRef.current = controller;
    let assistantText = "";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversation.id,
          message: text,
          attachmentIds: attachments.map((attachment) => attachment.id),
          model,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setMessages((previous) =>
          previous.filter((message) => message.id !== temporaryId),
        );
        if (response.status === 429) {
          setUsage((previous) => ({ ...previous, remaining: 0 }));
        }
        toast.error(body?.error ?? "Could not send the message.");
        return;
      }

      setStreamingText("");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const processEvent = (event: ChatStreamEvent) => {
        switch (event.type) {
          case "user_message":
            setMessages((previous) =>
              previous.map((message) =>
                message.id === temporaryId
                  ? { ...event.message, attachments }
                  : message,
              ),
            );
            break;
          case "delta":
            assistantText += event.text;
            setStreamingText(assistantText);
            break;
          case "done":
            setStreamingText(null);
            setMessages((previous) => [...previous, event.message]);
            setUsage((previous) => ({
              ...previous,
              remaining: event.remaining,
              used: Math.max(previous.limit - event.remaining, 0),
            }));
            break;
          case "error":
            setStreamingText(null);
            setMessages((previous) => [
              ...previous,
              {
                id: `error-${Date.now()}`,
                conversation_id: conversation.id,
                user_id: conversation.user_id,
                role: "assistant",
                content: assistantText || null,
                status: "error",
                created_at: new Date().toISOString(),
              },
            ]);
            if (typeof event.remaining === "number") {
              setUsage((previous) => ({
                ...previous,
                remaining: event.remaining as number,
              }));
            }
            toast.error(event.message);
            break;
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            processEvent(JSON.parse(line) as ChatStreamEvent);
          } catch {
            // Ignore malformed stream fragments.
          }
        }
      }
    } catch (error) {
      setStreamingText(null);
      const wasAborted =
        controller.signal.aborted ||
        (error instanceof Error && error.name === "AbortError");

      if (wasAborted) {
        // User pressed stop: keep the partial answer (the server saves it too).
        if (assistantText) {
          setMessages((previous) => [
            ...previous,
            {
              id: `stopped-${Date.now()}`,
              conversation_id: conversation.id,
              user_id: conversation.user_id,
              role: "assistant",
              content: assistantText,
              status: "completed",
              created_at: new Date().toISOString(),
            },
          ]);
        }
        setUsage((previous) => ({
          ...previous,
          used: previous.used + 1,
          remaining: Math.max(previous.remaining - 1, 0),
        }));
      } else {
        toast.error("Connection lost while generating. Please try again.");
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  };

  const stop = () => {
    abortRef.current?.abort();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="hidden h-12 shrink-0 items-center border-b px-4 md:flex">
        <h1 className="truncate text-sm font-semibold">{title}</h1>
      </header>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto"
        aria-live="polite"
        aria-busy={isGenerating}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
          {messages.length === 0 && streamingText === null && (
            <p className="text-muted-foreground py-16 text-center text-sm">
              Send your first message to start the conversation.
            </p>
          )}
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {streamingText !== null && (
            <ChatMessage
              isStreaming
              message={{
                id: "streaming",
                conversation_id: conversation.id,
                user_id: conversation.user_id,
                role: "assistant",
                content: streamingText,
                status: "pending",
                created_at: new Date().toISOString(),
              }}
            />
          )}
        </div>
      </div>

      <ChatComposer
        conversationId={conversation.id}
        usage={usage}
        isGenerating={isGenerating}
        onSend={send}
        onStop={stop}
        model={model}
        onModelChange={setModel}
        initialText={initialPrompt}
      />
    </div>
  );
}
