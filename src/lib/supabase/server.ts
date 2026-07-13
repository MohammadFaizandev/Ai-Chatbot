import "server-only";

import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env";
import { fetchWithClockSkewRetry } from "@/lib/supabase/clock-skew-fetch";
import type { Database } from "@/types/database";

export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Server-side Supabase client authenticated as the current Clerk user via
 * Clerk's native Supabase integration: the Clerk session token is passed as
 * the Supabase access token, so RLS policies see the Clerk user id in
 * auth.jwt()->>'sub'.
 *
 * No service-role key is used anywhere — every query runs under RLS.
 */
export function createServerSupabaseClient(): TypedSupabaseClient {
  const env = serverEnv();
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      accessToken: async () => {
        const { getToken } = await auth();
        return (await getToken()) ?? null;
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { fetch: fetchWithClockSkewRetry },
    },
  );
}
