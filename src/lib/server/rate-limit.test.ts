import { describe, expect, it } from "vitest";
import { clientKey, createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit per window, then blocks with a retry hint", () => {
    let t = 0;
    const limiter = createRateLimiter(2, 60_000, () => t);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a")).toEqual({ allowed: false, retryAfterSeconds: 60 });
    expect(limiter.check("b").allowed).toBe(true);
    t = 60_001;
    expect(limiter.check("a").allowed).toBe(true);
  });
});

describe("clientKey", () => {
  it("uses the first forwarded hop, else a shared bucket", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientKey(new Headers())).toBe("unknown");
  });
});
