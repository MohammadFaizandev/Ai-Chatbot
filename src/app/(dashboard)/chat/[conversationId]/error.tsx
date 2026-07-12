"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ConversationError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Could not load this conversation</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        Something went wrong while loading the messages. Try again, or go back
        to your conversations.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" render={<Link href="/chat" />}>
          Back to chat
        </Button>
      </div>
    </div>
  );
}
