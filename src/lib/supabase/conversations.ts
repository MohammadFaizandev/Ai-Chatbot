import "server-only";

import type { ConversationRow } from "@/types/database";

import type { TypedSupabaseClient } from "./server";

/**
 * Conversation data access. RLS already restricts rows to the authenticated
 * user, but every query ALSO filters by user_id explicitly (defense in
 * depth, and correctness even if a policy regressed).
 */

const CONVERSATION_LIST_LIMIT = 100;

export async function listConversations(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<ConversationRow[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(CONVERSATION_LIST_LIMIT);

  if (error) throw new Error(`Failed to list conversations: ${error.message}`);
  return data;
}

export async function getOwnedConversation(
  supabase: TypedSupabaseClient,
  userId: string,
  conversationId: string,
): Promise<ConversationRow | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load conversation: ${error.message}`);
  return data;
}

export async function createConversation(
  supabase: TypedSupabaseClient,
  userId: string,
  title = "New Conversation",
): Promise<ConversationRow> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: userId, title })
    .select()
    .single();

  if (error) throw new Error(`Failed to create conversation: ${error.message}`);
  return data;
}

export async function renameConversation(
  supabase: TypedSupabaseClient,
  userId: string,
  conversationId: string,
  title: string,
): Promise<ConversationRow | null> {
  const { data, error } = await supabase
    .from("conversations")
    .update({ title })
    .eq("id", conversationId)
    .eq("user_id", userId)
    .select()
    .maybeSingle();

  if (error) throw new Error(`Failed to rename conversation: ${error.message}`);
  return data;
}

export async function deleteConversation(
  supabase: TypedSupabaseClient,
  userId: string,
  conversationId: string,
): Promise<void> {
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to delete conversation: ${error.message}`);
}

/** Bump updated_at so the conversation sorts to the top of the list. */
export async function touchConversation(
  supabase: TypedSupabaseClient,
  userId: string,
  conversationId: string,
): Promise<void> {
  const { error } = await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to touch conversation: ${error.message}`);
}
