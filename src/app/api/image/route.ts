import { NextResponse, type NextRequest } from "next/server";

import { ERRORS, jsonError, logServerError, requireUserId } from "@/lib/api";
import { imageGenerationSchema } from "@/lib/validation";

export const maxDuration = 60;

/**
 * Text-to-image generation, proxied server-side through Pollinations.ai —
 * a free, key-less generator. Proxying (rather than hotlinking from the
 * browser) lets us require authentication and keep the provider swappable.
 */
const POLLINATIONS_ENDPOINT = "https://image.pollinations.ai/prompt";

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return jsonError(401, ERRORS.unauthenticated);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, ERRORS.invalidInput);
  }
  const parsed = imageGenerationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? ERRORS.invalidInput);
  }
  const { prompt } = parsed.data;

  try {
    // Random seed so repeated prompts yield fresh variations.
    const seed = Math.floor(Math.random() * 1_000_000);
    const url =
      `${POLLINATIONS_ENDPOINT}/${encodeURIComponent(prompt)}` +
      `?width=1024&height=1024&nologo=true&seed=${seed}`;

    const upstream = await fetch(url, { signal: request.signal });
    if (!upstream.ok || !upstream.body) {
      logServerError(
        `image_gen_upstream_${upstream.status}`,
        new Error(await upstream.text().catch(() => "")),
      );
      return jsonError(
        502,
        "The image generator is busy right now. Please try again.",
      );
    }

    const buffer = await upstream.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (request.signal.aborted) {
      return new NextResponse(null, { status: 499 });
    }
    logServerError("image_gen", error);
    return jsonError(502, "Could not generate the image. Please try again.");
  }
}
