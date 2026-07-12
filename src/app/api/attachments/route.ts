import { NextResponse, type NextRequest } from "next/server";

import { ERRORS, jsonError, logServerError, requireUserId } from "@/lib/api";
import { serverEnv } from "@/lib/env";
import {
  CHAT_IMAGES_BUCKET,
  registerAttachment,
} from "@/lib/supabase/attachments";
import { getOwnedConversation } from "@/lib/supabase/conversations";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  attachmentRegisterSchema,
  isValidStoragePath,
  maxImageSizeBytes,
  sniffImageMimeType,
} from "@/lib/validation";
import type { AttachmentMeta } from "@/types/chat";

/**
 * Register an image the browser uploaded directly to the private
 * `chat-images` bucket (storage RLS already restricts uploads to the user's
 * own folder). The server re-verifies everything before trusting it:
 * ownership, path convention, declared size, and the REAL file type via
 * magic bytes. Invalid objects are deleted from storage immediately.
 */
export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return jsonError(401, ERRORS.unauthenticated);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, ERRORS.invalidInput);
  }

  const parsed = attachmentRegisterSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? ERRORS.invalidInput);
  }
  const { conversationId, storagePath, fileName, mimeType, sizeBytes } =
    parsed.data;

  const env = serverEnv();
  const maxBytes = maxImageSizeBytes(env.MAX_IMAGE_SIZE_MB);
  if (sizeBytes > maxBytes) {
    return jsonError(413, `Images must be smaller than ${env.MAX_IMAGE_SIZE_MB} MB.`);
  }

  if (!isValidStoragePath(storagePath, userId, conversationId, mimeType)) {
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

    // Verify the object really exists and inspect its actual bytes.
    const { data: blob, error: downloadError } = await supabase.storage
      .from(CHAT_IMAGES_BUCKET)
      .download(storagePath);
    if (downloadError || !blob) {
      return jsonError(404, "Uploaded file not found. Please try again.");
    }

    const reject = async (status: number, message: string) => {
      await supabase.storage.from(CHAT_IMAGES_BUCKET).remove([storagePath]);
      return jsonError(status, message);
    };

    if (blob.size > maxBytes) {
      return await reject(413, `Images must be smaller than ${env.MAX_IMAGE_SIZE_MB} MB.`);
    }

    const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    const sniffed = sniffImageMimeType(head);
    if (sniffed !== mimeType) {
      return await reject(400, "The file does not appear to be a valid image.");
    }

    const attachment = await registerAttachment(supabase, {
      conversationId,
      userId,
      storagePath,
      fileName,
      mimeType,
      sizeBytes: blob.size,
    });

    const meta: AttachmentMeta = {
      id: attachment.id,
      file_name: attachment.file_name,
      mime_type: attachment.mime_type,
      size_bytes: attachment.size_bytes,
    };
    return NextResponse.json({ attachment: meta }, { status: 201 });
  } catch (error) {
    logServerError("attachments_register", error);
    return jsonError(500, ERRORS.server);
  }
}
