import { Show } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/brand";

export function Cta() {
  return (
    <section
      aria-labelledby="cta-heading"
      className="mx-auto w-full max-w-6xl px-4 py-20"
    >
      <div className="bg-primary text-primary-foreground rounded-2xl px-6 py-14 text-center">
        <h2
          id="cta-heading"
          className="text-3xl font-bold tracking-tight text-balance"
        >
          Ready to try {APP_NAME}?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-balance opacity-90">
          Create a free account and start your first AI conversation in under a
          minute.
        </p>
        <div className="mt-7 flex justify-center">
          <Show when="signed-out">
            <Button size="lg" variant="secondary" render={<Link href="/sign-up" />}>
              Create your free account
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </Show>
          <Show when="signed-in">
            <Button size="lg" variant="secondary" render={<Link href="/chat" />}>
              Open the chat
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </Show>
        </div>
      </div>
    </section>
  );
}
