import { describe, expect, it } from "vitest";
import { stripContacts } from "./sanitize";

describe("stripContacts", () => {
  it("keeps official brand domains but removes everything else", () => {
    expect(stripContacts("Go to paypal.com yourself, not paypal.com.evil.ru")).toBe("Go to paypal.com yourself, not [contact removed]");
  });

  it("removes anyone-can-publish pages even on official domains", () => {
    for (const url of ["docs.google.com/forms/d/e/abc/viewform", "sites.google.com/view/paypal-help", "forms.office.com/r/abc123"]) {
      expect(stripContacts(`Verify at ${url} now`)).toBe("Verify at [contact removed] now");
    }
  });

  it("removes phone numbers and emails", () => {
    expect(stripContacts("Call +1 (888) 555-0199 or email help@amaz0n.support")).not.toMatch(/555|amaz0n/);
  });
});
