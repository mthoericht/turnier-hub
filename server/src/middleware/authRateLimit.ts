import type { Request, RequestHandler, Response } from "express";
import {
  MemoryRateLimitStore,
  type RateLimitStore,
} from "../state/rateLimitStore.js";

type AuthRateLimitOptions = {
  windowMs: number;
  maxPerIp: number;
  maxPerIdentifier: number;
};

let store: RateLimitStore = new MemoryRateLimitStore();

/**
 * Replaces the active rate-limit store. Used by tests to inject a clean store
 * and (in Phase 5) by Lambda bootstrap to inject `DynamoRateLimitStore`.
 *
 * Pass `null` to revert to a fresh in-memory store.
 */
export function setRateLimitStore(instance: RateLimitStore | null): void
{
  store = instance ?? new MemoryRateLimitStore();
}

/**
 * Test-only convenience helper that resets the active store. Equivalent to
 * `setRateLimitStore(null)` but keeps the existing call sites in tests.
 */
export function resetAuthRateLimitForTests(): void
{
  if (store instanceof MemoryRateLimitStore)
  {
    store.clearForTests();
    return;
  }
  store = new MemoryRateLimitStore();
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

function reject(res: Response, retryAfterSec: number): void
{
  res.setHeader("Retry-After", String(retryAfterSec));
  res.status(429).json({
    error: "Zu viele Anfragen. Bitte kurz warten und erneut versuchen.",
  });
}

/**
 * Builds an Express middleware that enforces per-IP and per-identifier auth
 * rate limits via the active `RateLimitStore`.
 */
export function createAuthRateLimiter(options: AuthRateLimitOptions): RequestHandler
{
  const { windowMs, maxPerIp, maxPerIdentifier } = options;

  return async (req, res, next) =>
  {
    try
    {
      const ipKey = `${req.path}|ip:${req.ip}`;
      const ipCounter = await store.consume(ipKey, windowMs);
      if (ipCounter.count > maxPerIp)
      {
        reject(res, getRemainingSeconds(ipCounter.resetAtMs));
        return;
      }

      const identifier = getIdentifier(req);
      if (identifier)
      {
        const identifierKey = `${req.path}|id:${identifier}`;
        const identifierCounter = await store.consume(identifierKey, windowMs);
        if (identifierCounter.count > maxPerIdentifier)
        {
          reject(res, getRemainingSeconds(identifierCounter.resetAtMs));
          return;
        }
      }

      next();
    }
    catch (err)
    {
      next(err);
    }
  };
}
