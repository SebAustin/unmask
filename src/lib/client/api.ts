import type { Verdict } from "@/lib/domain/verdict";
import type { Submission } from "@/lib/domain/submission";

export type AnalyzeResponse = { ok: true; verdict: Verdict } | { ok: false; message: string };

const CLIENT_TIMEOUT_MS = 45_000;
const OVERSIZE_MESSAGE = "That's too large to check. Try a smaller screenshot or shorter text.";

export async function requestAnalysis(submission: Submission, signal?: AbortSignal): Promise<AnalyzeResponse> {
  let response: Response;
  try {
    response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submission),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(CLIENT_TIMEOUT_MS)]) : AbortSignal.timeout(CLIENT_TIMEOUT_MS),
    });
  } catch (error) {
    if ((error as Error).name === "TimeoutError") {
      return { ok: false, message: "That took too long. Please try again in a moment." };
    }
    return { ok: false, message: "We couldn't reach Unmask. Check your connection and try again." };
  }

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
