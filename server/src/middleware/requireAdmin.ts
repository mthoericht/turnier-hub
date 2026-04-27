import type { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void
{
  if (req.userRole !== "ADMIN")
  {
    res.status(403).json({ error: "Admin-Rechte erforderlich" });
    return;
  }
  next();
}
