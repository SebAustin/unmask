import "server-only";
import type { Verdict } from "@/lib/domain/verdict";
import { LIMITS, SubmissionSchema } from "@/lib/domain/submission";
import { analyzeSubmission } from "@/lib/analyze/analyze";
import { readEnv, type ServerEnv } from "./env";
import { logEvent } from "./log";
import { buildModels } from "./models";
import { clientKey, createRateLimiter, type RateLimiter } from "./rate-limit";

export type ErrorCode =
  | "invalid_input"
  | "unsupported_media_type"
  | "payload_too_large"
  | "rate_limited"
  | "image_unreadable"
  | "internal_error";

export interface ApiEnvelope<T> {
  readonly ok: boolean;
  readonly data: T | null;
  readonly error: { readonly code: ErrorCode; readonly message: string } | null;
  readonly requestId: string;
}

const DEFAULT_RATE_LIMIT_PER_MINUTE = 10;
const configuredLimit = Number(process.env.RATE_LIMIT_PER_MINUTE);
const defaultLimiter = createRateLimiter(
  Number.isInteger(configuredLimit) && configuredLimit > 0 ? configuredLimit : DEFAULT_RATE_LIMIT_PER_MINUTE,
  60_000,
);

export interface HandlerDeps {
  readonly env?: ServerEnv;
  readonly limiter?: RateLimiter;
}

export async function handleAnalyze(request: Request, deps: HandlerDeps = {}): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const fail = (status: number, code: ErrorCode, message: string, headers: HeadersInit = {}) => {
    logEvent({ requestId, event: status === 429 ? "analyze.rate_limited" : "analyze.rejected", status, errorCode: code });
    return json<Verdict>({ ok: false, data: null, error: { code, message }, requestId }, status, headers);
  };

  const limit = (deps.limiter ?? defaultLimiter).check(clientKey(request.headers));
  if (!limit.allowed) {
    return fail(429, "rate_limited", "Too many checks in a short time. Please wait a minute and try again.", {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  // Requiring JSON also forces a CORS preflight for cross-site posts (SECURITY.md F-09).
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return fail(415, "unsupported_media_type", "Please send the request as JSON.");
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > LIMITS.bodyBytes) return fail(413, "payload_too_large", "That's too large to check. Try a smaller screenshot or shorter text.");

  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > LIMITS.bodyBytes) return fail(413, "payload_too_large", "That's too large to check. Try a smaller screenshot or shorter text.");
    body = JSON.parse(raw);
  } catch {
    return fail(400, "invalid_input", "The request couldn't be read. Please try again.");
  }

  const parsed = SubmissionSchema.safeParse(body);
  if (!parsed.success) return fail(400, "invalid_input", parsed.error.issues[0]?.message ?? "Invalid input.");

  try {
    const env = deps.env ?? readEnv();
    const mockMode = env.mock ? (request.headers.get("x-unmask-mock") ?? undefined) : undefined;
    const models = buildModels(env, mockMode);
    const result = await analyzeSubmission(parsed.data, {
      analysisModel: models.analysis,
      visionModel: models.vision,
      analysisModelId: models.analysisModelId,
    });
    const inputTypes = (["text", "url", "headers", "image"] as const).filter((k) => parsed.data[k]);
    const base = {
      requestId,
      inputTypes,
      latencyMs: Date.now() - startedAt,
      visionMs: result.meta.visionMs,
      analysisMs: result.meta.analysisMs,
      repairRetried: result.meta.repairRetried,
      visionError: result.meta.visionError,
      analysisError: result.meta.analysisError,
      model: models.analysisModelId,
    };
    if (!result.ok) {
      logEvent({ ...base, event: "analyze.rejected", status: 422, errorCode: result.code });
      return json<Verdict>({ ok: false, data: null, error: { code: result.code, message: result.message }, requestId }, 422);
    }
    logEvent({
      ...base,
      event: "analyze.ok",
      status: 200,
      degraded: result.verdict.degraded,
      degradedReason: result.verdict.degradedReason,
      label: result.verdict.label,
    });
    return json<Verdict>({ ok: true, data: result.verdict, error: null, requestId }, 200);
  } catch (error) {
    logEvent({
      requestId,
      event: "analyze.error",
      status: 500,
      errorCode: (error as Error).name,
      // Frame lines only ("at …"): multi-line messages could carry user content.
      stack: (error as Error).stack?.split("\n").filter((line) => /^\s*at /.test(line)).slice(0, 5).map((line) => line.trim()),
    });
    return json<Verdict>(
      { ok: false, data: null, error: { code: "internal_error", message: "Something went wrong on our side. Please try again." }, requestId },
      500,
    );
  }
}

function json<T>(body: ApiEnvelope<T>, status: number, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}
