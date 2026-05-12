import type { Request, Response, NextFunction } from "express";
import { devRemoteAdminEnabled, devRemoteUserFallback } from "../lib/devRemoteUser.js";
import { remoteGroupsHeaderGrantsAdmin } from "../lib/remoteAdminGroups.js";

export type GateUserRole = "ADMIN" | "USER";

/**
 * Splits comma-separated values into a trimmed string array.
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

function normalizeRemoteHeader(value: string | string[] | undefined): string
{
  if (Array.isArray(value))
  {
    return (value[0] ?? "").trim();
  }
  return (value ?? "").trim();
}

/**
 * Trusts reverse-proxy identity: `Remote-User` (see Authelia forward header).
 * Admin role if `Remote-User` is in `ADMIN_REMOTE_USERS` **or** `Remote-Groups` contains
 * `ADMIN_REMOTE_GROUP` (default `admins`, case-insensitive; set `ADMIN_REMOTE_GROUP=` to disable group check).
 * In non-production, falls back to `DEV_REMOTE_USER` when the header is absent.
 * `DEV_REMOTE_USER` is ignored when `NODE_ENV` is `production`.
 * Optional `DEV_REMOTE_ADMIN` (non-production): grants `ADMIN` to every authenticated subject.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void
{
  const fromHeader = normalizeRemoteHeader(req.headers["remote-user"]);
  const subject = fromHeader || devRemoteUserFallback();
  if (!subject)
  {
    res.status(401).json({ error: "Nicht angemeldet" });
    return;
  }
  req.remoteSubject = subject;
  const admins = new Set(splitCsv(process.env.ADMIN_REMOTE_USERS));
  const fromGroups = remoteGroupsHeaderGrantsAdmin(
    req.headers["remote-groups"],
    process.env.ADMIN_REMOTE_GROUP,
  );
  let role: GateUserRole = (admins.has(subject) || fromGroups) ? "ADMIN" : "USER";
  if (devRemoteAdminEnabled())
  {
    role = "ADMIN";
  }
  req.userRole = role;
  next();
}
