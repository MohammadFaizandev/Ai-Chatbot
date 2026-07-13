/**
 * Registry of user-selectable AI models. Shared by client (the picker UI)
 * and server (allowlist validation) — keep it framework-free.
 *
 * SECURITY: the browser may send a model id with a chat request, but the
 * server must only ever use ids that appear here. This prevents a client
 * from routing requests to arbitrary (e.g. paid) models on the provider.
 *
 * These are the free OpenRouter models benchmarked for reliability + clean
 * output on 2026-07-13; the first entry is the default.
 */
export type ChatModel = {
  id: string;
  label: string;
  description: string;
  /** Whether the model accepts image input (needed for image analysis). */
  vision: boolean;
};

export const CHAT_MODELS: readonly ChatModel[] = [
  {
    id: "google/gemma-4-26b-a4b-it:free",
    label: "Gemma 4",
    description: "Balanced quality · supports images",
    vision: true,
  },
  {
    id: "nvidia/nemotron-nano-12b-v2-vl:free",
    label: "Nemotron Nano",
    description: "Fastest · supports images",
    vision: true,
  },
  {
    id: "openai/gpt-oss-20b:free",
    label: "GPT-OSS 20B",
    description: "Strong writing · text only",
    vision: false,
  },
] as const;

export const DEFAULT_CHAT_MODEL_ID = CHAT_MODELS[0].id;

export function isSelectableModel(id: string): boolean {
  return CHAT_MODELS.some((model) => model.id === id);
}

/** Return a safe model id: the requested one if allowlisted, else default. */
export function resolveChatModel(id: string | undefined | null): string {
  return id && isSelectableModel(id) ? id : DEFAULT_CHAT_MODEL_ID;
}

export function getChatModel(id: string): ChatModel | undefined {
  return CHAT_MODELS.find((model) => model.id === id);
}
