@AGENTS.md

# AI SaaS Chat — Project Instructions

## Project purpose

This repository contains a secure AI SaaS chat application built with Next.js (App Router), Clerk, Supabase, and an OpenAI-compatible AI provider (OpenRouter or OpenAI). Authenticated users chat with an AI, get streamed Markdown responses, upload images for analysis, and manage saved conversations under a daily message limit.

## Architecture rules

- Prefer Server Components by default; use Client Components only for interactivity, browser state, or hooks.
- Keep all AI provider calls server-side. Never expose `OPENAI_API_KEY` or `CLERK_SECRET_KEY`.
- Never create `NEXT_PUBLIC_OPENAI_API_KEY` or any `NEXT_PUBLIC_` server secret.
- Do not use a Supabase service-role key for normal user operations.
- Use Clerk's native Supabase integration: Supabase clients are created with the Clerk session token (`accessToken`), and database ownership uses `auth.jwt()->>'sub'`.
- RLS is enabled on all user-owned tables (`conversations`, `messages`, `attachments`, `usage_events`). Verify ownership server-side even when RLS exists.
- Image storage is private (`chat-images` bucket). Access previous images only via short-lived signed URLs.
- Never render unsafe model-generated HTML (react-markdown without raw HTML, safe link attributes).
- Validate all API input with Zod. Validate image type and size on client AND server.
- Storage paths: `{clerkUserId}/{conversationId}/{randomUuid}.{ext}`.
- Avoid `any` and unsafe casts. TypeScript strict mode stays on.
- Return safe, generic errors to users; never log secrets, access tokens, or long-lived signed URLs.

## Chat rules

- Authenticate every API request with Clerk before anything else.
- Verify conversation ownership on every operation.
- Limit conversation context to `MAX_CONTEXT_MESSAGES`.
- Save the user message before AI generation; save the assistant message after; record failures with `status = 'error'`.
- Generate the initial conversation title locally from the first user message (no extra AI call).
- Use `OPENAI_MODEL` (and optional `OPENAI_BASE_URL`) from env — never hardcode the model.
- Store attachment metadata in Postgres; never store image base64 in Postgres.
- Enforce the daily limit via the atomic `consume_daily_usage` SQL function, server-side only.

## Coding standards

- Use descriptive names; keep components focused; avoid oversized files.
- Prefer named exports except where Next.js requires defaults (pages, layouts, routes).
- Handle loading, success, empty, and error states in UI.
- Use semantic HTML and maintain accessibility (labels, focus states, keyboard nav).
- Prevent duplicate submissions (disable composer while submitting).
- Revoke local image-preview object URLs after use.
- Use AbortController for stoppable streaming requests.

## Required checks

Run before declaring any task complete:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

## Git rules

- Never commit `.env.local`. Keep `.env.example` free of real secrets.
- Review the git diff before committing. Use focused commits.
- Do not force-push. Do not delete branches without approval.

## MVP exclusions (do not add unless specifically requested)

Stripe, subscriptions, organizations, team workspaces, voice chat, web browsing, image generation, PDF/document uploads, admin dashboard, multiple AI providers.
