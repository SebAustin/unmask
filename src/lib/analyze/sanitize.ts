import { extractContacts } from "@/lib/evidence/extract";
import { OFFICIAL_DOMAINS } from "@/lib/signals/brands";
import { registrableDomain } from "@/lib/signals/url";

const REMOVED = "[contact removed]";

/**
 * Model text is shown as Unmask's own words, but the model read attacker-written content.
 * Remove any phone number, link or email so a steered model can't hand out a scammer's contact details.
 */
export function stripContacts(text: string): string {
  const { urls, emails, phones } = extractContacts(text);
  // Official brand domains ("paypal.com") are safe advice to keep; everything else goes.
  const risky = urls.filter((url) => !OFFICIAL_DOMAINS.has(registrableDomain(url.replace(/^https?:\/\//i, "").split(/[/?#]/)[0].toLowerCase())));
  return [...emails, ...risky, ...phones]
    .sort((a, b) => b.length - a.length)
    .reduce((acc, contact) => acc.split(contact).join(REMOVED), text);
}
