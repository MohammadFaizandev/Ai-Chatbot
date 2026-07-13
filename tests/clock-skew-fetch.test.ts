import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWithClockSkewRetry } from "@/lib/supabase/clock-skew-fetch";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("fetchWithClockSkewRetry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("passes successful responses through untouched", async () => {
    const mock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", mock);

    const response = await fetchWithClockSkewRetry("https://example.test");
    expect(response.status).toBe(200);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("retries once when the token is not yet valid", async () => {
    vi.useFakeTimers();
    const mock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(401, { message: "JWT not yet valid" }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", mock);

    const pending = fetchWithClockSkewRetry("https://example.test");
    await vi.runAllTimersAsync();
    const response = await pending;

    expect(response.status).toBe(200);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("does not retry other 401 errors", async () => {
    const mock = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { message: "invalid signature" }));
    vi.stubGlobal("fetch", mock);

    const response = await fetchWithClockSkewRetry("https://example.test");
    expect(response.status).toBe(401);
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
