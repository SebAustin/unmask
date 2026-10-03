export interface RateLimiter {
  /** Records a hit and returns whether it is allowed, plus seconds until the window frees up. */
  check(key: string): { allowed: boolean; retryAfterSeconds: number };
}

/** In-memory sliding window. Per server instance only (documented limitation). */
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    check(key) {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((at) => t - at < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { allowed: false, retryAfterSeconds: Math.ceil((windowMs - (t - recent[0])) / 1000) };
      }
      hits.delete(key); // re-insert so eviction drops the least recently active key
      hits.set(key, [...recent, t]);
      if (hits.size > 10_000) hits.delete(hits.keys().next().value as string);
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}

export function clientKey(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
