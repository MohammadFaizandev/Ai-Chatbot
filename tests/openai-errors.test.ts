import OpenAI from "openai";
import { describe, expect, it } from "vitest";

import { toSafeAIError } from "@/lib/openai";

type APIErrorInstance = InstanceType<typeof OpenAI.APIError>;

function apiError(status: number): APIErrorInstance {
  const error = Object.create(
    OpenAI.APIError.prototype,
  ) as APIErrorInstance & { status: number };
  error.status = status;
  return error;
}

describe("toSafeAIError", () => {
  it("maps invalid credentials to a generic 500 without details", () => {
    const safe = toSafeAIError(apiError(401));
    expect(safe.status).toBe(500);
    expect(safe.userMessage).not.toMatch(/401|key|token/i);
  });

  it("maps rate limits and quota errors to 429", () => {
    const safe = toSafeAIError(apiError(429));
    expect(safe.status).toBe(429);
  });

  it("maps provider bad-request errors to 502", () => {
    expect(toSafeAIError(apiError(400)).status).toBe(502);
    expect(toSafeAIError(apiError(404)).status).toBe(502);
  });

  it("maps unknown provider errors to 502", () => {
    expect(toSafeAIError(apiError(500)).status).toBe(502);
  });

  it("maps aborts to 499", () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    expect(toSafeAIError(abort).status).toBe(499);
  });

  it("maps network failures to a safe generic message", () => {
    const safe = toSafeAIError(new TypeError("fetch failed"));
    expect(safe.status).toBe(502);
    expect(safe.userMessage).toMatch(/connection/i);
  });

  it("never includes secrets or stack traces in user messages", () => {
    for (const candidate of [
      apiError(401),
      apiError(429),
      apiError(500),
      new Error("Bearer sk-secret-key leaked in stack"),
    ]) {
      const safe = toSafeAIError(candidate);
      expect(safe.userMessage).not.toContain("sk-");
      expect(safe.userMessage).not.toContain("Bearer");
    }
  });
});
