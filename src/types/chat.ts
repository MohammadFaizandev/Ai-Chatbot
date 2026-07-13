import type { AttachmentRow, MessageRow } from "./database";

/** A message as rendered in the chat UI, with any linked attachments. */
export type ChatMessage = MessageRow & {
  attachments?: AttachmentMeta[];
};

/** Attachment metadata safe to send to the browser (no signed URLs stored). */
export type AttachmentMeta = Pick<
  AttachmentRow,
  "id" | "file_name" | "mime_type" | "size_bytes"
>;

/** Server-sent events emitted by the streaming chat API. */
export type ChatStreamEvent =
  | { type: "user_message"; message: MessageRow }
  | { type: "delta"; text: string }
  | { type: "done"; message: MessageRow; remaining: number }
  | { type: "error"; message: string; remaining?: number };

export type UsageInfo = {
  used: number;
  limit: number;
  remaining: number;
};

/** Events emitted by the guest (no-account) streaming chat API. */
export type GuestChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; remaining: number }
  | { type: "error"; message: string; remaining: number };

/** A guest chat message held only in the browser (never persisted). */
export type GuestChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "completed" | "error";
};

/**
 * An in-thread marker shown when the user switches models mid-conversation.
 * Lives only in client state — never sent to the AI or persisted.
 */
export type ModelChangeMarker = {
  kind: "model-change";
  id: string;
  modelLabel: string;
};

export function isModelChangeMarker(item: object): item is ModelChangeMarker {
  return "kind" in item && item.kind === "model-change";
}
