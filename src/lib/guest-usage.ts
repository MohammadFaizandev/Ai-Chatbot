import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Guest (no-account) daily usage tracking via a signed, httpOnly cookie.
 *
 * The cookie value is `{date}.{count}.{hmac}` where the HMAC covers
 * `{date}.{count}` with a server-side secret, so the browser cannot forge
 * a higher allowance. Clearing cookies resets the counter — acceptable for
 * a trial teaser; real quota enforcement lives behind sign-in.
 *
 * Pure encode/decode helpers take the secret and "today" explicitly so they
 * are unit-testable without environment setup.
 */

export const GUEST_USAGE_COOKIE = "guest_usage";

/** Cookie lifetime: two days is enough to span any UTC-day rollover. */
export const GUEST_USAGE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 48;

export type GuestUsage = {
  /** UTC day the count applies to, formatted YYYY-MM-DD. */
  date: string;
  /** Messages consumed on that day. */
  count: number;
};

export function currentUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function encodeGuestUsage(usage: GuestUsage, secret: string): string {
  const payload = `${usage.date}.${usage.count}`;
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * Decode and verify a guest-usage cookie. Any missing, malformed, tampered,
 * or stale (previous-day) value safely resets to zero used today.
 */
export function decodeGuestUsage(
  value: string | undefined,
  secret: string,
  today: string,
): GuestUsage {
  const fresh: GuestUsage = { date: today, count: 0 };
  if (!value) return fresh;

  const lastDot = value.lastIndexOf(".");
  if (lastDot <= 0) return fresh;
  const payload = value.slice(0, lastDot);
  const signature = value.slice(lastDot + 1);

  const expected = sign(payload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return fresh;
  }

  const match = /^(\d{4}-\d{2}-\d{2})\.(\d{1,7})$/.exec(payload);
  if (!match) return fresh;

  const [, date, rawCount] = match;
  if (date !== today) return fresh;

  return { date, count: Number.parseInt(rawCount, 10) };
}
