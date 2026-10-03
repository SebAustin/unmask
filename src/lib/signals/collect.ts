import type { Signal } from "@/lib/domain/signal";
import { BRANDS, brandDisplayName } from "./brands";
import { headerSignals, type EmailHeaders } from "./headers";
import { injectionSignals } from "./injection";
import { textSignals } from "./text";
import { urlSignals } from "./url";

export interface SignalInput {
  /** Redacted exhibit text. */
  readonly exhibit: string;
  readonly urls: readonly string[];
  readonly emails: readonly string[];
  readonly phones: readonly string[];
  readonly headers: EmailHeaders | null;
}

const PAYMENT_IDS = ["text.gift-card-payment", "text.crypto-payment", "text.wire-p2p-payment", "text.money-request"];
const PRESSURE_IDS = ["text.urgency", "text.secrecy"];
const IMPERSONATION_IDS = ["url.lookalike-domain", "url.brand-in-subdomain", "url.punycode", "header.display-name-brand-mismatch"];
const CALL_TO_ACTION = /\b(?:call|ring|phone|text|whatsapp|contact)\b/i;

/** Every deterministic Signal for a piece of Evidence, deduplicated, strongest first. */
export function collectSignals(input: SignalInput): Signal[] {
  const base = [
    ...textSignals(input.exhibit),
    ...input.urls.flatMap(urlSignals),
    ...input.emails.flatMap((email) => urlSignals(email.split("@")[1] ?? "")),
    ...(input.headers ? headerSignals(input.headers) : []),
    ...injectionSignals(input.exhibit),
    ...phoneSignals(input),
  ];
  const unique = dedupe(base);
  return [...unique, ...comboSignals(new Set(unique.map((s) => s.id)))];
}

function phoneSignals({ exhibit, phones, urls }: SignalInput): Signal[] {
  if (phones.length === 0 || urls.length > 0 || !CALL_TO_ACTION.test(exhibit)) return [];
  const tokens = new Set(exhibit.toLowerCase().split(/[^a-z0-9]+/));
  const brand = Object.keys(BRANDS).find((name) => tokens.has(name));
  if (!brand) return [];
  return [
    {
      id: "phone.only-contact-channel",
      severity: "medium",
      title: "Pushes you to call a number in the message",
      explanation: `It claims to be ${brandDisplayName(brand)} but wants you to call the number it gives. Scammers answer those lines. Use the number on ${brandDisplayName(brand)}'s official website or app instead.`,
      quote: phones[0],
    },
  ];
}

function comboSignals(ids: Set<string>): Signal[] {
  const has = (list: string[]) => list.some((id) => ids.has(id));
  const combos: Signal[] = [];
  if (has(PAYMENT_IDS) && has(PRESSURE_IDS)) {
    combos.push({
      id: "combo.payment-pressure",
      severity: "hard",
      title: "Untraceable payment under pressure",
      explanation: "It asks for a payment that can't be reversed and pressures you to do it fast or in secret. That combination is almost always fraud.",
    });
  }
  if (ids.has("text.credential-request") && has(IMPERSONATION_IDS)) {
    combos.push({
      id: "combo.credential-impersonation",
      severity: "hard",
      title: "Fake brand asking for your login or code",
      explanation: "It impersonates a company and asks for your login details or a code. That's how accounts get stolen.",
    });
  }
  if (ids.has("text.family-emergency") && has(PAYMENT_IDS)) {
    combos.push({
      id: "combo.family-payment",
      severity: "hard",
      title: "Relative in trouble asking for money",
      explanation: "A 'family member' with a new number or an emergency asking for money is a well-known script. AI can now clone voices, so call them back on the number you already have.",
    });
  }
  if (ids.has("header.display-name-brand-mismatch") && ids.has("header.reply-to-mismatch")) {
    combos.push({
      id: "combo.display-name-reply-to",
      severity: "hard",
      title: "Fake sender name with hidden reply address",
      explanation: "The sender pretends to be a brand and quietly routes your replies to a different address.",
    });
  }
  return combos;
}

const RANK = { hard: 3, high: 2, medium: 1, low: 0 } as const;

function dedupe(signals: Signal[]): Signal[] {
  const byId = new Map<string, Signal>();
  for (const s of signals) {
    const existing = byId.get(s.id);
    if (!existing || RANK[s.severity] > RANK[existing.severity]) byId.set(s.id, s);
  }
  return [...byId.values()].sort((a, b) => RANK[b.severity] - RANK[a.severity]);
}
