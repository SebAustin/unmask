import { z } from "zod";
import { ScamTypeSchema } from "@/lib/domain/verdict";

const MAX_RED_FLAGS = 8;
const MAX_TEXT = 600;

function keepValid<T extends z.ZodType>(item: T) {
  return z
    .array(z.unknown())
    .catch([])
    .default([])
    .transform((values) => values.flatMap((value) => {
      const parsed = item.safeParse(value);
      return parsed.success ? [parsed.data as z.infer<T>] : [];
    }));
}

const shortText = z.string().trim().max(MAX_TEXT).catch((ctx) => String(ctx.value ?? "").slice(0, MAX_TEXT));

export const ModelAssessmentSchema = z.object({
  // Number or numeric string only: null/"" must fail so the repair retry runs (not silently become 0).
  riskScore: z
    .union([z.number(), z.string().trim().regex(/^\d+(?:\.\d+)?$/).transform(Number)])
    .transform((n) => Math.round(Math.min(100, Math.max(0, n)))),
  scamType: ScamTypeSchema.catch("other"),
  claimedIdentity: z.string().trim().max(120).nullable().catch(null).default(null),
  requestedAction: z.string().trim().max(240).nullable().catch(null).default(null),
  summary: shortText.default(""),
  unverifiable: keepValid(z.string().trim().min(1).max(240)).transform((items) => items.slice(0, 6)),
  // One malformed flag must not throw away the others.
  redFlags: keepValid(z.object({ quote: z.string().max(300), explanation: z.string().max(MAX_TEXT) })).transform((flags) =>
    flags.slice(0, MAX_RED_FLAGS),
  ),
});
export type ModelAssessment = z.infer<typeof ModelAssessmentSchema>;

export type ParseResult = { ok: true; value: ModelAssessment } | { ok: false; error: string };

/** Extracts and validates the model's JSON, forgiving the usual open-model formatting habits. */
export function parseAssessment(raw: string): ParseResult {
  const withoutThinking = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const start = withoutThinking.indexOf("{");
  const end = withoutThinking.lastIndexOf("}");
  if (start < 0 || end <= start) return { ok: false, error: "No JSON object in model output" };

  let json: unknown;
  try {
    json = JSON.parse(withoutThinking.slice(start, end + 1));
  } catch (error) {
    return { ok: false, error: `Invalid JSON: ${(error as Error).message}` };
  }

  const parsed = ModelAssessmentSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.path.join(".") || i.message).join(", ") };
  if (Number.isNaN(parsed.data.riskScore)) return { ok: false, error: "riskScore is not a number" };
  return { ok: true, value: parsed.data };
}
