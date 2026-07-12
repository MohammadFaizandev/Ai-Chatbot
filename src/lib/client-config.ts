/**
 * Client-visible limits (NEXT_PUBLIC_ values are inlined at build time).
 * These exist for fast, friendly pre-validation only — the server is the
 * authority and re-validates everything.
 */
export const CLIENT_MAX_IMAGE_SIZE_MB = Number(
  process.env.NEXT_PUBLIC_MAX_IMAGE_SIZE_MB ?? "5",
);

export const CLIENT_MAX_MESSAGE_LENGTH = Number(
  process.env.NEXT_PUBLIC_MAX_MESSAGE_LENGTH ?? "8000",
);
