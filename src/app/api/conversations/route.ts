import { NextResponse } from "next/server";

import { ERRORS, jsonError, logServerError, requireUserId } from "@/lib/api";
import {
  createConversation,
  listConversations,
} from "@/lib/supabase/conversations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError(401, ERRORS.unauthenticated);

  try {
    const supabase = createServerSupabaseClient();
    const conversations = await listConversations(supabase, userId);
    return NextResponse.json({ conversations });
  } catch (error) {
    logServerError("conversations_list", error);
    return jsonError(500, ERRORS.server);
  }
}

export async function POST() {
  const userId = await requireUserId();
  if (!userId) return jsonError(401, ERRORS.unauthenticated);

  try {
    const supabase = createServerSupabaseClient();
    const conversation = await createConversation(supabase, userId);
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    logServerError("conversations_create", error);
    return jsonError(500, ERRORS.server);
  }
}
