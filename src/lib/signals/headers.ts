import type { Signal } from "@/lib/domain/signal";
import { BRANDS, COMMON_WORD_BRANDS, brandDisplayName } from "./brands";
import { registrableDomain } from "./url";

export type AuthResult = "pass" | "fail" | "softfail" | "none" | "neutral" | "unknown";

export interface EmailHeaders {
  readonly fromName: string | null;
  readonly subject: string | null;
  readonly fromDomain: string | null;
  readonly replyToDomain: string | null;
  readonly returnPathDomain: string | null;
  readonly auth: { readonly spf: AuthResult; readonly dkim: AuthResult; readonly dmarc: AuthResult };
}

export function parseHeaders(raw: string): EmailHeaders {
  const unfolded = raw.replace(/\r?\n[ \t]+/g, " ");
  const header = (name: string) => unfolded.match(new RegExp(`^${name}:\\s*(.+)$`, "im"))?.[1]?.trim() ?? null;

  const from = header("From");
  const authLine = header("Authentication-Results") ?? "";
  return {
    fromName: displayName(from),
    subject: header("Subject"),
    fromDomain: domainOf(from),
    replyToDomain: domainOf(header("Reply-To")),
    returnPathDomain: domainOf(header("Return-Path")),
    auth: {
      spf: authResult(authLine, "spf"),
      dkim: authResult(authLine, "dkim"),
      dmarc: authResult(authLine, "dmarc"),
    },
  };
}

export function headerSignals(headers: EmailHeaders): Signal[] {
  const signals: Signal[] = [];
  const fromRoot = headers.fromDomain ? registrableDomain(headers.fromDomain) : null;

  const claimedBrand = headers.fromName ? brandInName(headers.fromName) : null;
  if (claimedBrand && fromRoot && !BRANDS[claimedBrand].includes(fromRoot)) {
    signals.push({
      id: "header.display-name-brand-mismatch",
      severity: "hard",
      title: `Claims to be ${brandDisplayName(claimedBrand)} but isn't sent by them`,
      explanation: `The sender name says "${headers.fromName}", but the email actually came from ${headers.fromDomain}, which ${brandDisplayName(claimedBrand)} doesn't own.`,
      quote: headers.fromName ?? undefined,
    });
  }

  if (headers.replyToDomain && fromRoot && registrableDomain(headers.replyToDomain) !== fromRoot) {
    signals.push({
      id: "header.reply-to-mismatch",
      severity: "medium",
      title: "Replies go to a different address",
      explanation: `If you hit reply, your answer goes to ${headers.replyToDomain}, not to ${headers.fromDomain}.`,
    });
  }

  const failed = (Object.entries(headers.auth) as [string, AuthResult][])
    .filter(([, result]) => result === "fail" || result === "softfail")
    .map(([name]) => name.toUpperCase());
  if (failed.length > 0) {
    signals.push({
      id: "header.auth-fail",
      severity: "high",
      title: "Email failed sender authentication",
      explanation: `${failed.join(", ")} failed: the receiving mail server could not confirm this email really came from the domain it claims.`,
    });
  }

  if (headers.returnPathDomain && fromRoot && registrableDomain(headers.returnPathDomain) !== fromRoot) {
    signals.push({
      id: "header.return-path-mismatch",
      severity: "low",
      title: "Bounce address on another domain",
      explanation: `Bounces go to ${headers.returnPathDomain}. Bulk-mail services do this legitimately, so on its own this means little.`,
    });
  }

  return signals;
}

/** `"PayPal" <a@b.com>` → `PayPal`. Parsed with indexOf: the old regex was quadratic on long inputs. */
function displayName(from: string | null): string | null {
  if (!from) return null;
  const angle = from.indexOf("<");
  if (angle <= 0) return null;
  const name = from.slice(0, angle).trim().replace(/^"|"$/g, "").trim();
  return name || null;
}

function domainOf(value: string | null): string | null {
  return value?.match(/@([a-z0-9.-]+\.[a-z]{2,})/i)?.[1]?.toLowerCase() ?? null;
}

function authResult(line: string, mechanism: string): AuthResult {
  const value = line.match(new RegExp(`\\b${mechanism}=(\\w+)`, "i"))?.[1]?.toLowerCase();
  const known: AuthResult[] = ["pass", "fail", "softfail", "none", "neutral"];
  return known.includes(value as AuthResult) ? (value as AuthResult) : "unknown";
}

const BRAND_CONTEXT = /\b(?:bank|support|security|service|services|team|account|accounts|billing|alerts?|help|online|id|pay|card|customer)\b/i;

function brandInName(name: string): string | null {
  const tokens = new Set(name.toLowerCase().split(/[^a-z0-9]+/));
  const compact = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const brand = Object.keys(BRANDS).find((b) => tokens.has(b) || compact === b) ?? null;
  // "Chase Miller" is a person; "Chase Bank" or "Apple Support" is a brand claim.
  if (brand && COMMON_WORD_BRANDS.has(brand) && !BRAND_CONTEXT.test(name)) return null;
  return brand;
}

