import "server-only";
import { MockLanguageModelV4 } from "ai/test";

/**
 * Deterministic stand-in for Featherless used by E2E tests and offline demos (AI_MOCK=1).
 * Behaviour can be forced per request with sentinel tokens in the message, e.g. [[mock:fail]],
 * or with the x-unmask-mock header (only honoured while AI_MOCK=1).
 */
const SCAM_WORDS = [
  "gift card", "urgent", "suspended", "verify", "bitcoin", "wire", "password", "code", "prize",
  "fee", "locked", "arrest", "anydesk", "guaranteed", "new number", "click",
];

type Role = "analysis" | "vision";
type Generate = NonNullable<ConstructorParameters<typeof MockLanguageModelV4>[0]>["doGenerate"];

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 10, text: 10, reasoning: undefined },
};

export function createMockModel(role: Role, headerMode?: string): MockLanguageModelV4 {
  let calls = 0;
  const doGenerate = (async (options: { prompt: unknown; abortSignal?: AbortSignal }) => {
    calls += 1;
    const promptText = JSON.stringify(options.prompt);
    const mode = promptText.match(/\[\[mock:([a-z-]+)\]\]/)?.[1] ?? headerMode;

    if (mode === "fail" || (role === "vision" && mode === "vision-fail")) {
      throw Object.assign(new Error("Mock provider failure"), { statusCode: 503 });
    }
    if (mode === "timeout") {
      await new Promise((_, reject) =>
        options.abortSignal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))),
      );
    }
    const text = role === "vision" ? visionReply() : mode === "malformed" && calls === 1 ? "Sorry, I can't format that." : analysisReply(promptText);
    return {
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    };
  }) as unknown as Generate;
  return new MockLanguageModelV4({ doGenerate });
}

function visionReply(): string {
  return JSON.stringify({
    text: "USPS: Your package could not be delivered due to an unpaid $1.99 fee. Pay within 24 hours at usps-redelivery.top/pay or it will be returned.",
    visualCues: ["USPS eagle logo", "SMS from an unknown international number"],
  });
}

function analysisReply(promptText: string): string {
  const message = (promptText.match(/<untrusted_message[^>]*>([\s\S]*?)<\/untrusted_message/)?.[1] ?? promptText).replace(/\\n/g, "\n");
  const lower = message.toLowerCase();
  const hits = SCAM_WORDS.filter((w) => lower.includes(w));
  const riskScore = Math.min(95, hits.length * 22);
  const redFlags = hits.slice(0, 3).map((word) => {
    const index = lower.indexOf(word);
    return { quote: message.slice(index, index + word.length), explanation: `"${word}" is a common pressure or payment tactic.` };
  });
  return JSON.stringify({
    riskScore,
    scamType: hits.length === 0 ? "none" : "other",
    claimedIdentity: null,
    requestedAction: hits.length ? "Act quickly on the request in the message" : null,
    summary: hits.length
      ? "This message uses several tactics common in scams (mock analysis)."
      : "Nothing in this message looks like a known scam pattern (mock analysis).",
    unverifiable: hits.length ? ["Who actually sent the message"] : [],
    redFlags,
  });
}
