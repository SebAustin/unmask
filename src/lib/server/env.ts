import "server-only";
import { z } from "zod";

const DEFAULT_MODEL = "Qwen/Qwen3-VL-30B-A3B-Instruct";

/** Blank values (a common dashboard slip) fall back to the default instead of breaking every request. */
const modelId = z
  .string()
  .optional()
  .transform((v) => v?.trim() || DEFAULT_MODEL);

const EnvSchema = z.object({
  FEATHERLESS_API_KEY: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined),
  VISION_MODEL: modelId,
  ANALYSIS_MODEL: modelId,
  AI_MOCK: z
    .string()
    .optional()
    .transform((v) => ["1", "true", "yes"].includes((v ?? "").trim().toLowerCase())),
  VERCEL: z.string().optional(),
});

export type ServerEnv = {
  readonly apiKey: string | undefined;
  readonly visionModel: string;
  readonly analysisModel: string;
  readonly mock: boolean;
};

export function readEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const env = EnvSchema.parse(source);
  const mock = env.AI_MOCK;
  // Refuse the mock on any Vercel deployment (production and previews) — SECURITY.md F-06.
  if (mock && env.VERCEL === "1") {
    throw new Error("AI_MOCK must not be enabled on a deployment.");
  }
  return { apiKey: env.FEATHERLESS_API_KEY, visionModel: env.VISION_MODEL, analysisModel: env.ANALYSIS_MODEL, mock };
}
