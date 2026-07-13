import { describe, expect, it } from "vitest";

import {
  decodeGuestUsage,
  encodeGuestUsage,
  GUEST_USAGE_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/guest-usage";
import { guestChatRequestSchema } from "@/lib/validation";

const SECRET = "test-secret";
const TODAY = "2026-07-13";

describe("guest usage cookie", () => {
  it("round-trips a valid value", () => {
    const encoded = encodeGuestUsage({ date: TODAY, count: 7 }, SECRET);
    expect(decodeGuestUsage(encoded, SECRET, TODAY)).toEqual({
      date: TODAY,
      count: 7,
    });
  });

  it("resets when the cookie is missing or malformed", () => {
    const fresh = { date: TODAY, count: 0 };
    expect(decodeGuestUsage(undefined, SECRET, TODAY)).toEqual(fresh);
    expect(decodeGuestUsage("", SECRET, TODAY)).toEqual(fresh);
    expect(decodeGuestUsage("garbage", SECRET, TODAY)).toEqual(fresh);
    expect(decodeGuestUsage("a.b.c", SECRET, TODAY)).toEqual(fresh);
  });

  it("rejects tampered counts and signatures", () => {
    const encoded = encodeGuestUsage({ date: TODAY, count: 19 }, SECRET);
    const [date, , signature] = encoded.split(".");
    // Lower the count but keep the old signature.
    expect(decodeGuestUsage(`${date}.2.${signature}`, SECRET, TODAY)).toEqual({
      date: TODAY,
      count: 0,
    });
    // Forge with the wrong secret.
    const forged = encodeGuestUsage({ date: TODAY, count: 0 }, "other-secret");
    expect(decodeGuestUsage(forged, SECRET, TODAY)).toEqual({
      date: TODAY,
      count: 0,
    });
  });

  it("resets on UTC day rollover", () => {
    const yesterday = encodeGuestUsage({ date: "2026-07-12", count: 20 }, SECRET);
    expect(decodeGuestUsage(yesterday, SECRET, TODAY)).toEqual({
      date: TODAY,
      count: 0,
    });
  });

  it("keeps the cookie alive across a day boundary", () => {
    expect(GUEST_USAGE_COOKIE_MAX_AGE_SECONDS).toBeGreaterThanOrEqual(
      60 * 60 * 24,
    );
  });
});

describe("guestChatRequestSchema", () => {
  const schema = guestChatRequestSchema(100, 5);

  it("accepts a valid transcript", () => {
    const result = schema.safeParse({
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
        { role: "user", content: "how are you?" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty transcripts, bad roles, and oversized content", () => {
    expect(schema.safeParse({ messages: [] }).success).toBe(false);
    expect(
      schema.safeParse({ messages: [{ role: "system", content: "x" }] })
        .success,
    ).toBe(false);
    expect(
      schema.safeParse({
        messages: [{ role: "user", content: "x".repeat(101) }],
      }).success,
    ).toBe(false);
  });

  it("caps the number of context messages", () => {
    const messages = Array.from({ length: 6 }, () => ({
      role: "user" as const,
      content: "hi",
    }));
    expect(schema.safeParse({ messages }).success).toBe(false);
  });
});
