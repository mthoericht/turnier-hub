import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, "..");
const envFile =
  process.env.NODE_ENV === "test" ? ".env.test" : ".env";
loadEnv({ path: path.join(serverRoot, envFile) });

const isProd = process.env.NODE_ENV === "production";

/**
 * Builds the Prisma MySQL connection string from split DB_* env settings.
 */
function buildDatabaseUrlFromParts(): string | undefined
{
  const host = process.env.DB_HOST?.trim();
  const port = process.env.DB_PORT?.trim();
  const username = process.env.DB_USERNAME?.trim();
  const password = process.env.DB_PASSWORD?.trim();
  const database = process.env.DB_NAME?.trim();

  if (!host || !port || !username || !password || !database)
  {
    return undefined;
  }

  return `mysql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

process.env.DATABASE_URL = process.env.DATABASE_URL?.trim() || buildDatabaseUrlFromParts();

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

requireEnvInProduction("CORS_ALLOWED_ORIGINS");
requireEnvInProduction("DEFAULT_SCHOOL_ID");
requireEnvInProduction("DATABASE_URL");

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

/** HTTP port for API and static assets. */
export const PORT = readPositiveInt(process.env.PORT, 3000);
/** Directory containing the built SPA files served by Express. */
export const STATIC_DIR = path.resolve(
  serverRoot,
  process.env.STATIC_DIR?.trim() || "../client/dist"
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

/** Default school name used by the seed when resolving schools by name. */
const defaultSchoolName = process.env.DEFAULT_SCHOOL_NAME?.trim();
/** Resolved default school name used with the seed / dev fallback. */
export const DEFAULT_SCHOOL_NAME = defaultSchoolName?.length ? defaultSchoolName : "defaultSchool";

/**
 * Optional full URL for Authelia (or proxy) logout; exposed on `GET /api/session`
 * so the SPA can navigate the browser there ("Abmelden").
 */
export const AUTHELIA_LOGOUT_URL = process.env.AUTHELIA_LOGOUT_URL?.trim() || "";

if (isProd)
{
  if (CORS_ALLOWED_ORIGINS.length === 0 || CORS_ALLOWED_ORIGINS.includes("*"))
  {
    throw new Error("CORS_ALLOWED_ORIGINS must be a non-wildcard allowlist in production");
  }
  if (process.env.TRUST_PROXY === undefined)
  {
    throw new Error("TRUST_PROXY must be explicitly set in production");
  }
}
