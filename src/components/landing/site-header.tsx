import { Show, UserButton } from "@clerk/nextjs";
import { MessageSquareText } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/brand";

export function SiteHeader() {
  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-4"
      >
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
            <MessageSquareText className="size-4" aria-hidden="true" />
          </span>
          {APP_NAME}
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Show when="signed-out">
            <Button variant="ghost" size="sm" render={<Link href="/sign-in" />}>
              Sign in
            </Button>
            <Button size="sm" render={<Link href="/sign-up" />}>
              Get started
            </Button>
          </Show>
          <Show when="signed-in">
            <Button size="sm" render={<Link href="/chat" />}>
              Open chat
            </Button>
            <UserButton />
          </Show>
        </div>
      </nav>
    </header>
  );
}
