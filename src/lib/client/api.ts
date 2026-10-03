import type { Verdict } from "@/lib/domain/verdict";
import type { Submission } from "@/lib/domain/submission";

export type AnalyzeResponse = { ok: true; verdict: Verdict } | { ok: false; message: string };

/** Longer than the server route maxDuration (60 s) so slow uploads aren't cut off client-side. */
const CLIENT_TIMEOUT_MS = 70_000;
const OVERSIZE_MESSAGE = "That's too large to check. Try a smaller screenshot or shorter text.";

/**
 * Combines the caller's abort signal with a timeout. Avoids AbortSignal.any / AbortSignal.timeout,
 * which older Safari (< 17.4, iOS 16) lacks — calling them would fail every request (robustness H-D).
 */
function withTimeout(
  signal: AbortSignal | undefined,
  ms: number,
  timedOut: { value: boolean },
): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    timedOut.value = true;
    controller.abort();
  }, ms);
  const clear = () => clearTimeout(timer);
  controller.signal.addEventListener("abort", clear, { once: true });
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return { signal: controller.signal, clear };
}

export async function requestAnalysis(submission: Submission, signal?: AbortSignal): Promise<AnalyzeResponse> {
  let response: Response;
  const timedOut = { value: false };
  const deadline = withTimeout(signal, CLIENT_TIMEOUT_MS, timedOut);
  try {
    response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submission),
      signal: deadline.signal,
    });
  } catch {
    deadline.clear();
    if (timedOut.value) {
      return { ok: false, message: "That took too long. Please try again in a moment." };
    }
    return { ok: false, message: "We couldn't reach Unmask. Check your connection and try again." };
  }

  try {
    return await readEnvelope(response);
  } finally {
    deadline.clear();
  }
}

async function readEnvelope(response: Response): Promise<AnalyzeResponse> {
  // Vercel rejects oversized bodies before our handler runs, with a non-JSON 413.
  if (response.status === 413) return { ok: false, message: OVERSIZE_MESSAGE };

  try {
    const body = (await response.json()) as { ok: boolean; data: Verdict | null; error: { message: string } | null };
    if (body.ok && body.data) return { ok: true, verdict: body.data };
    return { ok: false, message: body.error?.message ?? "Something went wrong. Please try again." };
  } catch {
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
