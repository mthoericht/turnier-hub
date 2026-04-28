/**
 * Structured security event types emitted on stdout for log-shipping pipelines
 * (CloudWatch Metric Filters in production aggregate these into alarms).
 */
type SecurityEventType = "http_auth_status";

type SecurityEventPayload = {
  type: SecurityEventType;
  details: Record<string, unknown>;
};

type HttpSecurityStatus = 401 | 403 | 429;

const trackedStatuses: HttpSecurityStatus[] = [401, 403, 429];

/**
 * Returns a standardised ISO timestamp string for security log events.
 */
function nowIso(): string
{
  return new Date().toISOString();
}

/**
 * Emits one structured security event as a JSON warning log.
 *
 * The log format is intentionally machine-friendly for log shipping,
 * dashboards, and alerting rules in external monitoring systems.
 */
function emitSecurityEvent(payload: SecurityEventPayload): void
{
  console.warn(JSON.stringify({
    at: nowIso(),
    level: "warn",
    category: "security",
    ...payload,
  }));
}

/**
 * Records an authentication-relevant HTTP response status as a structured
 * warn log. Only `401`, `403`, and `429` are emitted; CloudWatch Metric
 * Filters compute spike rates from the resulting log stream.
 */
export function recordHttpSecurityStatus(statusCode: number): void
{
  if (!trackedStatuses.includes(statusCode as HttpSecurityStatus))
  {
    return;
  }
  emitSecurityEvent({
    type: "http_auth_status",
    details: { status: statusCode },
  });
}
