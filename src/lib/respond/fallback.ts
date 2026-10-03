import type { Signal } from "@/lib/domain/signal";
import type { ScamType } from "@/lib/domain/verdict";

const DELIVERY_WORDS = /\b(?:usps|fedex|dhl|ups|royal mail|parcel|package|delivery|shipment|courier)\b/i;
const BANK_WORDS = /\b(?:bank|chase|wells fargo|barclays|hsbc|santander|citi|capital one|card (?:has been|was) (?:locked|blocked))\b/i;
const BOSS_WORDS = /\b(?:boss|ceo|manager|director|invoice|client|payroll|vendor)\b/i;
const GOV_WORDS = /\b(?:irs|tax|social security|government|customs|police|court)\b/i;

/** Deterministic Scam Type for a Degraded Verdict, when the model can't classify. */
export function inferScamType(signals: readonly Signal[], exhibit: string): ScamType {
  const ids = new Set(signals.map((s) => s.id));
  if (ids.size === 0) return "none";
  if (ids.has("text.remote-access")) return "tech_support";
  if (ids.has("text.family-emergency")) return "family_emergency";
  if (ids.has("text.guaranteed-returns") || (ids.has("text.crypto-payment") && !ids.has("text.gift-card-payment")))
    return "crypto_investment";
  if (ids.has("text.gift-card-payment") || ids.has("text.wire-p2p-payment"))
    return BOSS_WORDS.test(exhibit) ? "invoice_ceo" : "other";
  if (ids.has("text.job-pay")) return "job";
  if (ids.has("text.prize")) return "prize";
  if (GOV_WORDS.test(exhibit) && ids.has("text.threat-authority")) return "government";
  if (DELIVERY_WORDS.test(exhibit)) return "delivery";
  if (BANK_WORDS.test(exhibit)) return "bank";
  if (ids.has("text.credential-request")) return "account_takeover";
  return "other";
}

const TOP_SIGNALS = 3;

export function templatedSummary(signals: readonly Signal[]): string {
  if (signals.length === 0) {
    return "Our automatic checks found no warning signs. That doesn't prove it's safe, so stay careful with links and payments.";
  }
  const reasons = signals.slice(0, TOP_SIGNALS).map((s) => s.title.charAt(0).toLowerCase() + s.title.slice(1));
  return `Our automatic checks found warning signs: it ${reasons.join("; it ")}.`;
}
