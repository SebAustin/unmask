import type { Severity, Signal } from "@/lib/domain/signal";
import type { VerdictLabel } from "@/lib/domain/verdict";

export const SEVERITY_WEIGHT: Readonly<Record<Severity, number>> = { low: 5, medium: 15, high: 30, hard: 50 };

export const SCAM_THRESHOLD = 70;
export const SUSPICIOUS_THRESHOLD = 35;
const ONE_HARD_FLOOR = 50;
const MAX_SCORE = 100;

export interface Fused {
  readonly riskScore: number;
  readonly label: VerdictLabel;
}

/**
 * Combines deterministic Signals with the model's risk estimate (ADR-0001).
 * The model can raise the score but never push it below the Signal Floor,
 * and the label always comes from the fused score, never from the model.
 */
export function fuseVerdict(signals: readonly Signal[], assessment: { riskScore: number } | null): Fused {
  const unique = dedupeById(signals);
  const signalScore = Math.min(MAX_SCORE, unique.reduce((sum, s) => sum + SEVERITY_WEIGHT[s.severity], 0));
  const riskScore = Math.round(Math.min(MAX_SCORE, Math.max(signalScore, signalFloor(unique), assessment?.riskScore ?? 0)));
  return { riskScore, label: labelFor(riskScore) };
}

export function signalFloor(signals: readonly Signal[]): number {
  const hard = signals.filter((s) => s.severity === "hard").length;
  const high = signals.some((s) => s.severity === "high");
  if (hard >= 2 || (hard === 1 && high)) return SCAM_THRESHOLD;
  if (hard === 1) return ONE_HARD_FLOOR;
  if (high) return SUSPICIOUS_THRESHOLD;
  return 0;
}

export function labelFor(riskScore: number): VerdictLabel {
  if (riskScore >= SCAM_THRESHOLD) return "scam";
  if (riskScore >= SUSPICIOUS_THRESHOLD) return "suspicious";
  return "likely_safe";
}

function dedupeById(signals: readonly Signal[]): Signal[] {
  const byId = new Map<string, Signal>();
  for (const s of signals) {
    const existing = byId.get(s.id);
    if (!existing || SEVERITY_WEIGHT[s.severity] > SEVERITY_WEIGHT[existing.severity]) byId.set(s.id, s);
  }
  return [...byId.values()];
}
