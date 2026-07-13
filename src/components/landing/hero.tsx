import { Show } from "@clerk/nextjs";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/brand";

export function Hero() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-20 pb-16 text-center sm:pt-28">
      <Badge variant="secondary" className="mb-4">
        <Sparkles className="size-3" aria-hidden="true" />
        AI chat, done right
      </Badge>
      <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
        Chat with AI that remembers, streams, and sees.
      </h1>
      <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg text-balance">
        {APP_NAME} is a secure AI workspace: streamed answers in rich Markdown,
        saved conversation history, and image analysis — protected by
        enterprise-grade authentication.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Show when="signed-out">
          <Button size="lg" render={<Link href="/try" />}>
            Try it free — no account
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/sign-up" />}>
            Sign up for more
          </Button>
          <Button size="lg" variant="ghost" render={<Link href="/sign-in" />}>
            Sign in
          </Button>
        </Show>
        <Show when="signed-in">
          <Button size="lg" render={<Link href="/chat" />}>
            Continue to chat
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </Show>
      </div>

      <div className="bg-card mx-auto mt-16 w-full max-w-3xl rounded-xl border p-4 text-left shadow-sm">
        <div className="text-muted-foreground mb-3 text-xs font-medium">
          Preview
        </div>
        <div className="space-y-3">
          <div className="bg-primary text-primary-foreground ml-auto w-fit max-w-[85%] rounded-lg px-3 py-2 text-sm">
            Explain what a UUID is, with a code example.
          </div>
          <div className="bg-muted w-fit max-w-[85%] rounded-lg px-3 py-2 text-sm">
            <p className="mb-2">
              A UUID is a 128-bit identifier that is unique across space and
              time. In PostgreSQL:
            </p>
            <pre className="bg-background overflow-x-auto rounded-md border p-2 font-mono text-xs">
              <code>select gen_random_uuid();</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
