import { Router } from "express";
import { AUTHELIA_LOGOUT_URL } from "../config.js";
import { authMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.get(
  "/session",
  authMiddleware,
  asyncHandler(async (req, res) =>
  {
    const subject = req.remoteSubject!;
    const role = req.userRole === "ADMIN" ? "admin" : "user";
    const logoutUrl = AUTHELIA_LOGOUT_URL.length > 0 ? AUTHELIA_LOGOUT_URL : null;
    res.json({
      subject,
      role,
      logoutUrl,
    });
  }),
);

export default router;
