import type { Request, Response, NextFunction } from "express";
import { devRemoteGroupsFallback, devRemoteUserFallback } from "../lib/devRemoteUser.js";
import { remoteGroupsHeaderGrantsAdmin } from "../lib/remoteAdminGroups.js";

export type GateUserRole = "ADMIN" | "USER";

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
 * Admin role if `Remote-Groups` contains the `admins` group.
 * In non-production, falls back to `DEV_REMOTE_USER` when the header is absent.
 * In non-production, falls back to `DEV_REMOTE_GROUPS` when `Remote-Groups` is absent.
 * Dev fallbacks are ignored when `NODE_ENV` is `production`.
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
  const fromHeaderGroups = normalizeRemoteHeader(req.headers["remote-groups"]);
  const groups = fromHeaderGroups || devRemoteGroupsFallback();
  req.userRole = remoteGroupsHeaderGrantsAdmin(groups) ? "ADMIN" : "USER";
  next();
}
