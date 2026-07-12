import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { ChatPanel } from "@/components/chat/chat-panel";
import { getUsageInfo } from "@/lib/rate-limit";
import { listConversationAttachments } from "@/lib/supabase/attachments";
import { getOwnedConversation } from "@/lib/supabase/conversations";
import { listMessages } from "@/lib/supabase/messages";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AttachmentMeta, ChatMessage } from "@/types/chat";

const conversationIdSchema = z.uuid();

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { conversationId } = await params;
  if (!conversationIdSchema.safeParse(conversationId).success) {
    notFound();
  }

  const supabase = createServerSupabaseClient();
  const conversation = await getOwnedConversation(
    supabase,
    userId,
    conversationId,
  );
  if (!conversation) notFound();

  const [messages, attachments, usage] = await Promise.all([
    listMessages(supabase, userId, conversationId),
    listConversationAttachments(supabase, userId, conversationId),
    getUsageInfo(supabase),
  ]);

  const attachmentsByMessage = new Map<string, AttachmentMeta[]>();
  for (const attachment of attachments) {
    if (!attachment.message_id) continue;
    const meta: AttachmentMeta = {
      id: attachment.id,
      file_name: attachment.file_name,
      mime_type: attachment.mime_type,
      size_bytes: attachment.size_bytes,
    };
    const list = attachmentsByMessage.get(attachment.message_id) ?? [];
    list.push(meta);
    attachmentsByMessage.set(attachment.message_id, list);
  }

  const messagesWithAttachments: ChatMessage[] = messages.map((message) => ({
    ...message,
    attachments: attachmentsByMessage.get(message.id) ?? [],
  }));

  return (
    <ChatPanel
      conversation={conversation}
      initialMessages={messagesWithAttachments}
      initialUsage={usage}
    />
  );
}
