import { describe, expect, it } from "vitest";
import type { Signal } from "@/lib/domain/signal";
import { inferScamType, templatedSummary } from "./fallback";

const s = (id: string, title = id): Signal => ({ id, severity: "high", title, explanation: "" });

describe("inferScamType", () => {
  it("maps signal patterns to a scam type when the model is unavailable", () => {
    expect(inferScamType([s("text.remote-access")], "")).toBe("tech_support");
    expect(inferScamType([s("text.gift-card-payment")], "boss needs this")).toBe("invoice_ceo");
    expect(inferScamType([s("text.guaranteed-returns")], "")).toBe("crypto_investment");
    expect(inferScamType([s("text.family-emergency")], "")).toBe("family_emergency");
    expect(inferScamType([s("url.lookalike-domain")], "Your USPS parcel is waiting")).toBe("delivery");
    expect(inferScamType([], "lunch?")).toBe("none");
    expect(inferScamType([s("text.urgency")], "")).toBe("other");
  });
});

describe("templatedSummary", () => {
  it("names the strongest warning signs in plain words", () => {
    expect(templatedSummary([s("a", "Asks for gift cards"), s("b", "Creates false urgency")])).toMatch(
      /asks for gift cards.*creates false urgency/i,
    );
    expect(templatedSummary([])).toMatch(/no warning signs/i);
  });
});
