import {
  EVENT_BUS,
  EVENT_BUS_POLL_MS,
  LOCKOUT_STORE,
  LOGIN_LOCKOUT_TABLE,
  RATE_LIMIT_STORE,
  RATE_LIMIT_TABLE,
  REALTIME_EVENTS_TABLE,
} from "../config.js";
import { setRateLimitStore } from "../middleware/authRateLimit.js";
import { DynamoEventBus } from "../realtime/dynamoEventBus.js";
import type { RealtimeEventBus } from "../realtime/eventBus.js";
import { MemoryEventBus } from "../realtime/eventBus.js";
import { setLockoutStore } from "../routes/auth.js";
import { DynamoLockoutStore } from "../state/dynamoLockoutStore.js";
import { DynamoRateLimitStore } from "../state/dynamoRateLimitStore.js";

function resolveRateLimitStore(): void
{
  if (RATE_LIMIT_STORE === "dynamo")
  {
    setRateLimitStore(new DynamoRateLimitStore({
      tableName: RATE_LIMIT_TABLE,
    }));
    return;
  }

  setRateLimitStore(null);
}

function resolveLockoutStore(): void
{
  if (LOCKOUT_STORE === "dynamo")
  {
    setLockoutStore(new DynamoLockoutStore({
      tableName: LOGIN_LOCKOUT_TABLE,
    }));
    return;
  }

  setLockoutStore(null);
}

export function resolveRealtimeBus(): RealtimeEventBus
{
  if (EVENT_BUS === "dynamo")
  {
    return new DynamoEventBus({
      tableName: REALTIME_EVENTS_TABLE,
      pollMs: EVENT_BUS_POLL_MS,
    });
  }

  return new MemoryEventBus();
}

/**
 * Applies runtime-configured auth and lockout store adapters.
 *
 * Local dev defaults to memory stores; Lambda uses the Dynamo stores when
 * `RATE_LIMIT_STORE`/`LOCKOUT_STORE` are set to `dynamo`.
 */
export function applyRuntimeAuthAdapters(): void
{
  resolveRateLimitStore();
  resolveLockoutStore();
}
