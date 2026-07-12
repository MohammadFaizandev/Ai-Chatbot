import { describe, expect, it } from "vitest";

import {
  ALLOWED_IMAGE_MIME_TYPES,
  attachmentRegisterSchema,
  chatRequestSchema,
  CONVERSATION_TITLE_MAX_LENGTH,
  conversationTitleSchema,
  extensionForMimeType,
  fileExtensionMatchesMime,
  generateLocalTitle,
  isAllowedImageMimeType,
  isSendableMessage,
  isValidStoragePath,
  maxImageSizeBytes,
  sniffImageMimeType,
  validateImageFile,
} from "@/lib/validation";

const USER_ID = "user_2abcDEFghij";
const CONVERSATION_ID = "1c9f8f6a-3f2b-4e51-9d3c-2f6a8b7c5d4e";
const UUID_NAME = "9b2f4a1e-8d3c-4b5a-9e6f-1a2b3c4d5e6f";

describe("image MIME validation", () => {
  it("accepts only JPEG, PNG, and WebP", () => {
    expect(ALLOWED_IMAGE_MIME_TYPES).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    expect(isAllowedImageMimeType("image/png")).toBe(true);
    expect(isAllowedImageMimeType("image/gif")).toBe(false);
    expect(isAllowedImageMimeType("application/pdf")).toBe(false);
  });

  it("maps MIME types to extensions", () => {
    expect(extensionForMimeType("image/jpeg")).toBe("jpg");
    expect(extensionForMimeType("image/png")).toBe("png");
    expect(extensionForMimeType("image/webp")).toBe("webp");
    expect(extensionForMimeType("image/gif")).toBeNull();
  });

  it("requires the extension to match the MIME type", () => {
    expect(fileExtensionMatchesMime("photo.jpg", "image/jpeg")).toBe(true);
    expect(fileExtensionMatchesMime("photo.JPEG", "image/jpeg")).toBe(true);
    expect(fileExtensionMatchesMime("photo.png", "image/jpeg")).toBe(false);
    expect(fileExtensionMatchesMime("photo", "image/png")).toBe(false);
    expect(fileExtensionMatchesMime("archive.png.exe", "image/png")).toBe(false);
  });
});

describe("image size validation", () => {
  it("converts MB limits to bytes", () => {
    expect(maxImageSizeBytes(5)).toBe(5 * 1024 * 1024);
    expect(maxImageSizeBytes(0.5)).toBe(512 * 1024);
  });

  it("rejects oversized files", () => {
    const file = { name: "big.png", type: "image/png", size: 6 * 1024 * 1024 };
    const result = validateImageFile(file, 5);
    expect(result.ok).toBe(false);
  });

  it("rejects empty files and accepts valid ones", () => {
    expect(
      validateImageFile({ name: "a.png", type: "image/png", size: 0 }, 5).ok,
    ).toBe(false);
    expect(
      validateImageFile({ name: "a.png", type: "image/png", size: 1000 }, 5).ok,
    ).toBe(true);
  });

  it("rejects disallowed types and mismatched extensions", () => {
    expect(
      validateImageFile({ name: "a.gif", type: "image/gif", size: 10 }, 5).ok,
    ).toBe(false);
    expect(
      validateImageFile({ name: "a.png", type: "image/jpeg", size: 10 }, 5).ok,
    ).toBe(false);
  });
});

describe("magic-byte sniffing", () => {
  it("detects JPEG", () => {
    expect(sniffImageMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      "image/jpeg",
    );
  });

  it("detects PNG", () => {
    expect(
      sniffImageMimeType(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe("image/png");
  });

  it("detects WebP (RIFF....WEBP)", () => {
    const bytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(sniffImageMimeType(bytes)).toBe("image/webp");
  });

  it("rejects fakes (renamed text file)", () => {
    const bytes = new TextEncoder().encode("<script>alert(1)</script>");
    expect(sniffImageMimeType(bytes)).toBeNull();
  });

  it("rejects truncated headers", () => {
    expect(sniffImageMimeType(new Uint8Array([0xff]))).toBeNull();
    expect(sniffImageMimeType(new Uint8Array([]))).toBeNull();
  });
});

describe("storage path validation", () => {
  const validPath = `${USER_ID}/${CONVERSATION_ID}/${UUID_NAME}.png`;

  it("accepts the canonical convention", () => {
    expect(
      isValidStoragePath(validPath, USER_ID, CONVERSATION_ID, "image/png"),
    ).toBe(true);
  });

  it("rejects another user's folder", () => {
    expect(
      isValidStoragePath(validPath, "user_other", CONVERSATION_ID, "image/png"),
    ).toBe(false);
  });

  it("rejects another conversation's folder", () => {
    expect(
      isValidStoragePath(
        validPath,
        USER_ID,
        "2c9f8f6a-3f2b-4e51-9d3c-2f6a8b7c5d4e",
        "image/png",
      ),
    ).toBe(false);
  });

  it("rejects traversal, wrong depth, and non-UUID names", () => {
    expect(
      isValidStoragePath(
        `${USER_ID}/../${CONVERSATION_ID}/${UUID_NAME}.png`,
        USER_ID,
        CONVERSATION_ID,
        "image/png",
      ),
    ).toBe(false);
    expect(
      isValidStoragePath(
        `${USER_ID}/${CONVERSATION_ID}/nested/${UUID_NAME}.png`,
        USER_ID,
        CONVERSATION_ID,
        "image/png",
      ),
    ).toBe(false);
    expect(
      isValidStoragePath(
        `${USER_ID}/${CONVERSATION_ID}/evil.png`,
        USER_ID,
        CONVERSATION_ID,
        "image/png",
      ),
    ).toBe(false);
  });

  it("rejects extension/MIME mismatch", () => {
    expect(
      isValidStoragePath(validPath, USER_ID, CONVERSATION_ID, "image/jpeg"),
    ).toBe(false);
  });
});

describe("local title generation", () => {
  it("uses the message text for short messages", () => {
    expect(generateLocalTitle("Hello world")).toBe("Hello world");
  });

  it("collapses whitespace", () => {
    expect(generateLocalTitle("  Hello \n\n  world  ")).toBe("Hello world");
  });

  it("falls back for empty input", () => {
    expect(generateLocalTitle("   \n ")).toBe("New Conversation");
  });

  it("truncates long messages at a word boundary with an ellipsis", () => {
    const title = generateLocalTitle(
      "This is a very long first message that should be shortened to a compact conversation title",
    );
    expect(title.length).toBeLessThanOrEqual(49);
    expect(title.endsWith("…")).toBe(true);
    expect(title).not.toContain("  ");
  });
});

describe("conversation title schema", () => {
  it("trims and accepts valid titles", () => {
    const parsed = conversationTitleSchema.parse("  My chat  ");
    expect(parsed).toBe("My chat");
  });

  it("rejects empty titles", () => {
    expect(conversationTitleSchema.safeParse("   ").success).toBe(false);
  });

  it("rejects overlong titles", () => {
    const long = "x".repeat(CONVERSATION_TITLE_MAX_LENGTH + 1);
    expect(conversationTitleSchema.safeParse(long).success).toBe(false);
  });
});

describe("chat request schema", () => {
  const schema = chatRequestSchema(100);

  it("accepts a valid payload and defaults attachmentIds", () => {
    const parsed = schema.parse({
      conversationId: CONVERSATION_ID,
      message: "Hi",
    });
    expect(parsed.attachmentIds).toEqual([]);
  });

  it("rejects non-UUID conversation ids", () => {
    expect(
      schema.safeParse({ conversationId: "abc", message: "Hi" }).success,
    ).toBe(false);
  });

  it("enforces the message length limit", () => {
    expect(
      schema.safeParse({
        conversationId: CONVERSATION_ID,
        message: "x".repeat(101),
      }).success,
    ).toBe(false);
  });
});

describe("attachment register schema", () => {
  it("rejects disallowed MIME types", () => {
    expect(
      attachmentRegisterSchema.safeParse({
        conversationId: CONVERSATION_ID,
        storagePath: "a/b/c.gif",
        fileName: "c.gif",
        mimeType: "image/gif",
        sizeBytes: 10,
      }).success,
    ).toBe(false);
  });

  it("rejects non-positive sizes", () => {
    expect(
      attachmentRegisterSchema.safeParse({
        conversationId: CONVERSATION_ID,
        storagePath: "a/b/c.png",
        fileName: "c.png",
        mimeType: "image/png",
        sizeBytes: 0,
      }).success,
    ).toBe(false);
  });
});

describe("sendable message rule", () => {
  it("requires text unless an image is attached", () => {
    expect(isSendableMessage("", 0)).toBe(false);
    expect(isSendableMessage("   ", 0)).toBe(false);
    expect(isSendableMessage("hello", 0)).toBe(true);
    expect(isSendableMessage("", 1)).toBe(true);
  });
});
