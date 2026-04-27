import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";
import type { AuthPayload } from "../auth/token.js";
import { prisma } from "../db.js";

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void>
{
  const header = req.headers.authorization;
  const token =
    header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: "Nicht angemeldet" });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, role: true },
    });
    if (!user)
    {
      res.status(401).json({ error: "Ungültiges Token" });
      return;
    }
    req.userId = user.id;
    req.userRole = user.role;
    next();
  } catch {
    res.status(401).json({ error: "Ungültiges Token" });
  }
}
