import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/** Small helpers shared by all API routes. */

export async function requireUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export const ERRORS = {
  unauthenticated: "You must be signed in.",
  invalidInput: "The request is invalid.",
  notFound: "Conversation not found.",
  attachmentNotFound: "One or more attachments could not be found.",
  limitReached: "You have reached your daily message limit. It resets at midnight UTC.",
  server: "Something went wrong. Please try again.",
} as const;

/** Log server-side technical context without leaking details to users. */
export function logServerError(label: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[api] ${label}: ${detail}`);
}
