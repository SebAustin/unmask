import { domainToUnicode } from "node:url";
import type { Signal } from "@/lib/domain/signal";
import { BRANDS, COMMON_WORD_BRANDS, LOOKALIKE_ALLOWLIST, OFFICIAL_DOMAINS, USER_CONTENT_ON_OFFICIAL } from "./brands";
import { normalizeForMatching } from "./normalize";

const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly",
  "cutt.ly", "shorturl.at", "tiny.cc", "rb.gy", "t.ly", "s.id",
]);
const RISKY_TLDS = new Set([
  "zip", "mov", "top", "xyz", "icu", "click", "live", "shop", "buzz", "rest", "gq", "tk",
  "ml", "cf", "ga", "cyou", "sbs", "cfd", "monster", "support",
]);
/** Second-level suffixes where the registrable domain has three labels (example.co.uk). */
const MULTI_PART_SUFFIXES = new Set(["co.uk", "org.uk", "ac.uk", "com.au", "co.in", "co.jp", "com.br"]);
const MAX_LOOKALIKE_DISTANCE = 2;
const MIN_BRAND_LENGTH_FOR_FUZZY = 6;
const LONG_BRAND_LENGTH = 8;
const EXCESS_SUBDOMAIN_LABELS = 5;

export function urlSignals(raw: string): Signal[] {
  const url = parseUrl(raw);
  if (!url) return [];

  const host = url.hostname.toLowerCase();
  const signals: Signal[] = [];
  // Quote the text exactly as written, cut before any query string or fragment (they can carry account numbers).
  const quote = raw.trim().split(/[?#]/)[0];

  if (url.username || url.password || /^[^/]*@/.test(stripScheme(raw.trim()))) {
    signals.push({
      id: "url.userinfo-trick",
      severity: "hard",
      title: "Link hides its real destination",
      explanation: `Everything before the "@" is ignored by browsers, so this link really goes to ${host}.`,
      quote,
    });
  }

  if (isIpAddress(host)) {
    signals.push({
      id: "url.ip-host",
      severity: "high",
      title: "Link points to a raw IP address",
      explanation: "Real companies use named websites, not bare numeric addresses.",
      quote,
    });
    return signals;
  }

  const registrable = registrableDomain(host);
  if (SHORTENERS.has(registrable)) {
    signals.push({
      id: "url.shortener",
      severity: "medium",
      title: "Shortened link hides the destination",
      explanation: `${registrable} is a link shortener; you can't see where it leads until you click.`,
      quote,
    });
    return signals;
  }

  if (host.split(".").some((label) => label.startsWith("xn--"))) {
    const decoded = normalizeForMatching(domainToUnicode(host));
    const imitatesBrand = decoded.split(/[.-]/).some((token) => token in BRANDS || matchLookalike(token) !== null);
    signals.push({
      id: "url.punycode",
      severity: imitatesBrand ? "hard" : "medium",
      title: "Look-alike characters in the web address",
      explanation: `The address uses international characters that can imitate normal letters. It really reads "${domainToUnicode(host)}".`,
      quote,
    });
  }

  if (!OFFICIAL_DOMAINS.has(registrable)) {
    signals.push(...brandSignals(host, registrable, quote));
  } else if (isUserContentOnOfficial(host, url.pathname)) {
    signals.push({
      id: "url.user-content-on-official",
      severity: "medium",
      title: "Page anyone can create on a trusted site",
      explanation: `${host} hosts forms and pages made by anyone, so a familiar address doesn't mean the company wrote it. Never enter passwords or card details there.`,
      quote,
    });
  }

  const tld = host.split(".").at(-1) ?? "";
  if (RISKY_TLDS.has(tld)) {
    signals.push({
      id: "url.risky-tld",
      severity: "medium",
      title: `Unusual ".${tld}" web address`,
      explanation: `".${tld}" addresses are cheap and frequently used for short-lived scam sites.`,
      quote,
    });
  }

  if (host.split(".").length >= EXCESS_SUBDOMAIN_LABELS) {
    signals.push({
      id: "url.excess-subdomains",
      severity: "low",
      title: "Unusually long web address",
      explanation: "Long chains of sub-addresses are often used to push the real domain out of view.",
      quote,
    });
  }

  return signals;
}

function brandSignals(host: string, registrable: string, quote: string): Signal[] {
  const ownTokens = registrable.split(".")[0].split("-");
  const subdomainTokens = host.slice(0, -registrable.length).split(/[.-]/).filter(Boolean);
  const candidates = [
    ...ownTokens.map((token) => matchLookalike(token)),
    // Subdomains are free to choose, so only exact character swaps count there.
    ...subdomainTokens.map((token) => matchLookalike(token)).filter((m) => m?.exact),
  ];
  for (const lookalike of candidates) {
    if (!lookalike) continue;
    const domain = BRANDS[lookalike.brand][0];
    return [
      {
        id: "url.lookalike-domain",
        severity: lookalike.exact ? "hard" : "high",
        title: `Look-alike of ${domain}`,
        explanation: `"${registrable}" is spelled almost like ${domain}, a classic trick to impersonate ${lookalike.brand}.`,
        quote,
      },
    ];
  }

  const hostTokens = new Set(host.split(/[.-]/));
  const brand = Object.keys(BRANDS).find((name) => hostTokens.has(name));
  if (!brand) return [];
  return [
    {
      id: "url.brand-in-subdomain",
      severity: COMMON_WORD_BRANDS.has(brand) ? "high" : "hard",
      title: `Uses the name "${brand}" on someone else's website`,
      explanation: `The real ${brand} website is ${BRANDS[brand][0]}, but this link belongs to "${registrable}".`,
      quote,
    },
  ];
}

interface LookalikeMatch {
  readonly brand: string;
  /** True when the token becomes the brand after undoing character swaps ("paypa1", "amaz0n"). */
  readonly exact: boolean;
}

/** Finds the brand a domain token imitates without being it, if any. */
function matchLookalike(token: string): LookalikeMatch | null {
  if (token in BRANDS || LOOKALIKE_ALLOWLIST.has(token)) return null;
  const normalized = normalizeLookalike(token);
  if (normalized in BRANDS) return { brand: normalized, exact: true };
  for (const brand of Object.keys(BRANDS)) {
    if (brand.length < MIN_BRAND_LENGTH_FOR_FUZZY) continue;
    const allowed = brand.length >= LONG_BRAND_LENGTH ? MAX_LOOKALIKE_DISTANCE : 1;
    if (Math.abs(normalized.length - brand.length) > allowed) continue;
    if (levenshtein(normalized, brand) <= allowed) return { brand, exact: false };
  }
  return null;
}

function isUserContentOnOfficial(host: string, path: string): boolean {
  return USER_CONTENT_ON_OFFICIAL.some(({ host: h, pathPrefix }) => host === h && path.startsWith(pathPrefix));
}

function parseUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (!url.hostname.includes(".")) return null;
    return url;
  } catch {
    return null;
  }
}

function stripScheme(value: string): string {
  return value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
}

function isIpAddress(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[");
}

export function registrableDomain(host: string): string {
  const labels = host.split(".");
  const lastTwo = labels.slice(-2).join(".");
  return MULTI_PART_SUFFIXES.has(lastTwo) ? labels.slice(-3).join(".") : lastTwo;
}

/** Undo common character swaps so "paypa1" and "amaz0n" compare equal to the brand. */
function normalizeLookalike(label: string): string {
  return label
    .replace(/0/g, "o")
    .replace(/1/g, "l")
    .replace(/3/g, "e")
    .replace(/5/g, "s")
    .replace(/rn/g, "m")
    .replace(/vv/g, "w");
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = temp;
    }
  }
  return row[b.length];
}
