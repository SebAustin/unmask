import { describe, expect, it } from "vitest";
import { matchSpans } from "./spans";

const exhibit = "URGENT: Your PayPal account is locked. Verify at paypa1.com now.";

describe("matchSpans", () => {
  it("keeps quotes found in the exhibit, with real offsets, sorted by position", () => {
    const flags = matchSpans(
      [
        { quote: "paypa1.com", explanation: "look-alike", source: "signal" },
        { quote: "URGENT", explanation: "pressure", source: "model" },
      ],
      exhibit,
    );
    expect(flags.map((f) => [f.quote, f.start, f.end])).toEqual([
      ["URGENT", 0, 6],
      ["paypa1.com", 49, 59],
    ]);
  });

  it("matches case-insensitively but returns the exhibit's own text", () => {
    const [flag] = matchSpans([{ quote: "your paypal account", explanation: "x", source: "model" }], exhibit);
    expect(flag.quote).toBe("Your PayPal account");
    expect(exhibit.slice(flag.start, flag.end)).toBe(flag.quote);
  });

  it("keeps offsets exact even when lower-casing would change the string length", () => {
    const tricky = "İİİİ Send gift cards now";
    const [flag] = matchSpans([{ quote: "gift cards", explanation: "x", source: "model" }], tricky);
    expect(tricky.slice(flag.start, flag.end)).toBe("gift cards");
  });

  it("drops quotes that don't appear verbatim (hallucinated or paraphrased)", () => {
    expect(matchSpans([{ quote: "click the link", explanation: "x", source: "model" }], exhibit)).toEqual([]);
    expect(matchSpans([{ quote: "  ", explanation: "x", source: "model" }], exhibit)).toEqual([]);
  });

  it("drops spans that overlap one already kept", () => {
    const flags = matchSpans(
      [
        { quote: "account is locked", explanation: "a", source: "signal" },
        { quote: "is locked", explanation: "b", source: "model" },
      ],
      exhibit,
    );
    expect(flags).toHaveLength(1);
  });
});
