/**
 * When no reverse proxy sets `Remote-User`, local dev/test can use `DEV_REMOTE_USER`.
 * Never honored in production (must use real proxy identity).
 */
export function devRemoteUserFallback(): string
{
  if (process.env.NODE_ENV === "production")
  {
    return "";
  }
  return (process.env.DEV_REMOTE_USER ?? "").trim();
}

/**
 * When no reverse proxy sets `Remote-Groups`, local dev/test can use `DEV_REMOTE_GROUPS`.
 * Never honored in production (must use real proxy groups).
 */
export function devRemoteGroupsFallback(): string
{
  if (process.env.NODE_ENV === "production")
  {
    return "";
  }
  return (process.env.DEV_REMOTE_GROUPS ?? "").trim();
}
