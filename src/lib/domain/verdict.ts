import { z } from "zod";
import { SignalSchema } from "./signal";

/** Single source of truth for Scam Type (see CONTEXT.md). */
export const ScamTypeSchema = z.enum([
  "bank",
  "government",
  "delivery",
  "tech_support",
  "job",
  "romance",
  "crypto_investment",
  "invoice_ceo",
  "family_emergency",
  "prize",
  "account_takeover",
  "other",
  "none",
]);
export type ScamType = z.infer<typeof ScamTypeSchema>;

export const SCAM_TYPE_LABELS: Readonly<Record<ScamType, string>> = {
  bank: "Bank impersonation",
  government: "Government impersonation",
  delivery: "Fake delivery notice",
  tech_support: "Tech-support scam",
  job: "Job or task scam",
  romance: "Romance scam",
  crypto_investment: "Crypto / investment scam",
  invoice_ceo: "Invoice or boss (CEO) fraud",
  family_emergency: "Family-emergency scam",
  prize: "Prize or lottery scam",
  account_takeover: "Account-takeover / code theft",
  other: "Other scam pattern",
  none: "No known scam pattern",
};

export const VerdictLabelSchema = z.enum(["scam", "suspicious", "likely_safe"]);
export type VerdictLabel = z.infer<typeof VerdictLabelSchema>;

export const DegradedReasonSchema = z.enum([
  "provider_error",
  "timeout",
  "rate_limited",
  "parse_failed",
  "not_configured",
]);
export type DegradedReason = z.infer<typeof DegradedReasonSchema>;

export const RedFlagSchema = z.object({
  quote: z.string(),
  explanation: z.string(),
  source: z.enum(["signal", "model"]),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});
export type RedFlag = z.infer<typeof RedFlagSchema>;

export const MaskSchema = z.object({
  type: z.enum(["card", "ssn", "iban", "account", "routing", "code", "password"]),
  replacement: z.string(),
});

export const VerdictSchema = z.object({
  label: VerdictLabelSchema,
  riskScore: z.number().int().min(0).max(100),
  scamType: ScamTypeSchema,
  claimedIdentity: z.string().nullable(),
  requestedAction: z.string().nullable(),
  summary: z.string(),
  unverifiable: z.array(z.string()),
  exhibit: z.string(),
  redFlags: z.array(RedFlagSchema),
  signals: z.array(SignalSchema),
  verificationPlan: z.array(z.string()),
  degraded: z.boolean(),
  degradedReason: DegradedReasonSchema.nullable(),
  masks: z.array(MaskSchema),
  phones: z.array(z.string()),
});
export type Verdict = z.infer<typeof VerdictSchema>;
