/**
 * Authelia (and similar proxies) may send `Remote-Groups` as a comma-separated list.
 * Returns whether any listed group matches the app's admin group name (case-insensitive).
 */
export function remoteGroupsHeaderGrantsAdmin(header: string | string[] | undefined): boolean
{
  const needle = "admins";
  const raw = Array.isArray(header) ? (header[0] ?? "") : (header ?? "");
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
  return parts.includes(needle);
}
