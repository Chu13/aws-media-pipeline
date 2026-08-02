import { describe, expect, it } from "vitest";
import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS, checkRateLimit, windowStart } from "./rateLimit";
import type { RateLimitStore } from "./rateLimit";

/** In-memory stand-in for the real DynamoDB-backed store (built in Task 5),
 * so this logic is fully testable without touching AWS. */
class FakeStore implements RateLimitStore {
  private counts = new Map<string, number>();

  async incrementAndGet(ip: string, windowStartMs: number): Promise<number> {
    const key = `${ip}:${windowStartMs}`;
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  }
}

describe("windowStart", () => {
  it("floors a timestamp down to the start of its fixed window", () => {
    expect(windowStart(65_000, 60_000)).toBe(60_000);
    expect(windowStart(119_999, 60_000)).toBe(60_000);
    expect(windowStart(120_000, 60_000)).toBe(120_000);
  });
});

describe("checkRateLimit", () => {
  it("allows requests up to the configured limit", async () => {
    const store = new FakeStore();
    const now = 1_000_000;

    for (let i = 1; i <= RATE_LIMIT_MAX_REQUESTS; i++) {
      const result = await checkRateLimit(store, "1.2.3.4", now);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - i);
    }
  });

  it("blocks the request once the limit is exceeded, with a retry-after", async () => {
    const store = new FakeStore();
    const now = windowStart(1_000_000) + 1; // 1ms into a window

    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      await checkRateLimit(store, "1.2.3.4", now);
    }

    const blocked = await checkRateLimit(store, "1.2.3.4", now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(RATE_LIMIT_WINDOW_MS / 1000);
  });

  it("tracks separate IPs independently", async () => {
    const store = new FakeStore();
    const now = 1_000_000;

    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      await checkRateLimit(store, "1.1.1.1", now);
    }
    const otherIp = await checkRateLimit(store, "2.2.2.2", now);

    expect(otherIp.allowed).toBe(true);
    expect(otherIp.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 1);
  });

  it("resets once the fixed window rolls over", async () => {
    const store = new FakeStore();
    const firstWindow = windowStart(1_000_000);

    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      await checkRateLimit(store, "1.2.3.4", firstWindow);
    }
    expect((await checkRateLimit(store, "1.2.3.4", firstWindow)).allowed).toBe(false);

    const nextWindow = firstWindow + RATE_LIMIT_WINDOW_MS;
    const result = await checkRateLimit(store, "1.2.3.4", nextWindow);
    expect(result.allowed).toBe(true);
  });
});
