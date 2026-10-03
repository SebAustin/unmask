import { extractContacts } from "@/lib/evidence/extract";

const REMOVED = "[contact removed]";

/**
 * Model text is shown as Unmask's own words, but the model read attacker-written content.
 * Remove any phone number, link or email so a steered model can't hand out a scammer's contact details.
 */
export function stripContacts(text: string): string {
  const { urls, emails, phones } = extractContacts(text);
  return [...emails, ...urls, ...phones]
    .sort((a, b) => b.length - a.length)
    .reduce((acc, contact) => acc.split(contact).join(REMOVED), text);
}
