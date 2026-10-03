import { describe, expect, it } from "vitest";
import { collectSignals } from "./collect";

const ids = (exhibit: string, extra: Partial<Parameters<typeof collectSignals>[0]> = {}) =>
  collectSignals({ exhibit, urls: [], emails: [], phones: [], headers: null, ...extra }).map((s) => s.id);

describe("collectSignals", () => {
  it("combines gift-card payment with urgency into a hard combination signal", () => {
    expect(ids("Buy Apple gift cards urgently and send me the codes")).toContain("combo.payment-pressure");
  });

  it("combines a code request with brand impersonation", () => {
    const found = ids("PayPal: confirm your account at paypa1.com", { urls: ["paypa1.com"] });
    expect(found).toEqual(expect.arrayContaining(["url.lookalike-domain", "text.credential-request", "combo.credential-impersonation"]));
  });

  it("combines a family emergency with a payment request", () => {
    expect(ids("Mom it's me, I lost my phone. Can you send money via Zelle?")).toContain("combo.family-payment");
  });

  it("checks the domains of email addresses found in the message", () => {
    expect(ids("Write to support@paypa1-help.com", { emails: ["support@paypa1-help.com"] })).toContain(
      "url.lookalike-domain",
    );
  });

  it("flags a brand message whose only call to action is a phone number", () => {
    expect(ids("Amazon: unusual purchase of $899. Call 1-800-555-0199 to cancel.", { phones: ["1-800-555-0199"] })).toContain(
      "phone.only-contact-channel",
    );
  });

  it("reports each signal once even when several links trigger it", () => {
    const found = ids("see bit.ly/a and bit.ly/b", { urls: ["bit.ly/a", "bit.ly/b"] });
    expect(found.filter((id) => id === "url.shortener")).toHaveLength(1);
  });

  it("finds nothing in an everyday message", () => {
    expect(ids("Running 10 min late, save me a seat!")).toEqual([]);
  });
});

describe("collectSignals email handling", () => {
  it("never treats an email address as a disguised link", () => {
    expect(ids("Contact jane@example.org", { emails: ["jane@example.org"] })).not.toContain("url.userinfo-trick");
  });
});
