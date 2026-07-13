import { describe, expect, it } from "vitest";

import {
  CHAT_MODELS,
  DEFAULT_CHAT_MODEL_ID,
  getChatModel,
  isSelectableModel,
  resolveChatModel,
} from "@/lib/models";

describe("model registry", () => {
  it("has a default that is part of the allowlist", () => {
    expect(isSelectableModel(DEFAULT_CHAT_MODEL_ID)).toBe(true);
  });

  it("recognizes only allowlisted models", () => {
    for (const model of CHAT_MODELS) {
      expect(isSelectableModel(model.id)).toBe(true);
    }
    expect(isSelectableModel("openai/gpt-4o")).toBe(false);
    expect(isSelectableModel("")).toBe(false);
  });

  it("resolves arbitrary/blank input to the default (allowlist enforcement)", () => {
    expect(resolveChatModel("openai/gpt-4o")).toBe(DEFAULT_CHAT_MODEL_ID);
    expect(resolveChatModel(undefined)).toBe(DEFAULT_CHAT_MODEL_ID);
    expect(resolveChatModel(null)).toBe(DEFAULT_CHAT_MODEL_ID);
    expect(resolveChatModel("")).toBe(DEFAULT_CHAT_MODEL_ID);
  });

  it("keeps a valid requested model", () => {
    const target = CHAT_MODELS[1].id;
    expect(resolveChatModel(target)).toBe(target);
  });

  it("exposes at least one vision-capable model for image analysis", () => {
    expect(CHAT_MODELS.some((model) => model.vision)).toBe(true);
    expect(getChatModel(DEFAULT_CHAT_MODEL_ID)?.vision).toBe(true);
  });
});
