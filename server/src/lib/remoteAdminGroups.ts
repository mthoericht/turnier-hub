/**
 * Authelia (and similar proxies) may send `Remote-Groups` as a comma-separated list.
 * Returns whether any listed group matches the configured admin group name (case-insensitive).
 *
 * @param adminGroupEnv `ADMIN_REMOTE_GROUP`; empty string disables the check. When unset, defaults to `"admins"`.
 */
export function remoteGroupsHeaderGrantsAdmin(
  header: string | string[] | undefined,
  adminGroupEnv: string | undefined,
): boolean
{
  const rawEnv = adminGroupEnv?.trim();
  const needle = rawEnv === "" ? "" : (rawEnv ?? "admins").trim().toLowerCase();
  if (!needle)
  {
    return false;
  }
  const raw = Array.isArray(header) ? (header[0] ?? "") : (header ?? "");
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
  return parts.includes(needle);
}
