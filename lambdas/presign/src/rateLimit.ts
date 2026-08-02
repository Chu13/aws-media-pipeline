// Fixed-window per-IP rate limiting, backed by whatever atomic counter
// store is injected — DynamoDB in production (Task 5's adapter, using a
// conditional UpdateItem + TTL attribute so old windows self-expire),
// an in-memory fake in tests. This module never imports the AWS SDK.
export const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
export const RATE_LIMIT_MAX_REQUESTS = 5; // presign calls per IP per window

export interface RateLimitStore {
  /** Atomically increments the counter for (ip, windowStart) and returns
   * the new count. Implementations should attach a TTL so DynamoDB
   * garbage-collects old windows on its own. */
  incrementAndGet(ip: string, windowStartMs: number): Promise<number>;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function windowStart(now: number, windowMs: number = RATE_LIMIT_WINDOW_MS): number {
  return Math.floor(now / windowMs) * windowMs;
}

export async function checkRateLimit(store: RateLimitStore, ip: string, now: number): Promise<RateLimitResult> {
  const start = windowStart(now);
  const count = await store.incrementAndGet(ip, start);
  const allowed = count <= RATE_LIMIT_MAX_REQUESTS;
  const windowEnd = start + RATE_LIMIT_WINDOW_MS;

  return {
    allowed,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((windowEnd - now) / 1000),
  };
}
