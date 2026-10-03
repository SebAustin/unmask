import { describe, expect, it } from "vitest";
import { urlSignals } from "./url";

const ids = (url: string) => urlSignals(url).map((s) => s.id);

describe("urlSignals", () => {
  it("raises no signal for a brand's official domain", () => {
    expect(urlSignals("https://www.paypal.com/signin")).toEqual([]);
  });

  it("flags a typo-squatted brand domain as a hard lookalike", () => {
    const [signal] = urlSignals("https://paypa1.com/login");
    expect(signal.id).toBe("url.lookalike-domain");
    expect(signal.severity).toBe("hard");
    expect(signal.explanation).toMatch(/paypal\.com/);
  });

  it("flags a brand name used inside someone else's domain", () => {
    expect(ids("http://paypal.com.account-verify.ru/update")).toContain("url.brand-in-subdomain");
    expect(ids("https://secure-chase-alerts.top/x")).toContain("url.brand-in-subdomain");
  });

  it("flags punycode (internationalized) lookalikes", () => {
    expect(ids("https://xn--pypal-4ve.com")).toContain("url.punycode");
  });

  it("flags link shorteners that hide the destination", () => {
    expect(ids("https://bit.ly/3xYz")).toEqual(["url.shortener"]);
  });

  it("flags raw IP addresses and credentials-style @ tricks", () => {
    expect(ids("http://192.168.4.20/bank")).toContain("url.ip-host");
    expect(ids("https://www.amazon.com@evil.example/login")).toContain("url.userinfo-trick");
  });

  it("flags risky top-level domains", () => {
    expect(ids("https://usps-redelivery.xyz")).toContain("url.risky-tld");
  });

  it("accepts URLs without a scheme", () => {
    expect(ids("amaz0n-support.com")).toContain("url.lookalike-domain");
  });

  it("returns nothing for unparseable input", () => {
    expect(urlSignals("not a url at all")).toEqual([]);
  });

  it("only matches a brand as a whole word in the address, not inside other words", () => {
    expect(urlSignals("https://purchase.example.com/receipt")).toEqual([]);
    expect(urlSignals("https://pineapple.com")).toEqual([]);
    expect(urlSignals("https://livestream.com/events")).toEqual([]);
  });

  it("never quotes query strings, which may carry account or card numbers", () => {
    const signals = urlSignals("https://paypa1.com/login?acct=12345678&card=4111111111111111");
    expect(signals.length).toBeGreaterThan(0);
    for (const s of signals) expect(s.quote).not.toMatch(/4111|12345678/);
  });

  it("quotes the link exactly as it was written so it can be highlighted", () => {
    for (const input of ["amaz0n-support.com", "HTTPS://PayPa1.com/Login", "https://pаypal.com/x"]) {
      for (const s of urlSignals(input)) expect(input).toContain(s.quote);
    }
  });

  it("does not treat everyday words near a brand name as look-alikes", () => {
    for (const url of ["acme-finance.com", "team-up.com", "apply-now.com", "mobile-alerts.com", "horizon-bank.com"]) {
      expect(ids(url)).not.toContain("url.lookalike-domain");
    }
  });

  it("rates near-miss spellings as high and exact character swaps as hard", () => {
    expect(urlSignals("https://paypall.com")[0]).toMatchObject({ id: "url.lookalike-domain", severity: "high" });
    expect(urlSignals("https://paypa1.com")[0]).toMatchObject({ id: "url.lookalike-domain", severity: "hard" });
  });

  it("treats a brand name on a free hosting service as impersonation", () => {
    expect(ids("https://paypal-verify.s3.amazonaws.com/index.html")).toContain("url.brand-in-subdomain");
  });

  it("rates punycode as hard only when it imitates a known brand", () => {
    expect(urlSignals("https://xn--pypal-4ve.com").find((s) => s.id === "url.punycode")?.severity).toBe("hard");
    expect(urlSignals("https://xn--mnchen-3ya.de").find((s) => s.id === "url.punycode")?.severity).toBe("medium");
  });

  it("does not flag ordinary unrelated domains", () => {
    expect(urlSignals("https://github.com/vercel/next.js")).toEqual([]);
    expect(urlSignals("https://news.ycombinator.com")).toEqual([]);
  });
});

describe("urlSignals false-positive guards", () => {
  it("ignores everyday words one letter away from short brand names", () => {
    for (const url of ["stem-academy.org", "belle-salon.com", "seam-tailors.com", "chose-wisely.net"]) {
      expect(urlSignals(url).map((s) => s.id)).not.toContain("url.lookalike-domain");
    }
  });

  it("catches exact character swaps hidden in a subdomain", () => {
    expect(urlSignals("https://paypa1.account-help.com/x").map((s) => s.id)).toContain("url.lookalike-domain");
  });

  it("warns about anyone-can-publish pages on trusted domains", () => {
    expect(urlSignals("https://docs.google.com/forms/d/e/abc/viewform").map((s) => s.id)).toEqual([
      "url.user-content-on-official",
    ]);
    expect(urlSignals("https://docs.google.com/document/d/abc")).toEqual([]);
  });
});
