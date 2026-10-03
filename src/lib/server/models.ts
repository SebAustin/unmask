import "server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import type { ServerEnv } from "./env";
import { createMockModel } from "./mock";

const FEATHERLESS_BASE_URL = "https://api.featherless.ai/v1";

export interface Models {
  readonly analysis: LanguageModel | null;
  readonly vision: LanguageModel | null;
  readonly analysisModelId: string;
}

/** Builds the Featherless-backed models, or deterministic mocks when AI_MOCK=1. */
export function buildModels(env: ServerEnv, mockMode?: string): Models {
  if (env.mock) {
    return { analysis: createMockModel("analysis", mockMode), vision: createMockModel("vision", mockMode), analysisModelId: "mock" };
  }
  if (!env.apiKey) return { analysis: null, vision: null, analysisModelId: env.analysisModel };

  const featherless = createOpenAICompatible({
    name: "featherless",
    baseURL: FEATHERLESS_BASE_URL,
    apiKey: env.apiKey,
    // Hybrid reasoning models (Qwen3.5/3.6) think by default; that adds latency and pollutes JSON.
    transformRequestBody: (body) => ({ ...body, chat_template_kwargs: { enable_thinking: false } }),
  });
  return {
    analysis: featherless.chatModel(env.analysisModel),
    vision: featherless.chatModel(env.visionModel),
    analysisModelId: env.analysisModel,
  };
}
