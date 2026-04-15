import type { Request, RequestHandler, Response } from "express";

type Counter = {
  count: number;
  resetAtMs: number;
};

type CounterStore = Map<string, Counter>;

type AuthRateLimitOptions = {
  windowMs: number;
  maxPerIp: number;
  maxPerIdentifier: number;
};

const ipCounters: CounterStore = new Map();
const identifierCounters: CounterStore = new Map();

export function resetAuthRateLimitForTests(): void
{
  ipCounters.clear();
  identifierCounters.clear();
}

function trimAndLower(value: unknown): string
{
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getIdentifier(req: Request): string | null
{
  const email = trimAndLower(req.body?.email);
  if (email)
  {
    return email;
  }

  const username = trimAndLower(req.body?.username);
  return username || null;
}

function getRemainingSeconds(resetAtMs: number): number
{
  return Math.max(1, Math.ceil((resetAtMs - Date.now()) / 1000));
}

function consumeCounter(
  key: string,
  store: CounterStore,
  windowMs: number
): Counter
{
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAtMs <= now)
  {
    const fresh = { count: 1, resetAtMs: now + windowMs };
    store.set(key, fresh);
    return fresh;
  }

  existing.count += 1;
  return existing;
}

function cleanupExpired(store: CounterStore): void
{
  const now = Date.now();
  for (const [key, counter] of store.entries())
  {
    if (counter.resetAtMs <= now)
    {
      store.delete(key);
    }
  }
}

function reject(res: Response, retryAfterSec: number): void
{
  res.setHeader("Retry-After", String(retryAfterSec));
  res.status(429).json({
    error: "Zu viele Anfragen. Bitte kurz warten und erneut versuchen.",
  });
}

export function createAuthRateLimiter(options: AuthRateLimitOptions): RequestHandler
{
  const { windowMs, maxPerIp, maxPerIdentifier } = options;

  return (req, res, next) =>
  {
    // Keep in-memory stores bounded over time.
    cleanupExpired(ipCounters);
    cleanupExpired(identifierCounters);

    const ipKey = `${req.path}|ip:${req.ip}`;
    const ipCounter = consumeCounter(ipKey, ipCounters, windowMs);
    if (ipCounter.count > maxPerIp)
    {
      reject(res, getRemainingSeconds(ipCounter.resetAtMs));
      return;
    }

    const identifier = getIdentifier(req);
    if (identifier)
    {
      const identifierKey = `${req.path}|id:${identifier}`;
      const identifierCounter = consumeCounter(
        identifierKey,
        identifierCounters,
        windowMs
      );
      if (identifierCounter.count > maxPerIdentifier)
      {
        reject(res, getRemainingSeconds(identifierCounter.resetAtMs));
        return;
      }
    }

    next();
  };
}
