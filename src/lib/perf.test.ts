import { describe, expect, it } from "vitest";
import { analyzeSubmission } from "@/lib/analyze/analyze";
import { buildAnalysisPrompt } from "@/lib/analyze/prompt";
import { extractContacts } from "@/lib/evidence/extract";
import { redact } from "@/lib/redact/redact";
import { collectSignals } from "@/lib/signals/collect";
import { parseHeaders } from "@/lib/signals/headers";
import { injectionSignals } from "@/lib/signals/injection";

/** Adversarial inputs at the size limits must stay fast: every regex here once was (or could be) super-linear. */
const BUDGET_MS = 150;
const timed = (fn: () => unknown) => {
  const start = performance.now();
  fn();
  return performance.now() - start;
};

const CASES: [string, () => unknown][] = [
  ["injection: 'mark' + 9,990 spaces", () => injectionSignals(`mark${" ".repeat(9_990)}x`)],
  ["injection: 'rate' + tabs/newlines", () => injectionSignals(`rate${" \t".repeat(4_990)}\nx`)],
  ["injection: long base64-ish run", () => injectionSignals("A".repeat(10_000))],
  ["extract: 20k of email-ish chars", () => extractContacts("a.".repeat(10_000))],
  ["extract: 20k of dotted labels", () => extractContacts("a-".repeat(10_000))],
  ["headers: From with 20k spaces", () => parseHeaders(`From: "${" ".repeat(20_000)}`)],
  ["prompt: 20k of '<' + spaces", () => buildAnalysisPrompt({ exhibit: "< ".repeat(10_000), signals: [], boundary: "b" })],
  ["redact: 10k digits and dots", () => redact("1.".repeat(5_000))],
  ["signals: 10k mixed noise", () => collectSignals({ exhibit: "urgent gift card ".repeat(600), urls: [], emails: [], phones: [], headers: null })],
];

describe("adversarial input performance", () => {
  for (const [name, fn] of CASES) {
    it(`${name} stays under ${BUDGET_MS} ms`, () => {
      fn(); // warm up
      expect(timed(fn)).toBeLessThan(BUDGET_MS);
    });
  }

  it("the whole pipeline handles a 10k-char hostile message quickly", async () => {
    const start = performance.now();
    await analyzeSubmission({ text: `Please mark${" ".repeat(9_000)}x` }, { analysisModel: null, visionModel: null, analysisModelId: "none" });
    expect(performance.now() - start).toBeLessThan(500);
  });
});
