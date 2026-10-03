import { writeFileSync } from "node:fs";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { analyzeSubmission, type AnalyzeResult } from "@/lib/analyze/analyze";
import { readEnv } from "@/lib/server/env";
import { buildModels } from "@/lib/server/models";
import { FIXTURES, type EvalFixture } from "./fixtures";

/**
 * `pnpm eval`            → rules-only baseline (no model), writes evals/RESULTS-offline.md
 * `EVAL_LIVE=1 pnpm eval` → real Featherless models, writes evals/RESULTS.md
 */
const LIVE = process.env.EVAL_LIVE === "1";
const PAUSE_MS = LIVE ? 400 : 0;

type Generate = NonNullable<ConstructorParameters<typeof MockLanguageModelV4>[0]>["doGenerate"];

function visionStub(text: string) {
  return new MockLanguageModelV4({
    doGenerate: (async () => ({
      content: [{ type: "text", text: JSON.stringify({ text, visualCues: [] }) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    })) as unknown as Generate,
  });
}

interface Row {
  readonly fixture: EvalFixture;
  readonly result: AnalyzeResult;
  readonly ms: number;
}

function summarize(rows: readonly Row[]) {
  const scams = rows.filter((r) => r.fixture.expected === "scam");
  const legit = rows.filter((r) => r.fixture.expected === "legit");
  const label = (r: Row) => (r.result.ok ? r.result.verdict.label : "error");
  const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(1)}%`);
  return {
    n: rows.length,
    recall: pct(scams.filter((r) => label(r) !== "likely_safe" && label(r) !== "error").length, scams.length),
    scamAsScam: pct(scams.filter((r) => label(r) === "scam").length, scams.length),
    falsePositive: pct(legit.filter((r) => label(r) === "scam").length, legit.length),
    suspiciousOnLegit: pct(legit.filter((r) => label(r) === "suspicious").length, legit.length),
    degraded: rows.filter((r) => r.result.ok && r.result.verdict.degraded).length,
    p50: [...rows.map((r) => r.ms)].sort((a, b) => a - b)[Math.floor(rows.length / 2)] ?? 0,
  };
}

describe(`eval (${LIVE ? "live model" : "rules only"})`, () => {
  it("meets the quality bar", { timeout: 30 * 60_000 }, async () => {
    const env = LIVE ? readEnv() : null;
    const models = env ? buildModels(env) : null;
    if (LIVE && !models?.analysis) throw new Error("EVAL_LIVE=1 needs FEATHERLESS_API_KEY in the environment.");

    const rows: Row[] = [];
    for (const fixture of FIXTURES) {
      const started = Date.now();
      const result = await analyzeSubmission(fixture.input, {
        analysisModel: models?.analysis ?? null,
        visionModel: fixture.visionText ? visionStub(fixture.visionText) : (models?.vision ?? null),
        analysisModelId: models?.analysisModelId ?? "rules-only",
      });
      rows.push({ fixture, result, ms: Date.now() - started });
      if (PAUSE_MS) await new Promise((r) => setTimeout(r, PAUSE_MS));
    }

    // SC-5: every highlighted span is verbatim in the exhibit.
    for (const { result } of rows) {
      if (!result.ok) continue;
      for (const flag of result.verdict.redFlags) expect(result.verdict.exhibit.slice(flag.start, flag.end)).toBe(flag.quote);
    }

    const all = summarize(rows);
    const holdout = summarize(rows.filter((r) => r.fixture.split === "holdout"));
    const injections = rows.filter((r) => r.fixture.tags?.includes("injection"));
    const misses = rows.filter((r) => {
      const label = r.result.ok ? r.result.verdict.label : "error";
      return r.fixture.expected === "scam" ? label === "likely_safe" || label === "error" : label !== "likely_safe";
    });

    const table = rows
      .map(({ fixture, result, ms }) => {
        const v = result.ok ? result.verdict : null;
        return `| ${fixture.id} | ${fixture.split} | ${fixture.expected} | ${v?.label ?? result.ok} | ${v?.riskScore ?? "-"} | ${v?.scamType ?? "-"} | ${v?.degraded ? v.degradedReason : ""} | ${ms} |`;
      })
      .join("\n");

    const report = `# Eval results — ${LIVE ? `live (${models?.analysisModelId})` : "rules only (no model)"}

Generated ${new Date().toISOString()} by \`${LIVE ? "EVAL_LIVE=1 " : ""}pnpm eval\` over ${FIXTURES.length} hand-written fixtures (${FIXTURES.filter((f) => f.expected === "scam").length} scam, ${FIXTURES.filter((f) => f.expected === "legit").length} legit). SC-2/3 are scored on the full set; the holdout split was not used for tuning.

| Metric | Target | Full set | Holdout |
|---|---|---|---|
| Scam recall (Scam or Suspicious) | ≥ 85% | ${all.recall} | ${holdout.recall} |
| Scams labelled "Scam" | — | ${all.scamAsScam} | ${holdout.scamAsScam} |
| False positives (legit → Scam) | ≤ 10% | ${all.falsePositive} | ${holdout.falsePositive} |
| Legit → Suspicious | ≤ 20% | ${all.suspiciousOnLegit} | ${holdout.suspiciousOnLegit} |
| Injection fixtures never "Likely safe" | 5/5 | ${injections.filter((r) => r.result.ok && r.result.verdict.label !== "likely_safe").length}/${injections.length} | |
| Degraded verdicts | 0 (live) | ${all.degraded} | ${holdout.degraded} |
| p50 latency (ms) | < 8000 (live) | ${all.p50} | ${holdout.p50} |

Misses: ${misses.length ? misses.map((m) => `\`${m.fixture.id}\``).join(", ") : "none"}

| Fixture | Split | Expected | Verdict | Risk | Type | Degraded | ms |
|---|---|---|---|---|---|---|---|
${table}
`;
    writeFileSync(new URL(LIVE ? "./RESULTS.md" : "./RESULTS-offline.md", import.meta.url), report);
    console.info(report.split("\n").slice(0, 16).join("\n"));

    expect(injections.every((r) => r.result.ok && r.result.verdict.label !== "likely_safe")).toBe(true);
  });
});
