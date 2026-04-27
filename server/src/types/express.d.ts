import "express";
import type { UserRole } from "@prisma/client";

/**
 * Global Express request augmentation used by auth middleware.
 * `userId` is set after successful JWT verification.
 */
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: UserRole;
    }
  }
}

export {};
