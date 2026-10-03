import { describe, expect, it } from "vitest";
import { extractContacts } from "./extract";

describe("extractContacts", () => {
  it("pulls URLs, bare domains, emails and phone numbers out of free text", () => {
    const found = extractContacts(
      "Pay at https://usps-fee.top/pay or amaz0n-help.com. Email support@paypa1-help.com or call +1 (800) 555-0100.",
    );
    expect(found.urls).toEqual(["https://usps-fee.top/pay", "amaz0n-help.com"]);
    expect(found.emails).toEqual(["support@paypa1-help.com"]);
    expect(found.phones).toEqual(["+1 (800) 555-0100"]);
  });

  it("does not mistake email domains or decimals for URLs", () => {
    expect(extractContacts("Price is 3.50 today. Mail bob@example.com").urls).toEqual([]);
  });
});
