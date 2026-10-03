export interface Contacts {
  readonly urls: string[];
  readonly emails: string[];
  readonly phones: string[];
}

const EMAIL = /(?<![a-z0-9._%+-])[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const URL_WITH_SCHEME = /\bhttps?:\/\/[^\s<>"')]+/gi;
const BARE_DOMAIN = /(?<![a-z0-9.-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?:\/[^\s<>"')]*)?/gi;
const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;
const MIN_PHONE_DIGITS = 10;
/** Bounds the per-item work on adversarial input; real messages carry a handful of contacts. */
const MAX_ITEMS = 25;

export function extractContacts(text: string): Contacts {
  const emails = unique(text.match(EMAIL) ?? []).slice(0, MAX_ITEMS);
  const withoutEmails = emails.reduce((acc, email) => acc.split(email).join(" "), text);

  const schemed = (withoutEmails.match(URL_WITH_SCHEME) ?? []).map(trimPunctuation);
  const withoutSchemed = schemed.reduce((acc, url) => acc.split(url).join(" "), withoutEmails);
  const bare = (withoutSchemed.match(BARE_DOMAIN) ?? []).map(trimPunctuation).filter(looksLikeDomain);

  const phones = (text.match(PHONE) ?? [])
    .map((p) => p.trim())
    .filter((p) => p.replace(/\D/g, "").length >= MIN_PHONE_DIGITS);

  return { urls: unique([...schemed, ...bare]).slice(0, MAX_ITEMS), emails, phones: unique(phones).slice(0, MAX_ITEMS) };
}

function trimPunctuation(value: string): string {
  return value.replace(TRAILING_PUNCTUATION, "");
}

/** Rejects "3.50" style numbers and file names; keeps things that end in a letter TLD. */
function looksLikeDomain(value: string): boolean {
  const host = value.split("/")[0];
  return /[a-z]/i.test(host.split(".")[0]) && !/\.(?:jpg|png|pdf|txt|docx?)$/i.test(host);
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
