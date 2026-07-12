import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { ERRORS, jsonError, logServerError, requireUserId } from "@/lib/api";
import { deleteConversationImages } from "@/lib/supabase/attachments";
import {
  deleteConversation,
  getOwnedConversation,
  renameConversation,
} from "@/lib/supabase/conversations";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { renameConversationSchema } from "@/lib/validation";

type RouteParams = { params: Promise<{ conversationId: string }> };

const conversationIdSchema = z.uuid();

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const userId = await requireUserId();
  if (!userId) return jsonError(401, ERRORS.unauthenticated);

  const { conversationId } = await params;
  if (!conversationIdSchema.safeParse(conversationId).success) {
    return jsonError(400, ERRORS.invalidInput);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, ERRORS.invalidInput);
  }

  const parsed = renameConversationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? ERRORS.invalidInput);
  }

  try {
    const supabase = createServerSupabaseClient();
    const conversation = await renameConversation(
      supabase,
      userId,
      conversationId,
      parsed.data.title,
    );
    if (!conversation) return jsonError(404, ERRORS.notFound);
    return NextResponse.json({ conversation });
  } catch (error) {
    logServerError("conversations_rename", error);
    return jsonError(500, ERRORS.server);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const userId = await requireUserId();
  if (!userId) return jsonError(401, ERRORS.unauthenticated);

  const { conversationId } = await params;
  if (!conversationIdSchema.safeParse(conversationId).success) {
    return jsonError(400, ERRORS.invalidInput);
  }

  try {
    const supabase = createServerSupabaseClient();
    const conversation = await getOwnedConversation(
      supabase,
      userId,
      conversationId,
    );
    if (!conversation) return jsonError(404, ERRORS.notFound);

    // Best-effort image cleanup first; DB cascade removes the metadata rows.
    const { failedPaths } = await deleteConversationImages(
      supabase,
      userId,
      conversationId,
    );
    if (failedPaths.length > 0) {
      logServerError(
        "conversations_delete_storage",
        new Error(`${failedPaths.length} storage object(s) not removed`),
      );
    }

    await deleteConversation(supabase, userId, conversationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logServerError("conversations_delete", error);
    return jsonError(500, ERRORS.server);
  }
}
