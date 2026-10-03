import "server-only";
import { z } from "zod";

const DEFAULT_MODEL = "Qwen/Qwen3-VL-30B-A3B-Instruct";

const EnvSchema = z.object({
  FEATHERLESS_API_KEY: z.string().trim().min(1).optional().catch(undefined),
  VISION_MODEL: z.string().trim().min(1).default(DEFAULT_MODEL),
  ANALYSIS_MODEL: z.string().trim().min(1).default(DEFAULT_MODEL),
  AI_MOCK: z.enum(["0", "1"]).default("0").catch("0"),
  VERCEL_ENV: z.string().optional(),
});

export type ServerEnv = {
  readonly apiKey: string | undefined;
  readonly visionModel: string;
  readonly analysisModel: string;
  readonly mock: boolean;
};

export function readEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const env = EnvSchema.parse(source);
  const mock = env.AI_MOCK === "1";
  if (mock && env.VERCEL_ENV === "production") {
    throw new Error("AI_MOCK must not be enabled in production.");
  }
  return { apiKey: env.FEATHERLESS_API_KEY, visionModel: env.VISION_MODEL, analysisModel: env.ANALYSIS_MODEL, mock };
}
