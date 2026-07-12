import "server-only";

import { z } from "zod";

/**
 * Server-side environment validation.
 *
 * Validation is lazy (first access) so `next build` succeeds before real
 * credentials exist, but any runtime code path that needs configuration
 * fails fast with a precise error instead of a confusing downstream one.
 */
const serverEnvSchema = z.object({
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required"),
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL must be a URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required"),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  OPENAI_MODEL: z.string().min(1, "OPENAI_MODEL is required"),
  OPENAI_BASE_URL: z
    .union([z.url(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  DAILY_MESSAGE_LIMIT: z.coerce.number().int().positive().default(10),
  MAX_MESSAGE_LENGTH: z.coerce.number().int().positive().default(8000),
  MAX_IMAGE_SIZE_MB: z.coerce.number().positive().default(5),
  MAX_IMAGES_PER_MESSAGE: z.coerce.number().int().positive().default(1),
  MAX_CONTEXT_MESSAGES: z.coerce.number().int().positive().default(20),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(
      `Invalid server environment configuration — ${missing}. ` +
        "Copy .env.example to .env.local and fill in the values.",
    );
  }

  cached = parsed.data;
  return cached;
}
