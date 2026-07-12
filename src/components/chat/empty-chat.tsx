"use client";

import { Lightbulb, MessageSquareText } from "lucide-react";

import { useConversations } from "@/components/chat/conversations-provider";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/brand";

export const PENDING_PROMPT_STORAGE_KEY = "nova:pending-prompt";

const EXAMPLE_PROMPTS = [
  "Explain how JWT authentication works, with a diagram in a table.",
  "Write a SQL query that finds duplicate emails in a users table.",
  "Summarize the pros and cons of server components in Next.js.",
  "Help me debug: my React state updates one render too late.",
] as const;

export function EmptyChat() {
  const { createConversation, isCreating } = useConversations();

  const startWithPrompt = async (prompt?: string) => {
    if (prompt) {
      try {
        sessionStorage.setItem(PENDING_PROMPT_STORAGE_KEY, prompt);
      } catch {
        // sessionStorage unavailable — the user can retype the prompt.
      }
    }
    await createConversation();
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-10 text-center">
      <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl">
        <MessageSquareText className="size-6" aria-hidden="true" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome to {APP_NAME}
        </h1>
        <p className="text-muted-foreground mt-1">
          Start a new conversation, or try one of these prompts:
        </p>
      </div>

      <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <Button
            key={prompt}
            variant="outline"
            disabled={isCreating}
            onClick={() => startWithPrompt(prompt)}
            className="h-auto justify-start px-3 py-3 text-left whitespace-normal"
          >
            <Lightbulb
              className="text-muted-foreground size-4 shrink-0"
              aria-hidden="true"
            />
            <span className="text-sm">{prompt}</span>
          </Button>
        ))}
      </div>

      <Button
        size="lg"
        onClick={() => startWithPrompt()}
        disabled={isCreating}
      >
        {isCreating ? "Creating…" : "Start a new chat"}
      </Button>
    </div>
  );
}
