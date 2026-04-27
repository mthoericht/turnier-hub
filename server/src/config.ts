import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile =
  process.env.NODE_ENV === "test" ? ".env.test" : ".env";
loadEnv({ path: path.join(here, "..", envFile) });

const isProd = process.env.NODE_ENV === "production";

/**
 * Enforces presence of an environment variable in production.
 */
function requireEnvInProduction(key: string): void
{
  if (isProd && !process.env[key]?.trim())
  {
    throw new Error(`${key} must be set in production`);
  }
}

requireEnvInProduction("JWT_SECRET");
requireEnvInProduction("INVITE_CODE");
requireEnvInProduction("CORS_ALLOWED_ORIGINS");

/**
 * Reads a positive integer from env input, falling back on invalid values.
 */
function readPositiveInt(value: string | undefined, fallback: number): number
{
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Splits comma-separated environment values into a trimmed string array.
 */
function splitCsv(value: string | undefined): string[]
{
  if (!value)
  {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Parses the Express `trust proxy` config value from env format.
 *
 * Supports booleans (`true`/`false`), hop counts (`0`, `1`, ...),
 * and string/list formats accepted by Express.
 */
function readTrustProxy(value: string | undefined): boolean | number | string | string[]
{
  if (!value)
  {
    return false;
  }

  const trimmed = value.trim();
  if (trimmed === "true")
  {
    return true;
  }
  if (trimmed === "false")
  {
    return false;
  }

  const parsed = Number(trimmed);
  if (Number.isInteger(parsed) && parsed >= 0)
  {
    return parsed;
  }

  const csv = splitCsv(trimmed);
  return csv.length > 1 ? csv : trimmed;
}

/**
 * Lightweight secret quality check by minimum trimmed length.
 */
function hasMinEntropyLikeLength(value: string, minLength: number): boolean
{
  return value.trim().length >= minLength;
}

/** JWT signing secret (required in production). */
export const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-change-me";
/** Shared invite code used during signup (required in production). */
export const INVITE_CODE = process.env.INVITE_CODE ?? "ballspiele2026";
/** HTTP port for API and static assets. */
export const PORT = readPositiveInt(process.env.PORT, 3001);
/** Rate-limit window for login/signup endpoints in milliseconds. */
export const AUTH_RATE_LIMIT_WINDOW_MS = readPositiveInt(
  process.env.AUTH_RATE_LIMIT_WINDOW_MS,
  10 * 60 * 1000
);
/** Maximum login requests per IP within the auth window. */
export const AUTH_LOGIN_MAX_REQUESTS = readPositiveInt(
  process.env.AUTH_LOGIN_MAX_REQUESTS,
  20
);
/** Maximum signup requests per IP within the auth window. */
export const AUTH_SIGNUP_MAX_REQUESTS = readPositiveInt(
  process.env.AUTH_SIGNUP_MAX_REQUESTS,
  10
);
/** Maximum auth requests per email/username within the auth window. */
export const AUTH_IDENTIFIER_MAX_REQUESTS = readPositiveInt(
  process.env.AUTH_IDENTIFIER_MAX_REQUESTS,
  10
);
/** Failed logins before progressive lockout starts. */
export const LOGIN_LOCKOUT_START_AFTER_FAILURES = readPositiveInt(
  process.env.LOGIN_LOCKOUT_START_AFTER_FAILURES,
  3
);
/** Base lockout duration in milliseconds for failed logins. */
export const LOGIN_LOCKOUT_BASE_MS = readPositiveInt(
  process.env.LOGIN_LOCKOUT_BASE_MS,
  15 * 1000
);
/** Maximum lockout duration in milliseconds for failed logins. */
export const LOGIN_LOCKOUT_MAX_MS = readPositiveInt(
  process.env.LOGIN_LOCKOUT_MAX_MS,
  15 * 60 * 1000
);
/** Explicit browser origin allowlist for CORS. */
export const CORS_ALLOWED_ORIGINS = splitCsv(
  process.env.CORS_ALLOWED_ORIGINS
);
/** Express `trust proxy` value. */
export const TRUST_PROXY = readTrustProxy(process.env.TRUST_PROXY);
/** Max JSON request body size for `express.json`. */
export const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT ?? "100kb";
/** WebSocket connect-rate limit window in milliseconds. */
export const WS_CONNECT_WINDOW_MS = readPositiveInt(
  process.env.WS_CONNECT_WINDOW_MS,
  60 * 1000
);
/** Maximum WS upgrade attempts per IP within connect window. */
export const WS_CONNECT_MAX_PER_IP = readPositiveInt(
  process.env.WS_CONNECT_MAX_PER_IP,
  30
);
/** WebSocket message-rate limit window per socket in milliseconds. */
export const WS_MESSAGE_WINDOW_MS = readPositiveInt(
  process.env.WS_MESSAGE_WINDOW_MS,
  10 * 1000
);
/** Maximum WS messages per socket within message window. */
export const WS_MESSAGE_MAX_PER_WINDOW = readPositiveInt(
  process.env.WS_MESSAGE_MAX_PER_WINDOW,
  120
);
/** Maximum active tournament subscriptions per WS client. */
export const WS_MAX_SUBSCRIPTIONS_PER_CLIENT = readPositiveInt(
  process.env.WS_MAX_SUBSCRIPTIONS_PER_CLIENT,
  50
);
/** Maximum websocket message payload in bytes. */
export const WS_MAX_PAYLOAD_BYTES = readPositiveInt(
  process.env.WS_MAX_PAYLOAD_BYTES,
  16_384
);
/** Security telemetry window for HTTP status spike detection. */
export const SECURITY_HTTP_STATUS_WINDOW_MS = readPositiveInt(
  process.env.SECURITY_HTTP_STATUS_WINDOW_MS,
  60 * 1000
);
/** HTTP status spike threshold within telemetry window. */
export const SECURITY_HTTP_STATUS_THRESHOLD = readPositiveInt(
  process.env.SECURITY_HTTP_STATUS_THRESHOLD,
  50
);
/** Security telemetry window for websocket connection spikes. */
export const SECURITY_WS_CONNECTIONS_WINDOW_MS = readPositiveInt(
  process.env.SECURITY_WS_CONNECTIONS_WINDOW_MS,
  60 * 1000
);
/** Websocket connection spike threshold within telemetry window. */
export const SECURITY_WS_CONNECTIONS_THRESHOLD = readPositiveInt(
  process.env.SECURITY_WS_CONNECTIONS_THRESHOLD,
  100
);

/** Default school name auto-created for new accounts. */
const defaultSchoolName = process.env.DEFAULT_SCHOOL_NAME?.trim();
/** Resolved default school name used at startup. */
export const DEFAULT_SCHOOL_NAME = defaultSchoolName?.length ? defaultSchoolName : "defaultSchool";

if (isProd)
{
  if (!hasMinEntropyLikeLength(JWT_SECRET, 32))
  {
    throw new Error("JWT_SECRET must be at least 32 characters in production");
  }
  if (!hasMinEntropyLikeLength(INVITE_CODE, 12))
  {
    throw new Error("INVITE_CODE should be at least 12 characters in production");
  }
  if (CORS_ALLOWED_ORIGINS.length === 0 || CORS_ALLOWED_ORIGINS.includes("*"))
  {
    throw new Error("CORS_ALLOWED_ORIGINS must be a non-wildcard allowlist in production");
  }
  if (process.env.TRUST_PROXY === undefined)
  {
    throw new Error("TRUST_PROXY must be explicitly set in production");
  }
}
