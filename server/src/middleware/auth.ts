import type { Request, Response, NextFunction } from "express";
import { getTokenVerifier } from "../auth/tokenVerifier.js";

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void>
{
  const header = req.headers.authorization;
  const token =
    header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: "Nicht angemeldet" });
    return;
  }

  const identity = await getTokenVerifier().verify(token);
  if (!identity)
  {
    res.status(401).json({ error: "Ungültiges Token" });
    return;
  }

  req.userId = identity.userId;
  req.userRole = identity.role;
  next();
}
