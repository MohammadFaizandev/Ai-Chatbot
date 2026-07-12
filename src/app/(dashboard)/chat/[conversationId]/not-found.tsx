import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ConversationNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Conversation not found</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        This conversation does not exist or you do not have access to it.
      </p>
      <Button render={<Link href="/chat" />}>Back to chat</Button>
    </div>
  );
}
