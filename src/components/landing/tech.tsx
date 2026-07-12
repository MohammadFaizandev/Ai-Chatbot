import { Badge } from "@/components/ui/badge";

const TECHNOLOGIES = [
  "Next.js",
  "TypeScript",
  "Tailwind CSS",
  "shadcn/ui",
  "Clerk",
  "Supabase",
  "PostgreSQL",
  "OpenAI-compatible AI",
  "Vercel-ready",
] as const;

export function Tech() {
  return (
    <section
      aria-labelledby="tech-heading"
      className="border-y bg-muted/40 py-12"
    >
      <div className="mx-auto w-full max-w-6xl px-4 text-center">
        <h2
          id="tech-heading"
          className="text-muted-foreground text-sm font-medium tracking-wide uppercase"
        >
          Built on a modern, free-tier-friendly stack
        </h2>
        <ul className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {TECHNOLOGIES.map((tech) => (
            <li key={tech}>
              <Badge variant="outline" className="px-3 py-1 text-sm">
                {tech}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
