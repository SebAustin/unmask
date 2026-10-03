import { generateText, type LanguageModel, type ModelMessage } from "ai";
import type { DegradedReason, Verdict } from "@/lib/domain/verdict";
import type { Submission } from "@/lib/domain/submission";
import { extractContacts } from "@/lib/evidence/extract";
import { fuseVerdict } from "@/lib/fuse/fuse";
import { matchSpans, type CandidateFlag } from "@/lib/fuse/spans";
import { redact } from "@/lib/redact/redact";
import { inferScamType, templatedSummary } from "@/lib/respond/fallback";
import { verificationPlan } from "@/lib/respond/plan";
import { collectSignals } from "@/lib/signals/collect";
import { parseHeaders } from "@/lib/signals/headers";
import { parseAssessment, type ModelAssessment } from "./assessment";
import { ANALYSIS_SYSTEM_PROMPT, REPAIR_PROMPT, VISION_SYSTEM_PROMPT, buildAnalysisPrompt } from "./prompt";

export interface Deadlines {
  /** Whole-request budget for text-only submissions. */
  readonly text: number;
  /** Whole-request budget when a screenshot is included. */
  readonly image: number;
  /** Cap for the vision call itself. */
  readonly vision: number;
  /** The repair retry only runs if at least this much time is left. */
  readonly minRepair: number;
}

export const DEFAULT_DEADLINES: Deadlines = { text: 18_000, image: 35_000, vision: 15_000, minRepair: 5_000 };

export interface AnalyzeDeps {
  readonly analysisModel: LanguageModel | null;
  readonly visionModel: LanguageModel | null;
  readonly analysisModelId: string;
  readonly deadlinesMs?: Deadlines;
  readonly now?: () => number;
  readonly boundary?: () => string;
  /** Extra provider request options (e.g. disabling "thinking" on hybrid reasoning models). */
  readonly providerOptions?: Parameters<typeof generateText>[0]["providerOptions"];
}

export type AnalyzeResult =
  | { ok: true; verdict: Verdict; meta: AnalyzeMeta }
  | { ok: false; code: "image_unreadable"; message: string; meta: AnalyzeMeta };

export interface AnalyzeMeta {
  readonly visionMs: number | null;
  readonly analysisMs: number | null;
  readonly repairRetried: boolean;
}

type ModelOutcome = { ok: true; assessment: ModelAssessment } | { ok: false; reason: DegradedReason };

export async function analyzeSubmission(submission: Submission, deps: AnalyzeDeps): Promise<AnalyzeResult> {
  const now = deps.now ?? Date.now;
  const deadlines = deps.deadlinesMs ?? DEFAULT_DEADLINES;
  const startedAt = now();
  const deadline = startedAt + (submission.image ? deadlines.image : deadlines.text);
  const remaining = () => Math.max(0, deadline - now());
  const unverifiable: string[] = [];
  const meta = { visionMs: null as number | null, analysisMs: null as number | null, repairRetried: false };

  let visionText = "";
  if (submission.image) {
    const visionStart = now();
    const read = await readScreenshot(submission.image, deps.visionModel, Math.min(deadlines.vision, remaining()), deps);
    meta.visionMs = now() - visionStart;
    if (read === null) {
      const hasOtherInput = Boolean(submission.text || submission.url || submission.headers);
      if (!hasOtherInput) {
        return {
          ok: false,
          code: "image_unreadable",
          message: "We couldn't read that screenshot. Try pasting the message text instead.",
          meta,
        };
      }
      unverifiable.push("The screenshot could not be read.");
    } else {
      visionText = read;
    }
  }

  const rawExhibit = composeExhibit(submission, visionText);
  const { text: exhibit, masks } = redact(rawExhibit);
  const contacts = extractContacts(exhibit);
  const headers = submission.headers ? parseHeaders(submission.headers) : null;
  const signals = collectSignals({ exhibit, ...contacts, headers });

  const analysisStart = now();
  const outcome = await assess(exhibit, signals, deps, remaining, deadlines.minRepair, meta);
  meta.analysisMs = now() - analysisStart;

  const assessment = outcome.ok ? outcome.assessment : null;
  const fused = fuseVerdict(signals, assessment);
  const candidates: CandidateFlag[] = [
    ...signals.filter((s) => s.quote).map((s) => ({ quote: s.quote!, explanation: s.title, source: "signal" as const })),
    ...(assessment?.redFlags ?? []).map((f) => ({ ...f, source: "model" as const })),
  ];
  const scamType = assessment?.scamType ?? inferScamType(signals, exhibit);
  const planType = fused.label === "likely_safe" ? "none" : scamType === "none" ? "other" : scamType;

  const verdict: Verdict = {
    label: fused.label,
    riskScore: fused.riskScore,
    scamType: fused.label === "likely_safe" ? scamType : planType,
    claimedIdentity: assessment?.claimedIdentity ?? null,
    requestedAction: assessment?.requestedAction ?? null,
    summary: assessment?.summary || templatedSummary(signals),
    unverifiable: [...unverifiable, ...(assessment?.unverifiable ?? [])],
    exhibit,
    redFlags: matchSpans(candidates, exhibit),
    signals,
    verificationPlan: verificationPlan(planType, assessment?.claimedIdentity ?? null),
    degraded: !outcome.ok,
    degradedReason: outcome.ok ? null : outcome.reason,
    masks: [...masks],
    phones: contacts.phones,
  };
  return { ok: true, verdict, meta };
}

function composeExhibit(submission: Submission, visionText: string): string {
  const parts = [submission.text, visionText].filter((p): p is string => Boolean(p));
  if (submission.url && !parts.some((p) => p.includes(submission.url!))) parts.push(submission.url);
  if (parts.length === 0 && submission.headers) parts.push(submission.headers);
  return parts.join("\n\n");
}

async function assess(
  exhibit: string,
  signals: Parameters<typeof buildAnalysisPrompt>[0]["signals"],
  deps: AnalyzeDeps,
  remaining: () => number,
  minRepair: number,
  meta: { repairRetried: boolean },
): Promise<ModelOutcome> {
  if (!deps.analysisModel) return { ok: false, reason: "not_configured" };

  const prompt = buildAnalysisPrompt({ exhibit, signals, boundary: (deps.boundary ?? randomBoundary)() });
  const messages: ModelMessage[] = [{ role: "user", content: prompt }];
  try {
    const first = await callModel(deps, messages, remaining());
    const parsed = parseAssessment(first);
    if (parsed.ok) return { ok: true, assessment: parsed.value };
    if (remaining() < minRepair) return { ok: false, reason: "parse_failed" };

    meta.repairRetried = true;
    const second = await callModel(
      deps,
      [...messages, { role: "assistant", content: first }, { role: "user", content: REPAIR_PROMPT }],
      remaining(),
    );
    const repaired = parseAssessment(second);
    return repaired.ok ? { ok: true, assessment: repaired.value } : { ok: false, reason: "parse_failed" };
  } catch (error) {
    return { ok: false, reason: classifyError(error) };
  }
}

async function callModel(deps: AnalyzeDeps, messages: ModelMessage[], timeoutMs: number): Promise<string> {
  if (timeoutMs <= 0) throw Object.assign(new Error("Deadline exceeded"), { name: "TimeoutError" });
  const { text } = await generateText({
    model: deps.analysisModel!,
    system: ANALYSIS_SYSTEM_PROMPT,
    messages,
    temperature: 0.1,
    maxOutputTokens: 900,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(timeoutMs),
    providerOptions: deps.providerOptions,
  });
  return text;
}

async function readScreenshot(
  dataUrl: string,
  model: LanguageModel | null,
  timeoutMs: number,
  deps: AnalyzeDeps,
): Promise<string | null> {
  if (!model || timeoutMs <= 0) return null;
  const [header, base64] = dataUrl.split(",", 2);
  const mediaType = header.slice("data:".length, header.indexOf(";"));
  try {
    const { text } = await generateText({
      model,
      system: VISION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe this screenshot and list fraud-relevant visual cues as JSON." },
            { type: "file", mediaType, data: base64 },
          ],
        },
      ],
      temperature: 0,
      maxOutputTokens: 1500,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(timeoutMs),
      providerOptions: deps.providerOptions,
    });
    return parseVision(text);
  } catch {
    return null;
  }
}

/** Accepts the requested JSON, or falls back to treating the whole reply as the transcription. */
function parseVision(raw: string): string | null {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const json = JSON.parse(cleaned.slice(start, end + 1)) as { text?: unknown; visualCues?: unknown };
      const text = typeof json.text === "string" ? json.text.trim() : "";
      const cues = Array.isArray(json.visualCues) ? json.visualCues.filter((c) => typeof c === "string") : [];
      const combined = [text, cues.length ? `[Visual cues: ${cues.join("; ")}]` : ""].filter(Boolean).join("\n");
      return combined || null;
    } catch {
      // fall through to raw text
    }
  }
  return cleaned || null;
}

function classifyError(error: unknown): DegradedReason {
  const e = error as { name?: string; statusCode?: number; cause?: { name?: string } };
  if (e?.name === "AbortError" || e?.name === "TimeoutError" || e?.cause?.name === "TimeoutError") return "timeout";
  if (e?.statusCode === 429) return "rate_limited";
  return "provider_error";
}

function randomBoundary(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}
