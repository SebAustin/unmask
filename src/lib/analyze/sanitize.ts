import { extractContacts } from "@/lib/evidence/extract";
import { OFFICIAL_DOMAINS, USER_CONTENT_ON_OFFICIAL } from "@/lib/signals/brands";
import { registrableDomain } from "@/lib/signals/url";

const REMOVED = "[contact removed]";

/**
 * Model text is shown as Unmask's own words, but the model read attacker-written content.
 * Remove any phone number, link or email so a steered model can't hand out a scammer's contact details.
 */
export function stripContacts(text: string): string {
  const { urls, emails, phones } = extractContacts(text);
  // Official brand domains ("paypal.com") are safe advice to keep — except anyone-can-publish hosts
  // on them (docs.google.com/forms, sites.google.com, forms.office.com…), which are classic phishing hosts.
  const isSafeOfficial = (url: string) => {
    const host = url.replace(/^https?:\/\//i, "").split(/[/?#]/)[0].toLowerCase();
    return OFFICIAL_DOMAINS.has(registrableDomain(host)) && !USER_CONTENT_ON_OFFICIAL.some((entry) => entry.host === host);
  };
  const risky = urls.filter((url) => !isSafeOfficial(url));
  return [...emails, ...risky, ...phones]
    .sort((a, b) => b.length - a.length)
    .reduce((acc, contact) => acc.split(contact).join(REMOVED), text);
}
