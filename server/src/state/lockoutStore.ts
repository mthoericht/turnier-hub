/**
 * Lockout state for one identifier (e.g. login email).
 *
 * `failures` is the cumulative count of consecutive failed attempts since the
 * last successful action or reset. `lockedUntilMs` is `0` when the identifier
 * is currently free to attempt again, otherwise a wall-clock timestamp.
 */
export type LockoutEntry = {
  failures: number;
  lockedUntilMs: number;
};

/**
 * Transport-agnostic store for progressive login-lockout state.
 *
 * Implementations:
 *  - `MemoryLockoutStore` — process-local; used in dev, tests, and the legacy
 *    single-VM deployment.
 *  - `DynamoLockoutStore` (Phase 5) — atomic counter increments + TTL.
 */
export interface LockoutStore
{
  /**
   * Returns the current lockout entry for `key` if (and only if) the
   * identifier is still locked. Expired locks are treated as `null`.
   */
  getActive(key: string): Promise<LockoutEntry | null>;
  /**
   * Atomically records one additional failure and applies `computeLockoutMs`
   * to the new failure count. Returns the resulting entry.
   */
  registerFailure(
    key: string,
    computeLockoutMs: (failures: number) => number,
  ): Promise<LockoutEntry>;
  /**
   * Clears all failure/lockout state for `key` (e.g. on successful login).
   */
  reset(key: string): Promise<void>;
}

/**
 * In-memory `LockoutStore` implementation.
 *
 * Suitable for dev, tests, and any deployment running a single Node.js
 * process. In multi-instance deployments use a shared store
 * (`DynamoLockoutStore`).
 */
export class MemoryLockoutStore implements LockoutStore
{
  private readonly entries = new Map<string, LockoutEntry>();

  async getActive(key: string): Promise<LockoutEntry | null>
  {
    const current = this.entries.get(key);
    if (!current)
    {
      return null;
    }
    if (current.lockedUntilMs <= Date.now())
    {
      return null;
    }
    return current;
  }

  async registerFailure(
    key: string,
    computeLockoutMs: (failures: number) => number,
  ): Promise<LockoutEntry>
  {
    const previous = this.entries.get(key);
    const failures = (previous?.failures ?? 0) + 1;
    const lockoutMs = computeLockoutMs(failures);
    const next: LockoutEntry = {
      failures,
      lockedUntilMs: lockoutMs > 0 ? Date.now() + lockoutMs : 0,
    };
    this.entries.set(key, next);
    return next;
  }

  async reset(key: string): Promise<void>
  {
    this.entries.delete(key);
  }

  /**
   * Test helper: drops every lockout entry regardless of state.
   */
  clearForTests(): void
  {
    this.entries.clear();
  }
}
