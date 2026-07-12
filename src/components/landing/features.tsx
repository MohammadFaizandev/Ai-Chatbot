import {
  History,
  ImageUp,
  LockKeyhole,
  MoonStar,
  SquareCode,
  Zap,
} from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "Streamed responses",
    description:
      "Answers appear word by word as the model thinks — with a stop button when you have heard enough.",
  },
  {
    icon: History,
    title: "Saved history",
    description:
      "Every conversation is stored securely. Reopen, rename, or delete any chat at any time.",
  },
  {
    icon: ImageUp,
    title: "Image analysis",
    description:
      "Attach a JPEG, PNG, or WebP image and ask questions about it. Uploads stay in private storage.",
  },
  {
    icon: SquareCode,
    title: "Markdown & code",
    description:
      "Rich Markdown rendering with tables, lists, and syntax-aware code blocks with one-click copy.",
  },
  {
    icon: LockKeyhole,
    title: "Secure by design",
    description:
      "Authentication by Clerk, row-level security in Postgres, and private image storage per user.",
  },
  {
    icon: MoonStar,
    title: "Light & dark mode",
    description:
      "A polished interface that follows your system theme or your personal preference.",
  },
] as const;

export function Features() {
  return (
    <section
      aria-labelledby="features-heading"
      className="mx-auto w-full max-w-6xl px-4 py-16"
    >
      <h2
        id="features-heading"
        className="text-center text-3xl font-bold tracking-tight"
      >
        Everything you need in an AI chat
      </h2>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="bg-card rounded-xl border p-5 shadow-sm"
          >
            <feature.icon
              className="text-primary mb-3 size-5"
              aria-hidden="true"
            />
            <h3 className="font-semibold">{feature.title}</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
