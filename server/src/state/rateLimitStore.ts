/**
 * Result of a single counter consumption.
 *
 * `count` is the new value after the increment; `resetAtMs` is the wall-clock
 * timestamp at which the current window will roll over and the counter starts
 * fresh.
 */
export type RateLimitCounter = {
  count: number;
  resetAtMs: number;
};

/**
 * Transport-agnostic counter storage backing rate-limit middleware.
 *
 * Implementations:
 *  - `MemoryRateLimitStore` — process-local; used in dev, tests, and the
 *    legacy single-VM deployment.
 *  - `DynamoRateLimitStore` (Phase 5) — atomic `UpdateItem ADD` against a
 *    DynamoDB table with TTL for automatic cleanup.
 */
export interface RateLimitStore
{
  /**
   * Atomically increments the counter for `key` within a sliding window of
   * `windowMs` milliseconds. Returns the post-increment count and the time
   * at which the current window expires.
   */
  consume(key: string, windowMs: number): Promise<RateLimitCounter>;
  /**
   * Resets the counter for `key`, e.g. when a tracked action succeeds.
   */
  reset(key: string): Promise<void>;
}

/**
 * In-memory `RateLimitStore` implementation.
 *
 * Suitable for dev, tests, and any deployment running a single Node.js
 * process. In multi-instance deployments use a shared store
 * (`DynamoRateLimitStore`).
 */
export class MemoryRateLimitStore implements RateLimitStore
{
  private readonly counters = new Map<string, RateLimitCounter>();

  async consume(key: string, windowMs: number): Promise<RateLimitCounter>
  {
    this.cleanupExpired();
    const now = Date.now();
    const existing = this.counters.get(key);
    if (!existing || existing.resetAtMs <= now)
    {
      const fresh: RateLimitCounter = { count: 1, resetAtMs: now + windowMs };
      this.counters.set(key, fresh);
      return fresh;
    }
    existing.count += 1;
    return existing;
  }

  async reset(key: string): Promise<void>
  {
    this.counters.delete(key);
  }

  /**
   * Test helper: drops every counter regardless of state.
   */
  clearForTests(): void
  {
    this.counters.clear();
  }

  /**
   * Removes expired counters to keep the in-memory map bounded.
   */
  private cleanupExpired(): void
  {
    const now = Date.now();
    for (const [key, counter] of this.counters.entries())
    {
      if (counter.resetAtMs <= now)
      {
        this.counters.delete(key);
      }
    }
  }
}
