import { NextResponse, type NextRequest } from "next/server";
import type OpenAI from "openai";

import { ERRORS, jsonError, logServerError, requireUserId } from "@/lib/api";
import { serverEnv } from "@/lib/env";
import {
  getOpenAIClient,
  MAX_OUTPUT_TOKENS,
  SYSTEM_PROMPT,
  toSafeAIError,
} from "@/lib/openai";
import { consumeDailyUsage, finalizeUsageEvent } from "@/lib/rate-limit";
import {
  createSignedImageUrl,
  getOwnedAttachments,
  linkAttachmentsToMessage,
} from "@/lib/supabase/attachments";
import {
  getOwnedConversation,
  renameConversation,
  touchConversation,
} from "@/lib/supabase/conversations";
import {
  insertMessage,
  listRecentContextMessages,
  updateMessage,
} from "@/lib/supabase/messages";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  chatRequestSchema,
  generateLocalTitle,
  isSendableMessage,
} from "@/lib/validation";
import type { ChatStreamEvent } from "@/types/chat";

export const maxDuration = 60;

const DEFAULT_TITLE = "New Conversation";

/**
 * Streaming chat endpoint. Emits newline-delimited JSON events
 * (ChatStreamEvent): user_message -> delta* -> done | error.
 */
export async function POST(request: NextRequest) {
  // 1-2. Authenticate.
  const userId = await requireUserId();
  if (!userId) return jsonError(401, ERRORS.unauthenticated);

  const env = serverEnv();

  // 3. Validate payload.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, ERRORS.invalidInput);
  }
  const parsed = chatRequestSchema(env.MAX_MESSAGE_LENGTH).safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? ERRORS.invalidInput);
  }
  const { conversationId, attachmentIds } = parsed.data;
  const text = parsed.data.message.trim();

  // 6-7. Text length is enforced by the schema; empty text needs an image.
  if (attachmentIds.length > env.MAX_IMAGES_PER_MESSAGE) {
    return jsonError(
      400,
      `At most ${env.MAX_IMAGES_PER_MESSAGE} image(s) per message.`,
    );
  }
  if (!isSendableMessage(text, attachmentIds.length)) {
    return jsonError(400, "Type a message or attach an image.");
  }

  try {
    const supabase = createServerSupabaseClient();

    // 4-5. Conversation exists and belongs to this user.
    const conversation = await getOwnedConversation(
      supabase,
      userId,
      conversationId,
    );
    if (!conversation) return jsonError(404, ERRORS.notFound);

    // 9-10. Attachments belong to this user AND this conversation.
    const attachments = await getOwnedAttachments(
      supabase,
      userId,
      conversationId,
      attachmentIds,
    );
    if (attachments.length !== attachmentIds.length) {
      return jsonError(403, ERRORS.attachmentNotFound);
    }
    if (attachments.some((attachment) => attachment.message_id !== null)) {
      return jsonError(409, "An attachment was already sent with another message.");
    }

    // 8. Enforce the daily limit atomically.
    const reservation = await consumeDailyUsage(supabase, conversationId);
    if (!reservation.allowed) {
      return jsonError(429, ERRORS.limitReached);
    }

    // 13. Load limited history BEFORE saving the new message.
    const history = await listRecentContextMessages(
      supabase,
      userId,
      conversationId,
      env.MAX_CONTEXT_MESSAGES,
    );

    // 11. Save the user message and link its attachments.
    const userMessage = await insertMessage(supabase, {
      conversationId,
      userId,
      role: "user",
      content: text || null,
      status: "completed",
    });
    await linkAttachmentsToMessage(supabase, userId, attachmentIds, userMessage.id);

    // Generate the initial title locally from the first user message.
    let updatedTitle: string | null = null;
    if (conversation.title === DEFAULT_TITLE && text) {
      updatedTitle = generateLocalTitle(text);
      await renameConversation(supabase, userId, conversationId, updatedTitle);
    }

    // 12. Create the pending assistant message.
    const assistantMessage = await insertMessage(supabase, {
      conversationId,
      userId,
      role: "assistant",
      content: null,
      status: "pending",
    });

    // 14. Prepare provider input (text + short-lived signed image URLs).
    const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
    if (text) contentParts.push({ type: "text", text });
    for (const attachment of attachments) {
      const url = await createSignedImageUrl(supabase, attachment.storage_path);
      contentParts.push({ type: "image_url", image_url: { url } });
    }

    const providerMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      [
        { role: "system", content: SYSTEM_PROMPT },
        ...history.map(
          (message): OpenAI.Chat.Completions.ChatCompletionMessageParam =>
            message.role === "user"
              ? { role: "user", content: message.content ?? "" }
              : { role: "assistant", content: message.content ?? "" },
        ),
        { role: "user", content: contentParts },
      ];

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        let fullText = "";
        let clientGone = false;

        const send = (event: ChatStreamEvent) => {
          if (clientGone) return;
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          } catch {
            clientGone = true;
          }
        };

        try {
          send({
            type: "user_message",
            message: userMessage,
          });

          // 15-16. Stream the model response to the client.
          const client = getOpenAIClient();
          const completion = await client.chat.completions.create(
            {
              model: env.OPENAI_MODEL,
              messages: providerMessages,
              stream: true,
              max_tokens: MAX_OUTPUT_TOKENS,
            },
            { signal: request.signal },
          );

          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta?.content ?? "";
            if (delta) {
              fullText += delta;
              send({ type: "delta", text: delta });
            }
          }

          // 17-18, 20-22. Persist, record usage, bump conversation.
          const finalMessage = await updateMessage(
            supabase,
            userId,
            assistantMessage.id,
            { content: fullText, status: "completed" },
          );
          await finalizeUsageEvent(supabase, reservation.eventId, "completed");
          await touchConversation(supabase, userId, conversationId);

          send({
            type: "done",
            message:
              finalMessage ??
              { ...assistantMessage, content: fullText, status: "completed" },
            remaining: reservation.remaining,
          });
        } catch (error) {
          const aborted = request.signal.aborted;

          // 19. Record failures; keep partial text when the user stopped.
          try {
            if (aborted && fullText) {
              await updateMessage(supabase, userId, assistantMessage.id, {
                content: fullText,
                status: "completed",
              });
              await finalizeUsageEvent(supabase, reservation.eventId, "completed");
            } else {
              await updateMessage(supabase, userId, assistantMessage.id, {
                content: fullText || null,
                status: "error",
              });
              await finalizeUsageEvent(supabase, reservation.eventId, "error");
            }
            await touchConversation(supabase, userId, conversationId);
          } catch (persistError) {
            logServerError("chat_persist_failure", persistError);
          }

          if (!aborted) {
            const safe = toSafeAIError(error);
            logServerError(`chat_stream_${safe.logLabel}`, error);
            send({
              type: "error",
              message: safe.userMessage,
              remaining: reservation.remaining,
            });
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

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    logServerError("chat_route", error);
    return jsonError(500, ERRORS.server);
  }
}
