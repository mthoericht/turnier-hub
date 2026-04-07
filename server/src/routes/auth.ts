import type { Request, Response } from "express";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";
import { INVITE_CODE } from "../config.js";
import { authMiddleware } from "../middleware/auth.js";
import { signToken } from "../auth/token.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

/** Username validation shared by signup and any future profile updates. */
const usernameSchema = z
  .string()
  .trim()
  .min(3, "Benutzername mindestens 3 Zeichen")
  .max(32, "Benutzername höchstens 32 Zeichen")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Nur Buchstaben, Ziffern, Unterstrich und Bindestrich"
  );

/** Request body schema for account creation. */
const signupSchema = z.object({
  username: usernameSchema,
  email: z.string().email(),
  password: z.string().min(8),
  inviteCode: z.string(),
});

/** Request body schema for email/password login. */
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

/** Public user fields returned to the client. */
const userPublicSelect = {
  id: true,
  username: true,
  email: true,
} as const;

/**
 * Returns the first user-facing signup validation error.
 * Falls back to a generic message if no field-specific error exists.
 */
function getSignupValidationMessage(reqBody: unknown): string | null {
  const parsed = signupSchema.safeParse(reqBody);
  if (parsed.success) {
    return null;
  }

  const first = parsed.error.flatten().fieldErrors;
  return (
    first.username?.[0] ??
    first.email?.[0] ??
    first.password?.[0] ??
    "Ungültige Eingaben"
  );
}

/**
 * POST /api/auth/signup
 * Validates input, enforces invite code and unique identity, then returns JWT + public user.
 */
async function signupHandler(req: Request, res: Response): Promise<void> {
  const validationMessage = getSignupValidationMessage(req.body);
  if (validationMessage) {
    res.status(400).json({ error: validationMessage });
    return;
  }

  const parsed = signupSchema.parse(req.body);
  const { email, password, inviteCode } = parsed;
  const username = parsed.username.trim().toLowerCase();

  if (inviteCode !== INVITE_CODE) {
    res.status(403).json({ error: "Ungültiger Einladungscode" });
    return;
  }

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    res.status(409).json({ error: "E-Mail ist bereits registriert" });
    return;
  }

  const existingName = await prisma.user.findUnique({ where: { username } });
  if (existingName) {
    res.status(409).json({ error: "Benutzername ist bereits vergeben" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, email, passwordHash },
    select: userPublicSelect,
  });

  const token = signToken(user.id);
  res.status(201).json({
    token,
    user,
  });
}

/**
 * POST /api/auth/login
 * Verifies credentials and returns JWT + public user.
 */
async function loginHandler(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingaben" });
    return;
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      username: true,
      email: true,
      passwordHash: true,
    },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "E-Mail oder Passwort falsch" });
    return;
  }

  const token = signToken(user.id);
  const { passwordHash: _pw, ...publicUser } = user;
  res.json({
    token,
    user: publicUser,
  });
}

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's public profile.
 */
async function meHandler(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: userPublicSelect,
  });
  if (!user) {
    res.status(404).json({ error: "Benutzer nicht gefunden" });
    return;
  }
  res.json(user);
}

router.post("/signup", asyncHandler(signupHandler));
router.post("/login", asyncHandler(loginHandler));
router.get("/me", authMiddleware, asyncHandler(meHandler));

export default router;
