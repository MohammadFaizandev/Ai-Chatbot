# NovaChat — AI SaaS Chat Application

A secure, production-ready AI chat application. Authenticated users hold streamed AI conversations with saved history, image analysis, rich Markdown answers, and a daily usage limit — built on a modern, free-tier-friendly stack.

> Rename the product in one file: `src/lib/brand.ts`.

## Features

- **Streamed AI responses** — answers render word by word, with a stop button (AbortController)
- **Saved chat history** — reopen, rename, and delete conversations (with confirmation)
- **Automatic titles** — generated locally from your first message, no extra AI call
- **Image analysis** — attach a JPEG/PNG/WebP image and ask questions about it
- **Markdown rendering** — GFM tables, lists, blockquotes, links, and code blocks with a copy button
- **Daily message limit** — enforced atomically in Postgres, remaining allowance shown in the UI
- **Light / dark / system theme** — via next-themes, no hydration flash
- **Responsive** — desktop sidebar, mobile drawer, mobile-friendly composer
- **Secure by design** — Clerk auth, Postgres RLS, private image storage, escaped Markdown, server-side validation everywhere

## Technology stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict) |
| Styling | Tailwind CSS v4, shadcn/ui (Base UI), Lucide icons |
| Auth | Clerk (native Supabase integration) |
| Database | Supabase Postgres with Row Level Security |
| Storage | Supabase private Storage bucket (`chat-images`) |
| AI | Official OpenAI SDK — works with OpenAI **or any OpenAI-compatible provider (e.g. OpenRouter free models)** via `OPENAI_BASE_URL` |
| Validation | Zod v4 |
| Tests | Vitest |
| Hosting | Vercel-compatible |

## Architecture overview

```
Browser ──► Next.js (Vercel)
  │             │
  │  Clerk session token (native integration)
  │             ▼
  │        Supabase Postgres (RLS: auth.jwt()->>'sub' = user_id)
  │        Supabase private Storage (per-user folders)
  │             │
  └── stream ◄──┴──► OpenAI-compatible API (server-side only)
```

- All AI calls happen in server API routes; the AI key never reaches the browser.
- Every database table has RLS **and** every server query re-filters by the authenticated Clerk user id (defense in depth).
- Images upload directly from the browser to the private bucket (storage RLS restricts writes to the user's own folder), then a server route verifies ownership, size, and real file type (magic bytes) before registering the attachment.
- The daily limit is reserved atomically in Postgres (`consume_daily_usage`, advisory-locked) before any AI call.

## Screenshots

_Placeholders — add your own after running the app._

| Landing page | Chat (dark) | Chat (mobile) |
| --- | --- | --- |
| _screenshot_ | _screenshot_ | _screenshot_ |

## Prerequisites

- Node.js 20+ and npm
- Free accounts: [Clerk](https://clerk.com), [Supabase](https://supabase.com), and an AI provider:
  - [OpenRouter](https://openrouter.ai) (has free models — recommended for testing), or
  - [OpenAI](https://platform.openai.com) (usage-based billing)
- For deployment: [GitHub](https://github.com) and [Vercel](https://vercel.com)

**Cost note:** Next.js is free and open source. GitHub, Supabase, Clerk, and Vercel all offer free tiers suitable for this project. **AI API usage is not completely free** with OpenAI — it is billed per token. Set a small budget and usage alerts, or use OpenRouter's `:free` models for testing. The built-in daily message limit (`DAILY_MESSAGE_LIMIT`, default 50/user/day) is your main cost protection.

## Local installation

```bash
git clone <your-repo-url>
cd ai-saas-chat
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Full step-by-step service configuration (Clerk, Supabase, AI provider, Vercel) lives in **[SETUP.md](./SETUP.md)** — follow it top to bottom the first time.

### Environment variables

See `.env.example` for the full annotated list. Summary:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Clerk API keys |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` etc. | Auth page routes and post-auth redirects |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase project URL + publishable key |
| `OPENAI_API_KEY` | AI provider key (**server-only, never exposed**) |
| `OPENAI_MODEL` | Model id, e.g. `google/gemma-4-31b-it:free` (OpenRouter) or `gpt-4o-mini` (OpenAI) |
| `OPENAI_BASE_URL` | `https://openrouter.ai/api/v1` for OpenRouter; empty for OpenAI |
| `DAILY_MESSAGE_LIMIT` | Messages per user per UTC day (default 50) |
| `MAX_MESSAGE_LENGTH`, `MAX_CONTEXT_MESSAGES`, `MAX_IMAGE_SIZE_MB`, `MAX_IMAGES_PER_MESSAGE` | Guardrails |

### Database migration

The complete schema (tables, indexes, triggers, RLS policies, storage policies, and the atomic usage-limit functions) is in:

```
supabase/migrations/001_initial_schema.sql
```

Run it in the Supabase **SQL Editor** (see SETUP.md §2). The migration is never applied automatically.

## Scripts

```bash
npm run dev        # start the dev server
npm run build      # production build
npm run start      # run the production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run test       # Vitest unit tests
```

## Testing

Automated tests cover the pure logic that guards security and correctness: Zod schemas, message/title/image validation, magic-byte MIME sniffing, storage-path validation, local title generation, AI error mapping, and Markdown XSS safety.

Recommended manual verification (two Clerk test accounts):

- User A cannot open, rename, or delete User B's conversations (direct URL or API)
- User A cannot read User B's attachments or storage objects
- Unauthenticated users are redirected from `/chat` and rejected by `/api/*` chat routes
- The daily limit blocks the 11th message and the counter updates
- Stop-generation keeps the partial answer; refresh preserves history
- Dark mode persists; the mobile drawer works

Recommended future E2E coverage (not included in the MVP): Playwright flows for sign-up → chat → rename → delete, image upload, and limit exhaustion.

## Deployment (GitHub + Vercel)

1. Push to GitHub (the repo is ready — `.env.local` is gitignored).
2. Import the repository in Vercel.
3. Add all environment variables from `.env.example` (set `NEXT_PUBLIC_APP_URL` to the production URL).
4. Add your production domain in Clerk and redeploy.

Details in [SETUP.md](./SETUP.md) §4.

## Security notes

- `OPENAI_API_KEY` and `CLERK_SECRET_KEY` are server-only; there is no `NEXT_PUBLIC_` secret anywhere.
- No Supabase service-role key is used — every query runs under RLS as the signed-in user.
- Images live in a **private** bucket; the UI only ever receives short-lived signed URLs.
- Uploaded files are re-validated server-side, including magic-byte type sniffing; fakes are deleted.
- Model output is rendered as escaped Markdown (no raw HTML, safe link attributes).
- Prompt injection cannot be fully prevented; the app mitigates it by giving the model no secrets and no privileged tools, and by never trusting model output as HTML or code.

## Known limitations

- Historical images are not re-sent to the AI on later turns (only the message they were attached to).
- Failed generations still consume one message from the daily allowance (prevents refund abuse).
- OpenRouter free models can be rate-limited or intermittently unavailable; some free models do not support image input — pick a vision-capable model for image analysis.
- Conversation list is capped at the 100 most recent conversations.
- On very long answers the 60-second route limit (Vercel hobby) may truncate generation.

## Future improvements

Stripe subscriptions and plans, multiple AI models/providers, regenerate/edit-and-resend, chat search, export, shared conversation links, PDF/document uploads, voice input/output, team workspaces, admin dashboard, token/cost analytics, prompt templates, AI image generation.

## License

License placeholder — choose one (e.g. MIT) before publishing.
