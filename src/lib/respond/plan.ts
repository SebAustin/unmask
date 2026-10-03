import type { ScamType } from "@/lib/domain/verdict";
import { BRANDS, brandDisplayName } from "@/lib/signals/brands";


const ROLE_NOUNS: readonly [RegExp, string][] = [
  [/\b(?:son|daughter|grand(?:son|daughter|ma|pa|child)|mom|mum|dad|mother|father|nephew|niece|cousin|brother|sister|family|relative)\b/i, "your family member"],
  [/\b(?:ceo|boss|manager|director|employer|hr|payroll|colleague|cfo)\b/i, "your employer"],
  [/\b(?:irs|tax)\b/i, "the IRS"],
  [/\b(?:government|agency|police|court|social security|ssa|customs|immigration)\b/i, "the government agency"],
  [/\b(?:bank|credit union|card issuer)\b/i, "your bank"],
  [/\b(?:courier|delivery|post|parcel|shipping)\b/i, "the delivery company"],
  [/\b(?:support|technician|tech|antivirus|security team)\b/i, "the company's support team"],
];

/**
 * Turns the model's free-text Claimed Identity into something safe to show inside instructions:
 * a curated brand name or a generic noun. Nothing else from the attacker's message gets through.
 */
export function safeIdentityName(claimed: string | null): string | null {
  if (!claimed) return null;
  const tokens = new Set(claimed.toLowerCase().split(/[^a-z0-9]+/));
  const compact = claimed.toLowerCase().replace(/[^a-z]/g, "");
  const brand = Object.keys(BRANDS).find((b) => tokens.has(b) || compact === b);
  if (brand) return brandDisplayName(brand);
  for (const [pattern, noun] of ROLE_NOUNS) if (pattern.test(claimed)) return noun;
  return null;
}

const NEVER_FROM_MESSAGE =
  "Don't use any link, phone number or email in the message — scammers control those. Don't reply to it either.";

export function verificationPlan(scamType: ScamType, claimedIdentity: string | null): string[] {
  const who = safeIdentityName(claimedIdentity);
  const contact = who
    ? `Contact ${who} yourself through a channel you already trust: their official app, the website you type in yourself, or the number on your card, statement or bill.`
    : "If it claims to be from a company or person you know, contact them yourself through a channel you already trust: their official app, a website you type in yourself, or a number you already have.";

  if (scamType === "none") {
    return [
      "No obvious warning signs — but stay careful: scams change constantly.",
      "If it still asks you to pay, log in or share a code, check with the sender through a channel you already trust before doing it.",
    ];
  }

  const specific: Partial<Record<ScamType, string[]>> = {
    family_emergency: [
      "Hang up or stop replying, then call your relative on the number you already have for them — not the new one.",
      "Ask a question only they would know, or use your family's safe word. AI can clone a voice from a few seconds of audio.",
    ],
    invoice_ceo: [
      "Confirm the request in person or by calling your manager on a number from the company directory.",
      "Follow your company's payment approval process. Real bosses don't ask for gift cards or secret transfers.",
    ],
    tech_support: [
      "Don't install anything or let anyone connect to your device.",
      "If you're worried about your computer, take it to a repair shop you choose or contact the maker's support from their official website.",
    ],
    crypto_investment: [
      "Look the platform up on your regulator's warning list (in the US, the SEC or CFTC) before sending anything.",
      "Talk it over with someone you trust. Guaranteed returns are never real.",
    ],
    job: [
      "Search the company's official careers page to see if the job exists.",
      "Never pay to get a job or 'unlock' earnings.",
    ],
    government: [
      "Government agencies contact you by post first and never demand gift cards, crypto or wire transfers.",
      "Call the agency on the number listed on its official .gov website.",
    ],
    delivery: ["Track the parcel by typing the courier's official website yourself, using a tracking number from the shop you bought from."],
    account_takeover: ["Never read out or forward a verification code — that code is the key to your account."],
  };

  return [NEVER_FROM_MESSAGE, contact, ...(specific[scamType] ?? [])];
}
