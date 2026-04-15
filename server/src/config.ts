import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile =
  process.env.NODE_ENV === "test" ? ".env.test" : ".env";
loadEnv({ path: path.join(here, "..", envFile) });

const isProd = process.env.NODE_ENV === "production";
if (isProd && !process.env.JWT_SECRET)
{
  throw new Error("JWT_SECRET must be set in production");
}
if (isProd && !process.env.INVITE_CODE)
{
  throw new Error("INVITE_CODE must be set in production");
}
if (isProd && !process.env.CORS_ALLOWED_ORIGINS?.trim())
{
  throw new Error("CORS_ALLOWED_ORIGINS must be set in production");
}

function readPositiveInt(value: string | undefined, fallback: number): number
{
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

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

export const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-change-me";
export const INVITE_CODE = process.env.INVITE_CODE ?? "ballspiele2026";
export const PORT = readPositiveInt(process.env.PORT, 3001);
export const AUTH_RATE_LIMIT_WINDOW_MS = readPositiveInt(
  process.env.AUTH_RATE_LIMIT_WINDOW_MS,
  10 * 60 * 1000
);
export const AUTH_LOGIN_MAX_REQUESTS = readPositiveInt(
  process.env.AUTH_LOGIN_MAX_REQUESTS,
  20
);
export const AUTH_SIGNUP_MAX_REQUESTS = readPositiveInt(
  process.env.AUTH_SIGNUP_MAX_REQUESTS,
  10
);
export const AUTH_IDENTIFIER_MAX_REQUESTS = readPositiveInt(
  process.env.AUTH_IDENTIFIER_MAX_REQUESTS,
  10
);
export const CORS_ALLOWED_ORIGINS = splitCsv(
  process.env.CORS_ALLOWED_ORIGINS
);
export const TRUST_PROXY = readTrustProxy(process.env.TRUST_PROXY);
export const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT ?? "100kb";

/** Default school name for new users. */
const defaultSchoolName = process.env.DEFAULT_SCHOOL_NAME?.trim();
export const DEFAULT_SCHOOL_NAME = defaultSchoolName?.length ? defaultSchoolName : "defaultSchool";
