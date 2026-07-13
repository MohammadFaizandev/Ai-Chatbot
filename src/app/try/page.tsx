import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { GuestChat } from "@/components/chat/guest-chat";
import { APP_NAME } from "@/lib/brand";
import { serverEnv } from "@/lib/env";
import {
  currentUtcDate,
  decodeGuestUsage,
  GUEST_USAGE_COOKIE,
} from "@/lib/guest-usage";

export const metadata: Metadata = {
  title: `Try ${APP_NAME} free`,
  description: `Chat with ${APP_NAME} without an account — free daily guest messages.`,
};

export default async function TryPage() {
  // Signed-in users already have the bigger allowance and saved history.
  const { userId } = await auth();
  if (userId) redirect("/chat");

  const env = serverEnv();
  const cookieStore = await cookies();
  const usage = decodeGuestUsage(
    cookieStore.get(GUEST_USAGE_COOKIE)?.value,
    env.CLERK_SECRET_KEY,
    currentUtcDate(),
  );
  const limit = env.GUEST_DAILY_MESSAGE_LIMIT;

  return (
    <GuestChat
      initialRemaining={Math.max(limit - usage.count, 0)}
      limit={limit}
      signedInLimit={env.DAILY_MESSAGE_LIMIT}
    />
  );
}
