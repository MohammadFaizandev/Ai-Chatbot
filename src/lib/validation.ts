import { z } from "zod";

/**
 * Shared validation logic. Pure and framework-free so it is easy to unit
 * test. Server routes must always re-validate — never trust the client.
 */

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

const MIME_TO_EXTENSION: Record<AllowedImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const EXTENSION_TO_MIME: Record<string, AllowedImageMimeType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const CONVERSATION_TITLE_MAX_LENGTH = 120;

export function isAllowedImageMimeType(
  mime: string,
): mime is AllowedImageMimeType {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mime);
}

export function extensionForMimeType(mime: string): string | null {
  return isAllowedImageMimeType(mime) ? MIME_TO_EXTENSION[mime] : null;
}

/** File extension and MIME type must both be allowed AND agree. */
export function fileExtensionMatchesMime(
  fileName: string,
  mime: string,
): boolean {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TO_MIME[extension] === mime;
}

export function maxImageSizeBytes(maxImageSizeMb: number): number {
  return Math.floor(maxImageSizeMb * 1024 * 1024);
}

export type ImageValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validateImageFile(
  file: { name: string; type: string; size: number },
  maxImageSizeMb: number,
): ImageValidationResult {
  if (!isAllowedImageMimeType(file.type)) {
    return {
      ok: false,
      reason: "Only JPEG, PNG, and WebP images are supported.",
    };
  }
  if (!fileExtensionMatchesMime(file.name, file.type)) {
    return {
      ok: false,
      reason: "The file extension does not match the image type.",
    };
  }
  if (file.size <= 0) {
    return { ok: false, reason: "The selected file is empty." };
  }
  if (file.size > maxImageSizeBytes(maxImageSizeMb)) {
    return {
      ok: false,
      reason: `Images must be smaller than ${maxImageSizeMb} MB.`,
    };
  }
  return { ok: true };
}

/**
 * Detect the real image type from magic bytes so a renamed file cannot fake
 * its MIME type. Returns null for anything that is not JPEG/PNG/WebP.
 */
export function sniffImageMimeType(
  bytes: Uint8Array,
): AllowedImageMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && pngMagic.every((value, index) => bytes[index] === value)) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Validate a client-supplied storage path against the required convention
 * {clerkUserId}/{conversationId}/{uuid}.{ext} for this exact user/conversation.
 */
export function isValidStoragePath(
  storagePath: string,
  userId: string,
  conversationId: string,
  mimeType: string,
): boolean {
  const segments = storagePath.split("/");
  if (segments.length !== 3) return false;
  const [pathUser, pathConversation, objectName] = segments;
  if (pathUser !== userId || pathConversation !== conversationId) return false;

  const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([a-z0-9]+)$/.exec(
    objectName,
  );
  if (!match) return false;
  return EXTENSION_TO_MIME[match[2]] === mimeType;
}

/**
 * Generate a short conversation title locally from the first user message —
 * no AI call. Collapses whitespace and cuts at a word boundary.
 */
export function generateLocalTitle(text: string, maxLength = 48): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length === 0) return "New Conversation";
  if (collapsed.length <= maxLength) return collapsed;

  const cut = collapsed.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}

// ---------------------------------------------------------------------------
// API payload schemas
// ---------------------------------------------------------------------------

export const conversationTitleSchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(
    z
      .string()
      .min(1, "Title cannot be empty.")
      .max(
        CONVERSATION_TITLE_MAX_LENGTH,
        `Title must be at most ${CONVERSATION_TITLE_MAX_LENGTH} characters.`,
      ),
  );

export const renameConversationSchema = z.object({
  title: conversationTitleSchema,
});

export function chatRequestSchema(maxMessageLength: number) {
  return z.object({
    conversationId: z.uuid("Invalid conversation id."),
    message: z
      .string()
      .max(
        maxMessageLength,
        `Messages must be at most ${maxMessageLength} characters.`,
      ),
    attachmentIds: z.array(z.uuid()).max(10).default([]),
  });
}

/**
 * Guest (no-account) chat payload: the browser holds the history, so the
 * request carries the recent transcript. The last entry must be the new
 * user message; the server re-caps count and length.
 */
export function guestChatRequestSchema(
  maxMessageLength: number,
  maxContextMessages: number,
) {
  return z.object({
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z
            .string()
            .max(
              maxMessageLength,
              `Messages must be at most ${maxMessageLength} characters.`,
            ),
        }),
      )
      .min(1, "Send at least one message.")
      .max(maxContextMessages),
  });
}

export const IMAGE_PROMPT_MAX_LENGTH = 500;

/** Text-to-image generation request (Pollinations, server-proxied). */
export const imageGenerationSchema = z.object({
  prompt: z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(1, "Describe the image you want to generate.")
        .max(
          IMAGE_PROMPT_MAX_LENGTH,
          `Prompt must be at most ${IMAGE_PROMPT_MAX_LENGTH} characters.`,
        ),
    ),
});

export const attachmentRegisterSchema = z.object({
  conversationId: z.uuid("Invalid conversation id."),
  storagePath: z.string().min(1).max(300),
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_IMAGE_MIME_TYPES),
  sizeBytes: z.number().int().positive(),
});

/** Empty text is only acceptable when at least one image is attached. */
export function isSendableMessage(
  text: string,
  attachmentCount: number,
): boolean {
  return text.trim().length > 0 || attachmentCount > 0;
}
