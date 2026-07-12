import { auth } from "@clerk/nextjs/server";
import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChatShell } from "@/components/chat/chat-shell";
import { logServerError } from "@/lib/api";
import { listConversations } from "@/lib/supabase/conversations";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ConversationRow } from "@/types/database";

export const metadata: Metadata = {
  title: "Chat",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let conversations: ConversationRow[] = [];
  let configurationError = false;
  try {
    const supabase = createServerSupabaseClient();
    conversations = await listConversations(supabase, userId);
  } catch (error) {
    configurationError = true;
    logServerError("dashboard_layout", error);
  }

  if (configurationError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <TriangleAlert
          className="text-destructive size-8"
          aria-hidden="true"
        />
        <h1 className="text-2xl font-semibold">Setup incomplete</h1>
        <p className="text-muted-foreground max-w-md">
          The application could not connect to the database. Make sure your
          Supabase environment variables are set in <code>.env.local</code>,
          the SQL migration has been run, and the Clerk ↔ Supabase integration
          is active. See <code>SETUP.md</code> for step-by-step instructions.
        </p>
      </main>
    );
  }

  return (
    <ChatShell initialConversations={conversations}>{children}</ChatShell>
  );
}
