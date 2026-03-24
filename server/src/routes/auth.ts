import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";
import { INVITE_CODE } from "../config.js";
import { authMiddleware, signToken } from "../middleware/auth.js";

const router = Router();

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Benutzername mindestens 3 Zeichen")
  .max(32, "Benutzername höchstens 32 Zeichen")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Nur Buchstaben, Ziffern, Unterstrich und Bindestrich"
  );

const signupSchema = z.object({
  username: usernameSchema,
  email: z.string().email(),
  password: z.string().min(8),
  inviteCode: z.string(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const userPublicSelect = {
  id: true,
  username: true,
  email: true,
} as const;

router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg =
      first.username?.[0] ??
      first.email?.[0] ??
      first.password?.[0] ??
      "Ungültige Eingaben";
    res.status(400).json({ error: msg });
    return;
  }
  const { email, password, inviteCode } = parsed.data;
  const username = parsed.data.username.trim().toLowerCase();
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
});

router.post("/login", async (req, res) => {
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
});

router.get("/me", authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: userPublicSelect,
  });
  if (!user) {
    res.status(404).json({ error: "Benutzer nicht gefunden" });
    return;
  }
  res.json(user);
});

export default router;
