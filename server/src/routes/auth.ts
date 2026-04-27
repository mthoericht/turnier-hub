import type { Request, Response } from "express";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";
import {
  AUTH_IDENTIFIER_MAX_REQUESTS,
  AUTH_LOGIN_MAX_REQUESTS,
  AUTH_RATE_LIMIT_WINDOW_MS,
  AUTH_SIGNUP_MAX_REQUESTS,
  INVITE_CODE,
} from "../config.js";
import { authMiddleware } from "../middleware/auth.js";
import { signToken } from "../auth/token.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { ensureDefaultSchool } from "../lib/schools.js";
import { createAuthRateLimiter } from "../middleware/authRateLimit.js";

const router = Router();
const loginRateLimit = createAuthRateLimiter({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  maxPerIp: AUTH_LOGIN_MAX_REQUESTS,
  maxPerIdentifier: AUTH_IDENTIFIER_MAX_REQUESTS,
});
const signupRateLimit = createAuthRateLimiter({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  maxPerIp: AUTH_SIGNUP_MAX_REQUESTS,
  maxPerIdentifier: AUTH_IDENTIFIER_MAX_REQUESTS,
});

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
  schoolId: z.string().min(1, "Schule erforderlich"),
});

/** Request body schema for email/password login. */
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const userAuthInclude = {
  school: {
    select: {
      name: true,
    },
  },
} as const;

type AuthUserRow = {
  id: string;
  username: string | null;
  email: string;
  role: "ADMIN" | "USER";
  school: {
    name: string;
  };
};

function toAuthUser(user: AuthUserRow): {
  id: string;
  username: string | null;
  email: string;
  schoolName: string;
  role: "admin" | "user";
}
{
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    schoolName: user.school.name,
    role: user.role === "ADMIN" ? "admin" : "user",
  };
}

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
    first.schoolId?.[0] ??
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
  const { email, password, inviteCode, schoolId } = parsed;
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

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true },
  });
  if (!school) {
    res.status(400).json({ error: "Schule nicht gefunden" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, email, passwordHash, schoolId },
    include: userAuthInclude,
  });

  const token = signToken(user.id);
  res.status(201).json({
    token,
    user: toAuthUser(user),
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
      role: true,
      passwordHash: true,
      school: {
        select: {
          name: true,
        },
      },
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
    user: toAuthUser(publicUser),
  });
}

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's public profile.
 */
async function meHandler(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    include: userAuthInclude,
  });
  if (!user) {
    res.status(404).json({ error: "Benutzer nicht gefunden" });
    return;
  }
  res.json(toAuthUser(user));
}

async function listSchoolsHandler(_req: Request, res: Response): Promise<void>
{
  await ensureDefaultSchool();
  const schools = await prisma.school.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  res.json(schools);
}

router.get("/schools", asyncHandler(listSchoolsHandler));
router.post("/signup", signupRateLimit, asyncHandler(signupHandler));
router.post("/login", loginRateLimit, asyncHandler(loginHandler));
router.get("/me", authMiddleware, asyncHandler(meHandler));

export default router;
