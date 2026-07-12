import "server-only";

import type { MessageRow, MessageStatus } from "@/types/database";

import type { TypedSupabaseClient } from "./server";

export async function listMessages(
  supabase: TypedSupabaseClient,
  userId: string,
  conversationId: string,
): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to list messages: ${error.message}`);
  return data;
}

/**
 * The most recent completed messages, oldest-first, for the AI context
 * window. Only role/content leave the database — no ids or timestamps are
 * sent to the AI provider.
 */
export async function listRecentContextMessages(
  supabase: TypedSupabaseClient,
  userId: string,
  conversationId: string,
  maxMessages: number,
): Promise<Pick<MessageRow, "role" | "content">[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(maxMessages);

  if (error) throw new Error(`Failed to load context: ${error.message}`);
  return data
    .reverse()
    .map(({ role, content }) => ({ role, content }))
    .filter((message) => (message.content ?? "").length > 0);
}

export async function insertMessage(
  supabase: TypedSupabaseClient,
  message: {
    conversationId: string;
    userId: string;
    role: "user" | "assistant";
    content: string | null;
    status: MessageStatus;
  },
): Promise<MessageRow> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: message.conversationId,
      user_id: message.userId,
      role: message.role,
      content: message.content,
      status: message.status,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save message: ${error.message}`);
  return data;
}

export async function updateMessage(
  supabase: TypedSupabaseClient,
  userId: string,
  messageId: string,
  update: { content?: string | null; status?: MessageStatus },
): Promise<MessageRow | null> {
  const { data, error } = await supabase
    .from("messages")
    .update(update)
    .eq("id", messageId)
    .eq("user_id", userId)
    .select()
    .maybeSingle();

  if (error) throw new Error(`Failed to update message: ${error.message}`);
  return data;
}
