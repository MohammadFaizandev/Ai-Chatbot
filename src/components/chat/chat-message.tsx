"use client";

import { TriangleAlert } from "lucide-react";

import { AttachmentImage } from "@/components/chat/attachment-image";
import { MarkdownResponse } from "@/components/chat/markdown-response";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/types/chat";

export function ChatMessage({
  message,
  isStreaming = false,
}: {
  message: ChatMessageType;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";
  const isError = message.status === "error";
  const isInterrupted = message.status === "pending" && !isStreaming;

  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "flex max-w-[85%] flex-col gap-2 rounded-xl px-3.5 py-2.5 sm:max-w-[75%]",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.attachments.map((attachment) => (
              <AttachmentImage key={attachment.id} attachment={attachment} />
            ))}
          </div>
        )}

        {isUser ? (
          message.content && (
            <p className="text-sm break-words whitespace-pre-wrap">
              {message.content}
            </p>
          )
        ) : (
          <>
            {message.content && <MarkdownResponse content={message.content} />}
            {isStreaming && (
              <span
                className="bg-foreground inline-block h-4 w-1.5 animate-pulse motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
            {isError && (
              <p className="text-destructive flex items-center gap-1.5 text-xs">
                <TriangleAlert className="size-3.5" aria-hidden="true" />
                This response failed to generate.
              </p>
            )}
            {isInterrupted && (
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <TriangleAlert className="size-3.5" aria-hidden="true" />
                This response was interrupted.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
