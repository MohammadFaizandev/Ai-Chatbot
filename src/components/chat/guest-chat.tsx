"use client";

import { SendHorizontal, Square } from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/brand-logo";
import { ChatMessage } from "@/components/chat/chat-message";
import { ModelPicker } from "@/components/chat/model-picker";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { useSelectedModel } from "@/hooks/use-selected-model";
import { APP_NAME } from "@/lib/brand";
import { CLIENT_MAX_MESSAGE_LENGTH } from "@/lib/client-config";
import type {
  ChatMessage as ChatMessageType,
  GuestChatMessage,
  GuestChatStreamEvent,
} from "@/types/chat";

const STORAGE_KEY = "guest-chat-transcript";
const MAX_TEXTAREA_HEIGHT_PX = 200;
/** Client-side cap on transcript entries sent as context (server re-caps). */
const MAX_SENT_MESSAGES = 20;

/** Adapt a browser-only guest message to the shared bubble component. */
function toChatMessage(message: GuestChatMessage): ChatMessageType {
  return {
    id: message.id,
    conversation_id: "guest",
    user_id: "guest",
    role: message.role,
    content: message.content,
    status: message.status,
    created_at: new Date(0).toISOString(),
  };
}

export function GuestChat({
  initialRemaining,
  limit,
  signedInLimit,
}: {
  initialRemaining: number;
  limit: number;
  signedInLimit: number;
}) {
  const [messages, setMessages] = useState<GuestChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [text, setText] = useState("");
  const [model, setModel] = useSelectedModel();
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { containerRef, handleScroll } = useChatScroll(
    `${messages.length}:${streamingText?.length ?? 0}`,
  );

  // Restore the transcript for this browser session. Must run after mount
  // (sessionStorage does not exist on the server, and reading it in a state
  // initializer would cause a hydration mismatch).
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore of persisted state after mount
        setMessages(JSON.parse(stored) as GuestChatMessage[]);
      }
    } catch {
      // Unavailable or corrupt storage — start empty.
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // Best effort only.
    }
  }, [messages]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
  }, [text]);

  const limitReached = remaining <= 0;
  const trimmed = text.trim();
  const canSend = !isGenerating && !limitReached && trimmed.length > 0;

  const send = async () => {
    if (!canSend) return;
    setIsGenerating(true);
    setText("");

    const userMessage: GuestChatMessage = {
      id: `guest-user-${Date.now()}`,
      role: "user",
      content: trimmed,
      status: "completed",
    };
    const transcript = [...messages, userMessage];
    setMessages(transcript);

    const controller = new AbortController();
    abortRef.current = controller;
    let assistantText = "";

    try {
      const response = await fetch("/api/guest-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: transcript
            .slice(-MAX_SENT_MESSAGES)
            .map(({ role, content }) => ({ role, content })),
          model,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setMessages((previous) =>
          previous.filter((message) => message.id !== userMessage.id),
        );
        if (response.status === 429) setRemaining(0);
        toast.error(body?.error ?? "Could not send the message.");
        return;
      }

      setStreamingText("");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const processEvent = (event: GuestChatStreamEvent) => {
        switch (event.type) {
          case "delta":
            assistantText += event.text;
            setStreamingText(assistantText);
            break;
          case "done":
            setStreamingText(null);
            setMessages((previous) => [
              ...previous,
              {
                id: `guest-assistant-${Date.now()}`,
                role: "assistant",
                content: assistantText,
                status: "completed",
              },
            ]);
            setRemaining(event.remaining);
            break;
          case "error":
            setStreamingText(null);
            setMessages((previous) => [
              ...previous,
              {
                id: `guest-error-${Date.now()}`,
                role: "assistant",
                content: assistantText,
                status: "error",
              },
            ]);
            setRemaining(event.remaining);
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
            processEvent(JSON.parse(line) as GuestChatStreamEvent);
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
        if (assistantText) {
          setMessages((previous) => [
            ...previous,
            {
              id: `guest-stopped-${Date.now()}`,
              role: "assistant",
              content: assistantText,
              status: "completed",
            },
          ]);
        }
        setRemaining((previous) => Math.max(previous - 1, 0));
      } else {
        toast.error("Connection lost while generating. Please try again.");
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  };

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    void send();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <BrandLogo className="size-7" />
          {APP_NAME}
          <span className="text-muted-foreground text-xs font-normal">
            · Guest mode
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" render={<Link href="/sign-in" />}>
            Sign in
          </Button>
          <Button size="sm" render={<Link href="/sign-up" />}>
            Sign up free
          </Button>
        </div>
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
            <div className="flex flex-col items-center justify-center py-28 text-center">
              <BrandLogo className="size-20 rounded-3xl" />
              <h1 className="mt-6 text-2xl font-semibold tracking-tight">
                How can I help you today?
              </h1>
              <p className="text-muted-foreground mt-2 max-w-md text-sm">
                {limit} free messages per day, no account needed.
              </p>
            </div>
          )}
          {messages.map((message) => (
            <ChatMessage key={message.id} message={toChatMessage(message)} />
          ))}
          {streamingText !== null && (
            <ChatMessage
              isStreaming
              message={{
                ...toChatMessage({
                  id: "guest-streaming",
                  role: "assistant",
                  content: streamingText,
                  status: "completed",
                }),
                status: "pending",
              }}
            />
          )}
          {limitReached && (
            <div className="bg-card mx-auto w-full max-w-md rounded-xl border p-4 text-center">
              <p className="text-sm font-medium">
                You&apos;ve used today&apos;s {limit} free guest messages.
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Create a free account for {signedInLimit} messages per day,
                saved history, and image analysis.
              </p>
              <Button className="mt-3" render={<Link href="/sign-up" />}>
                Sign up free
              </Button>
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-background border-t p-3 sm:p-4"
        aria-label="Message composer"
      >
        <div className="bg-muted/40 focus-within:ring-ring/50 mx-auto flex w-full max-w-3xl items-end gap-1.5 rounded-xl border p-2 focus-within:ring-2">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={CLIENT_MAX_MESSAGE_LENGTH}
            placeholder={
              limitReached
                ? "Guest limit reached — sign up free to continue"
                : "Ask anything… (Enter to send, Shift+Enter for a new line)"
            }
            disabled={limitReached}
            aria-label="Message"
            className="max-h-[200px] min-h-9 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          {isGenerating ? (
            <Button
              type="button"
              variant="destructive"
              size="icon-sm"
              onClick={() => abortRef.current?.abort()}
              aria-label="Stop generating"
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon-sm"
              disabled={!canSend}
              aria-label="Send message"
            >
              <SendHorizontal className="size-4" />
            </Button>
          )}
        </div>
        <div className="mx-auto mt-1 flex w-full max-w-3xl items-center justify-between gap-2 px-1">
          <ModelPicker
            value={model}
            onChange={setModel}
            disabled={isGenerating}
          />
          <p className="text-muted-foreground text-xs" aria-live="polite">
            {limitReached
              ? "Free guest messages used up — resets at midnight UTC."
              : `${remaining} of ${limit} left · `}
            {!limitReached && (
              <Link href="/sign-up" className="underline underline-offset-2">
                Sign up for {signedInLimit}/day
              </Link>
            )}
          </p>
        </div>
      </form>
    </div>
  );
}
