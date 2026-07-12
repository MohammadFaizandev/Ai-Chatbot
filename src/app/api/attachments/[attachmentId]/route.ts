import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { ERRORS, jsonError, logServerError, requireUserId } from "@/lib/api";
import {
  CHAT_IMAGES_BUCKET,
  createSignedImageUrl,
} from "@/lib/supabase/attachments";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ attachmentId: string }> };

const attachmentIdSchema = z.uuid();

/**
 * GET returns a short-lived signed URL so previously sent images can be
 * displayed. The URL expires in minutes and is never stored.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const userId = await requireUserId();
  if (!userId) return jsonError(401, ERRORS.unauthenticated);

  const { attachmentId } = await params;
  if (!attachmentIdSchema.safeParse(attachmentId).success) {
    return jsonError(400, ERRORS.invalidInput);
  }

  try {
    const supabase = createServerSupabaseClient();
    const { data: attachment, error } = await supabase
      .from("attachments")
      .select("*")
      .eq("id", attachmentId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!attachment) return jsonError(404, ERRORS.attachmentNotFound);

    const url = await createSignedImageUrl(supabase, attachment.storage_path);
    return NextResponse.json({ url });
  } catch (error) {
    logServerError("attachments_signed_url", error);
    return jsonError(500, ERRORS.server);
  }
}

/**
 * DELETE removes a not-yet-sent attachment (preview removed before sending).
 * Attachments already linked to a message are kept for history integrity.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const userId = await requireUserId();
  if (!userId) return jsonError(401, ERRORS.unauthenticated);

  const { attachmentId } = await params;
  if (!attachmentIdSchema.safeParse(attachmentId).success) {
    return jsonError(400, ERRORS.invalidInput);
  }

  try {
    const supabase = createServerSupabaseClient();
    const { data: attachment, error } = await supabase
      .from("attachments")
      .select("*")
      .eq("id", attachmentId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!attachment) return jsonError(404, ERRORS.attachmentNotFound);
    if (attachment.message_id) {
      return jsonError(409, "This image was already sent and cannot be removed.");
    }

    await supabase.storage
      .from(CHAT_IMAGES_BUCKET)
      .remove([attachment.storage_path]);

    const { error: deleteError } = await supabase
      .from("attachments")
      .delete()
      .eq("id", attachmentId)
      .eq("user_id", userId);
    if (deleteError) throw new Error(deleteError.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    logServerError("attachments_delete", error);
    return jsonError(500, ERRORS.server);
  }
}
