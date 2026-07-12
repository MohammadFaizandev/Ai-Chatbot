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
