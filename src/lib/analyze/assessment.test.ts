import { describe, expect, it } from "vitest";
import { parseAssessment } from "./assessment";

const valid = {
  riskScore: 91,
  scamType: "delivery",
  claimedIdentity: "USPS",
  requestedAction: "Pay a $1.99 redelivery fee",
  summary: "A fake USPS text asking for a small fee.",
  unverifiable: ["Whether a parcel is really pending"],
  redFlags: [{ quote: "redelivery fee", explanation: "USPS doesn't charge fees by text." }],
};

describe("parseAssessment", () => {
  it("parses a clean JSON object", () => {
    const result = parseAssessment(JSON.stringify(valid));
    expect(result).toEqual({ ok: true, value: valid });
  });

  it("tolerates code fences, chatter and <think> blocks around the JSON", () => {
    const raw = `<think>Let me consider { the } message</think>\nSure! Here it is:\n\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``;
    expect(parseAssessment(raw)).toMatchObject({ ok: true, value: { riskScore: 91 } });
  });

  it("coerces sloppy fields instead of failing", () => {
    const sloppy = { ...valid, riskScore: "85", scamType: "parcel scam", unverifiable: undefined, redFlags: undefined };
    expect(parseAssessment(JSON.stringify(sloppy))).toMatchObject({
      ok: true,
      value: { riskScore: 85, scamType: "other", unverifiable: [], redFlags: [] },
    });
  });

  it("keeps valid red flags when one is malformed", () => {
    const mixed = { ...valid, redFlags: [{ quote: "a" }, { quote: "redelivery fee", explanation: "fee" }] };
    expect(parseAssessment(JSON.stringify(mixed))).toMatchObject({ value: { redFlags: [{ quote: "redelivery fee" }] } });
  });

  it("rejects a null or empty risk score so the repair retry can run", () => {
    expect(parseAssessment(JSON.stringify({ ...valid, riskScore: null }))).toMatchObject({ ok: false });
    expect(parseAssessment(JSON.stringify({ ...valid, riskScore: "" }))).toMatchObject({ ok: false });
  });

  it("clamps the risk score to 0-100", () => {
    expect(parseAssessment(JSON.stringify({ ...valid, riskScore: 140 }))).toMatchObject({ value: { riskScore: 100 } });
  });

  it("fails clearly on text with no JSON or with a missing risk score", () => {
    expect(parseAssessment("I think this is a scam.")).toMatchObject({ ok: false });
    expect(parseAssessment(JSON.stringify({ summary: "x" }))).toMatchObject({ ok: false });
    expect(parseAssessment("{ broken json")).toMatchObject({ ok: false });
  });
});
