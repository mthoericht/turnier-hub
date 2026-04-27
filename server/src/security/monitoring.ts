type SecurityEventType =
  | "http_auth_status_spike"
  | "ws_connections_spike"
  | "ws_rate_limit_triggered";

type SecurityEventPayload = {
  type: SecurityEventType;
  details: Record<string, unknown>;
};

type SlidingWindowCounter = {
  count: number;
  windowStartedAtMs: number;
};

type HttpSecurityStatus = 401 | 403 | 429;

const trackedStatuses: HttpSecurityStatus[] = [401, 403, 429];
const statusCounters = new Map<HttpSecurityStatus, SlidingWindowCounter>();
let wsConnectionsCurrent = 0;
let wsConnectionsPeakInWindow = 0;
let wsWindowStartedAtMs = Date.now();

/**
 * Returns a standardized ISO timestamp string for security log events.
 */
function nowIso(): string
{
  return new Date().toISOString();
}

function getWindowCounter(
  map: Map<HttpSecurityStatus, SlidingWindowCounter>,
  key: HttpSecurityStatus,
  windowMs: number
): SlidingWindowCounter
{
  const now = Date.now();
  const existing = map.get(key);
  if (!existing || now - existing.windowStartedAtMs >= windowMs)
  {
    const fresh = { count: 0, windowStartedAtMs: now };
    map.set(key, fresh);
    return fresh;
  }
  return existing;
}

/**
 * Emits one structured security event as JSON warning log.
 *
 * The log format is intentionally machine-friendly for log shipping,
 * dashboards, and alerting rules in external monitoring systems.
 */
function emitSecurityEvent(payload: SecurityEventPayload): void
{
  // JSON log shape for easy ingestion by log-based monitoring.
  console.warn(JSON.stringify({
    at: nowIso(),
    level: "warn",
    category: "security",
    ...payload,
  }));
}

/**
 * Tracks HTTP auth/security status codes and emits spike events at threshold.
 *
 * Only `401`, `403`, and `429` are considered. The event is emitted once when
 * the counter reaches `thresholdPerWindow` within the active `windowMs`.
 */
export function recordHttpSecurityStatus(
  statusCode: number,
  options: {
    windowMs: number;
    thresholdPerWindow: number;
  }
): void
{
  if (!trackedStatuses.includes(statusCode as HttpSecurityStatus))
  {
    return;
  }

  const status = statusCode as HttpSecurityStatus;
  const counter = getWindowCounter(statusCounters, status, options.windowMs);
  counter.count += 1;
  if (counter.count === options.thresholdPerWindow)
  {
    emitSecurityEvent({
      type: "http_auth_status_spike",
      details: {
        status,
        count: counter.count,
        windowMs: options.windowMs,
      },
    });
  }
}

/**
 * Registers a websocket connection open event and emits peak-connection spikes.
 *
 * The peak is tracked within a rolling window and compared against the provided
 * `thresholdPeakConnections`.
 */
export function onWsConnectionOpened(
  options: {
    windowMs: number;
    thresholdPeakConnections: number;
  }
): void
{
  const now = Date.now();
  if (now - wsWindowStartedAtMs >= options.windowMs)
  {
    wsWindowStartedAtMs = now;
    wsConnectionsPeakInWindow = 0;
  }

  wsConnectionsCurrent += 1;
  wsConnectionsPeakInWindow = Math.max(wsConnectionsPeakInWindow, wsConnectionsCurrent);
  if (wsConnectionsPeakInWindow === options.thresholdPeakConnections)
  {
    emitSecurityEvent({
      type: "ws_connections_spike",
      details: {
        currentConnections: wsConnectionsCurrent,
        peakConnectionsInWindow: wsConnectionsPeakInWindow,
        windowMs: options.windowMs,
      },
    });
  }
}

/**
 * Registers a websocket connection close event.
 */
export function onWsConnectionClosed(): void
{
  wsConnectionsCurrent = Math.max(0, wsConnectionsCurrent - 1);
}

/**
 * Emits a websocket rate-limit trigger event for observability/alerting.
 */
export function onWsRateLimitTriggered(reason: "connect" | "message" | "subscription"): void
{
  emitSecurityEvent({
    type: "ws_rate_limit_triggered",
    details: { reason },
  });
}

/**
 * Test-only helper to reset in-memory monitoring state between unit tests.
 */
export function resetSecurityMonitoringForTests(): void
{
  statusCounters.clear();
  wsConnectionsCurrent = 0;
  wsConnectionsPeakInWindow = 0;
  wsWindowStartedAtMs = Date.now();
}
