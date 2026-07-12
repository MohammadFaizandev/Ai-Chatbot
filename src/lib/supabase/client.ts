"use client";

import { useSession } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useMemo } from "react";

import type { Database } from "@/types/database";

export type TypedSupabaseBrowserClient = SupabaseClient<Database>;

/**
 * Browser Supabase client authenticated with the Clerk session token
 * (Clerk's native Supabase integration). Used for direct-to-storage image
 * uploads; all other data access goes through server API routes.
 */
export function useSupabaseBrowserClient(): TypedSupabaseBrowserClient | null {
  const { session } = useSession();

  return useMemo(() => {
    if (!session) return null;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return null;

    return createClient<Database>(url, key, {
      accessToken: async () => (await session.getToken()) ?? null,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }, [session]);
}
