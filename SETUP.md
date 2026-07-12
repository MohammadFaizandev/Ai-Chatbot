# SETUP.md — Manual configuration guide

Every step you must do by hand, in order. Budget ~20 minutes. When you finish, `npm run dev` gives you a fully working app.

---

## 1. Clerk (authentication)

1. Go to <https://dashboard.clerk.com> and create a free account.
2. **Create application** → name it (e.g. "NovaChat") → enable **Email** sign-in. Optionally also enable **Google**.
3. On the **API Keys** page copy:
   - **Publishable key** → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in `.env.local`
   - **Secret key** → `CLERK_SECRET_KEY` in `.env.local`
4. Development URLs (localhost) work out of the box — nothing to configure for local use.
5. **Activate the native Supabase integration** (required for the database to work):
   1. In the Clerk dashboard, open **Configure → Integrations → Supabase** (or visit <https://dashboard.clerk.com/setup/supabase>).
   2. Select your instance and click **Activate Supabase integration**.
   3. Clerk shows you a **Clerk domain** (e.g. `https://your-app-12.clerk.accounts.dev`). Copy it — you will paste it into Supabase in the next section.
6. For production later: in **Configure → Domains**, add your production domain (e.g. `your-app.vercel.app`) and switch to your production instance keys in Vercel.

## 2. Supabase (database + storage)

1. Go to <https://supabase.com/dashboard> and create a free account + a new project (any region, free plan).
2. In **Project Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (starts with `sb_publishable_`; the legacy `anon` key also works) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. **Connect Clerk as auth provider:**
   1. Open **Authentication → Sign In / Up → Third Party Auth** (or Project Settings → Authentication).
   2. Click **Add provider → Clerk**.
   3. Paste the **Clerk domain** you copied in step 1.5.
4. **Run the migration:**
   1. Open **SQL Editor** → **New query**.
   2. Paste the entire contents of `supabase/migrations/001_initial_schema.sql`.
   3. Click **Run**. It creates the tables, indexes, RLS policies, storage policies, usage-limit functions, and the private `chat-images` bucket.
5. **Verify the bucket:** In **Storage**, confirm a bucket named `chat-images` exists and is **not public**. If the SQL insert was blocked in your project, create it manually: **New bucket** → name `chat-images` → Public **OFF** → then re-run only the `create policy ... on storage.objects` statements from the migration file.
6. **Verify RLS:** In **Table Editor**, each of `conversations`, `messages`, `attachments`, `usage_events` should show "RLS enabled".
7. After the app runs: create two different Clerk accounts and confirm neither can see the other's conversations.

## 3. AI provider

### Option A — OpenRouter (free models, recommended for testing)

1. Create an account at <https://openrouter.ai>.
2. **Keys** → **Create key** → copy it (starts with `sk-or-`).
3. In `.env.local`:
   ```
   OPENAI_API_KEY=sk-or-...
   OPENAI_BASE_URL=https://openrouter.ai/api/v1
   OPENAI_MODEL=<a model id from openrouter.ai/models>
   ```
4. Pick a model tagged `:free` on <https://openrouter.ai/models>. **For image analysis choose a vision-capable model** (the model page shows an "image" input tag). Free models are rate-limited; if requests fail with 429, wait or pick another model.

### Option B — OpenAI

1. Create a project at <https://platform.openai.com>.
2. Create a **project API key** → `OPENAI_API_KEY`.
3. Add billing if required, then **set a low monthly budget limit and usage alerts** (Settings → Limits). This is important — API usage is billed per token.
4. Set `OPENAI_MODEL` (e.g. `gpt-4o-mini`) and leave `OPENAI_BASE_URL` empty.
5. Use separate keys for development and production if you deploy.

Never put the AI key anywhere except `.env.local` (locally) and Vercel environment variables (production).

## 4. GitHub + Vercel (deployment)

1. Push the project to GitHub:
   ```bash
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin master
   ```
   Suggested repository description: *"Secure AI SaaS chat app — Next.js, Clerk, Supabase RLS, streamed OpenAI-compatible responses, image analysis."*
2. In <https://vercel.com>, **Add New → Project** → import the repository (defaults are fine — Next.js is auto-detected).
3. In **Settings → Environment Variables**, add **every** variable from `.env.example` with your real values, and set:
   - `NEXT_PUBLIC_APP_URL` = your production URL (e.g. `https://your-app.vercel.app`)
4. In Clerk, add the production domain (see step 1.6) and use production instance keys in Vercel.
5. **Redeploy after any environment-variable change** (Vercel does not apply them to old builds).
6. Test in production: sign-in, create a conversation, streamed reply, image upload, rename/delete, and the daily limit.

## 5. Local run checklist

```bash
npm install
# fill .env.local (sections 1–3 above)
npm run dev        # http://localhost:3000
npm run test       # 43 unit tests
npm run build      # production build
```

If `/chat` shows **"Setup incomplete"**, one of these is missing: Supabase env vars, the SQL migration, or the Clerk ↔ Supabase integration (steps 1.5 and 2.3).
