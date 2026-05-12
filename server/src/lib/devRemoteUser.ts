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
 * When set (e.g. `1` / `true`), every authenticated subject gets `ADMIN` for API + session.
 * Ignored in production — use `ADMIN_REMOTE_USERS` with real proxy identity there.
 */
export function devRemoteAdminEnabled(): boolean
{
  if (process.env.NODE_ENV === "production")
  {
    return false;
  }
  const v = (process.env.DEV_REMOTE_ADMIN ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
