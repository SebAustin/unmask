import { afterEach, describe, expect, it, vi } from "vitest";
import { handleAnalyze } from "./handler";
import { createRateLimiter } from "./rate-limit";

const mockEnv = { apiKey: undefined, visionModel: "m", analysisModel: "m", mock: true };
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

afterEach(() => vi.restoreAllMocks());

describe("POST /api/analyze", () => {
  it("returns a verdict envelope with a request id", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const res = await handleAnalyze(post({ text: "URGENT: buy gift cards now" }), { env: mockEnv, limiter: createRateLimiter(99, 1000) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, error: null, data: { label: "scam" } });
    expect(body.requestId).toMatch(/[0-9a-f-]{36}/);
  });

  it("rejects empty and malformed input with a friendly message", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const empty = await handleAnalyze(post({ text: "   " }), { env: mockEnv, limiter: createRateLimiter(99, 1000) });
    expect(empty.status).toBe(400);
    expect((await empty.json()).error.message).toMatch(/paste a message/i);
    const broken = await handleAnalyze(post("{nope"), { env: mockEnv, limiter: createRateLimiter(99, 1000) });
    expect(broken.status).toBe(400);
  });

  it("rejects non-JSON bodies with 415", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const res = await handleAnalyze(post(JSON.stringify({ text: "hi" }), { "content-type": "text/plain" }), {
      env: mockEnv,
      limiter: createRateLimiter(99, 1000),
    });
    expect(res.status).toBe(415);
  });

  it("rejects oversized bodies with 413", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const res = await handleAnalyze(post({ text: "a".repeat(4_500_000) }), { env: mockEnv, limiter: createRateLimiter(99, 1000) });
    expect(res.status).toBe(413);
  });

  it("rate-limits with Retry-After", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const limiter = createRateLimiter(1, 60_000);
    await handleAnalyze(post({ text: "hi" }), { env: mockEnv, limiter });
    const res = await handleAnalyze(post({ text: "hi" }), { env: mockEnv, limiter });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("returns 422 image_unreadable when the only screenshot can't be read", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const res = await handleAnalyze(post({ image: "data:image/png;base64,AAAA" }, { "x-unmask-mock": "vision-fail" }), {
      env: mockEnv,
      limiter: createRateLimiter(99, 1000),
    });
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("image_unreadable");
  });

  it("degrades instead of failing when no API key is configured", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const res = await handleAnalyze(post({ text: "hello" }), {
      env: { ...mockEnv, mock: false },
      limiter: createRateLimiter(99, 1000),
    });
    expect((await res.json()).data).toMatchObject({ degraded: true, degradedReason: "not_configured" });
  });
});

describe("readEnv", () => {
  it("refuses mock mode in production", async () => {
    const { readEnv } = await import("./env");
    expect(() => readEnv({ AI_MOCK: "1", VERCEL: "1" } as unknown as NodeJS.ProcessEnv)).toThrow(/deployment/);
    expect(readEnv({ VISION_MODEL: "  ", ANALYSIS_MODEL: "" } as unknown as NodeJS.ProcessEnv).visionModel).toBe(
      "Qwen/Qwen3-VL-30B-A3B-Instruct",
    );
    expect(readEnv({} as unknown as NodeJS.ProcessEnv)).toMatchObject({ mock: false, analysisModel: "Qwen/Qwen3-VL-30B-A3B-Instruct" });
  });
});
