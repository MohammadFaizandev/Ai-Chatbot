import "server-only";

import { serverEnv } from "@/lib/env";
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import type { UsageInfo } from "@/types/chat";

/**
 * Daily message limit, enforced server-side through atomic SQL functions
 * (see supabase/migrations/001_initial_schema.sql). The day boundary is UTC.
 */

export async function getUsageInfo(
  supabase: TypedSupabaseClient,
): Promise<UsageInfo> {
  const limit = serverEnv().DAILY_MESSAGE_LIMIT;
  const { data, error } = await supabase.rpc("get_daily_usage");

  if (error || typeof data !== "number") {
    throw new Error(`Failed to read usage: ${error?.message ?? "unknown"}`);
  }
  return { used: data, limit, remaining: Math.max(limit - data, 0) };
}

export type UsageReservation =
  | { allowed: true; remaining: number; eventId: string }
  | { allowed: false; remaining: 0 };

/** Atomically reserve one message from today's allowance. */
export async function consumeDailyUsage(
  supabase: TypedSupabaseClient,
  conversationId: string,
): Promise<UsageReservation> {
  const limit = serverEnv().DAILY_MESSAGE_LIMIT;
  const { data, error } = await supabase.rpc("consume_daily_usage", {
    p_limit: limit,
    p_conversation_id: conversationId,
  });

  const row = data?.[0];
  if (error || !row) {
    throw new Error(`Failed to reserve usage: ${error?.message ?? "unknown"}`);
  }

  if (!row.allowed || !row.event_id) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: row.remaining, eventId: row.event_id };
}

/** Record the generation outcome. Never refunds allowance (see migration). */
export async function finalizeUsageEvent(
  supabase: TypedSupabaseClient,
  eventId: string,
  status: "completed" | "error",
): Promise<void> {
  const { error } = await supabase.rpc("finalize_usage_event", {
    p_event_id: eventId,
    p_status: status,
  });
  if (error) {
    // Non-fatal: the reservation already counted; only the audit status is lost.
    console.error(`finalize_usage_event failed: ${error.message}`);
  }
}
