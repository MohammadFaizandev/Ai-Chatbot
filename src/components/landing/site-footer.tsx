import { APP_NAME } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="border-t py-8">
      <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 text-sm sm:flex-row">
        <p>
          © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </p>
        <p>Built with Next.js, Clerk, Supabase, and an OpenAI-compatible AI.</p>
      </div>
    </footer>
  );
}
