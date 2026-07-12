import "server-only";

import type { AttachmentRow } from "@/types/database";

import type { TypedSupabaseClient } from "./server";

export const CHAT_IMAGES_BUCKET = "chat-images";

/** Seconds a signed image URL stays valid (short-lived by design). */
export const SIGNED_URL_TTL_SECONDS = 300;

export async function registerAttachment(
  supabase: TypedSupabaseClient,
  attachment: {
    conversationId: string;
    userId: string;
    storagePath: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  },
): Promise<AttachmentRow> {
  const { data, error } = await supabase
    .from("attachments")
    .insert({
      conversation_id: attachment.conversationId,
      user_id: attachment.userId,
      storage_path: attachment.storagePath,
      file_name: attachment.fileName,
      mime_type: attachment.mimeType,
      size_bytes: attachment.sizeBytes,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save attachment: ${error.message}`);
  return data;
}

/** Fetch attachments by id, verifying user AND conversation ownership. */
export async function getOwnedAttachments(
  supabase: TypedSupabaseClient,
  userId: string,
  conversationId: string,
  attachmentIds: string[],
): Promise<AttachmentRow[]> {
  if (attachmentIds.length === 0) return [];

  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .in("id", attachmentIds)
    .eq("user_id", userId)
    .eq("conversation_id", conversationId);

  if (error) throw new Error(`Failed to load attachments: ${error.message}`);
  return data;
}

export async function linkAttachmentsToMessage(
  supabase: TypedSupabaseClient,
  userId: string,
  attachmentIds: string[],
  messageId: string,
): Promise<void> {
  if (attachmentIds.length === 0) return;

  const { error } = await supabase
    .from("attachments")
    .update({ message_id: messageId })
    .in("id", attachmentIds)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to link attachments: ${error.message}`);
}

export async function listConversationAttachments(
  supabase: TypedSupabaseClient,
  userId: string,
  conversationId: string,
): Promise<AttachmentRow[]> {
  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to list attachments: ${error.message}`);
  return data;
}

/** Short-lived signed URL for a private image (never persisted or logged). */
export async function createSignedImageUrl(
  supabase: TypedSupabaseClient,
  storagePath: string,
  expiresInSeconds = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CHAT_IMAGES_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${error?.message ?? "unknown"}`);
  }
  return data.signedUrl;
}

/**
 * Remove all stored images for a conversation. Called before deleting the
 * conversation row (which cascades the attachment rows). Storage failures
 * are reported but must not block the database deletion.
 */
export async function deleteConversationImages(
  supabase: TypedSupabaseClient,
  userId: string,
  conversationId: string,
): Promise<{ failedPaths: string[] }> {
  const attachments = await listConversationAttachments(
    supabase,
    userId,
    conversationId,
  );
  const paths = attachments.map((attachment) => attachment.storage_path);
  if (paths.length === 0) return { failedPaths: [] };

  const { error } = await supabase.storage
    .from(CHAT_IMAGES_BUCKET)
    .remove(paths);

  return { failedPaths: error ? paths : [] };
}
