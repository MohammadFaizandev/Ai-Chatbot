import { NextResponse, type NextRequest } from "next/server";
import type OpenAI from "openai";

import { ERRORS, jsonError, logServerError } from "@/lib/api";
import { serverEnv } from "@/lib/env";
import { resolveChatModel } from "@/lib/models";
import {
  currentUtcDate,
  decodeGuestUsage,
  encodeGuestUsage,
  GUEST_USAGE_COOKIE,
  GUEST_USAGE_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/guest-usage";
import {
  streamAssistantText,
  SYSTEM_PROMPT,
  toSafeAIError,
} from "@/lib/openai";
import { guestChatRequestSchema } from "@/lib/validation";
import type { GuestChatStreamEvent } from "@/types/chat";

export const maxDuration = 60;

const GUEST_LIMIT_MESSAGE =
  "You have used all free guest messages for today. Create a free account for a bigger daily allowance.";

/**
 * Public trial chat endpoint for visitors without an account.
 *
 * No database is involved: the browser sends the recent transcript and the
 * daily allowance is enforced via a signed, httpOnly cookie. Text only —
 * image analysis requires an account.
 */
export async function POST(request: NextRequest) {
  const env = serverEnv();

  // Validate payload.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, ERRORS.invalidInput);
  }
  const parsed = guestChatRequestSchema(
    env.MAX_MESSAGE_LENGTH,
    env.MAX_CONTEXT_MESSAGES,
  ).safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? ERRORS.invalidInput);
  }
  const messages = parsed.data.messages;
  const model = resolveChatModel(parsed.data.model);
  const last = messages[messages.length - 1];
  if (last.role !== "user" || last.content.trim().length === 0) {
    return jsonError(400, "Type a message to send.");
  }

  // Enforce the guest daily allowance (signed cookie, server-verified).
  const secret = env.CLERK_SECRET_KEY;
  const today = currentUtcDate();
  const usage = decodeGuestUsage(
    request.cookies.get(GUEST_USAGE_COOKIE)?.value,
    secret,
    today,
  );
  const limit = env.GUEST_DAILY_MESSAGE_LIMIT;
  if (usage.count >= limit) {
    return jsonError(429, GUEST_LIMIT_MESSAGE);
  }
  const newCount = usage.count + 1;
  const remaining = limit - newCount;

  const providerMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
    [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map(
        (message): OpenAI.Chat.Completions.ChatCompletionMessageParam => ({
          role: message.role,
          content: message.content,
        }),
      ),
    ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      let clientGone = false;
      const send = (event: GuestChatStreamEvent) => {
        if (clientGone) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          clientGone = true;
        }
      };

      try {
        for await (const delta of streamAssistantText(
          providerMessages,
          request.signal,
          model,
        )) {
          send({ type: "delta", text: delta });
        }
        send({ type: "done", remaining });
      } catch (error) {
        if (!request.signal.aborted) {
          const safe = toSafeAIError(error);
          logServerError(`guest_chat_${safe.logLabel}`, error);
          send({ type: "error", message: safe.userMessage, remaining });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  const response = new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
  response.cookies.set(
    GUEST_USAGE_COOKIE,
    encodeGuestUsage({ date: today, count: newCount }, secret),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: GUEST_USAGE_COOKIE_MAX_AGE_SECONDS,
    },
  );
  return response;
}
