import { NextResponse } from "next/server";

import { ERRORS, jsonError, logServerError, requireUserId } from "@/lib/api";
import { getUsageInfo } from "@/lib/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError(401, ERRORS.unauthenticated);

  try {
    const supabase = createServerSupabaseClient();
    const usage = await getUsageInfo(supabase);
    return NextResponse.json({ usage });
  } catch (error) {
    logServerError("usage_get", error);
    return jsonError(500, ERRORS.server);
  }
}
