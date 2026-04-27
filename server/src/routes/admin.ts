import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();
router.use(authMiddleware);
router.use(requireAdmin);

const schoolSchema = z.object({
  name: z.string().trim().min(1, "Name erforderlich"),
});

const userRoleSchema = z.object({
  role: z.enum(["admin", "user"]),
});

const userSchoolSchema = z.object({
  schoolId: z.string().min(1, "Schule erforderlich"),
});

async function logAdminAudit(payload: {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
}): Promise<void>
{
  await prisma.adminAuditLog.create({
    data: {
      actorUserId: payload.actorUserId,
      action: payload.action,
      targetType: payload.targetType,
      targetId: payload.targetId,
      beforeJson: payload.before == null ? null : JSON.stringify(payload.before),
      afterJson: payload.after == null ? null : JSON.stringify(payload.after),
    },
  });
}

router.get("/schools", asyncHandler(async (_req, res) =>
{
  const rows = await prisma.school.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { users: true },
      },
    },
  });
  res.json(rows.map((row) => ({
    id: row.id,
    name: row.name,
    userCount: row._count.users,
  })));
}));

router.post("/schools", asyncHandler(async (req, res) =>
{
  const parsed = schoolSchema.safeParse(req.body);
  if (!parsed.success)
  {
    res.status(400).json({ error: "Ungültige Eingaben" });
    return;
  }
  try
  {
    const school = await prisma.school.create({
      data: { name: parsed.data.name },
      select: { id: true, name: true },
    });
    await logAdminAudit({
      actorUserId: req.userId!,
      action: "school.create",
      targetType: "school",
      targetId: school.id,
      after: school,
    });
    res.status(201).json({
      ...school,
      userCount: 0,
    });
  }
  catch (error)
  {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === "P2002"
    )
    {
      res.status(409).json({ error: "Schule existiert bereits" });
      return;
    }
    throw error;
  }
}));

router.patch("/schools/:id", asyncHandler(async (req, res) =>
{
  const schoolId = String(req.params.id);
  const parsed = schoolSchema.safeParse(req.body);
  if (!parsed.success)
  {
    res.status(400).json({ error: "Ungültige Eingaben" });
    return;
  }
  try
  {
    const beforeSchool = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true },
    });
    const school = await prisma.school.update({
      where: { id: schoolId },
      data: { name: parsed.data.name },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });
    res.json({
      id: school.id,
      name: school.name,
      userCount: school._count.users,
    });
    await logAdminAudit({
      actorUserId: req.userId!,
      action: "school.update",
      targetType: "school",
      targetId: school.id,
      before: beforeSchool,
      after: { id: school.id, name: school.name },
    });
  }
  catch (error)
  {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025")
    {
      res.status(404).json({ error: "Schule nicht gefunden" });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    {
      res.status(409).json({ error: "Schule existiert bereits" });
      return;
    }
    throw error;
  }
}));

router.delete("/schools/:id", asyncHandler(async (req, res) =>
{
  const schoolId = String(req.params.id);
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, _count: { select: { users: true } } },
  });
  if (!school)
  {
    res.status(404).json({ error: "Schule nicht gefunden" });
    return;
  }
  if (school._count.users > 0)
  {
    res.status(409).json({ error: "Schule hat noch Benutzer und kann nicht gelöscht werden" });
    return;
  }
  await logAdminAudit({
    actorUserId: req.userId!,
    action: "school.delete",
    targetType: "school",
    targetId: school.id,
    before: school,
  });
  await prisma.school.delete({ where: { id: schoolId } });
  res.status(204).send();
}));

router.get("/audit-logs", asyncHandler(async (req, res) =>
{
  const limitRaw = Number(req.query.limit ?? 100);
  const take = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 100;
  const logs = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: {
      actorUser: {
        select: { id: true, username: true, email: true },
      },
    },
  });
  res.json(logs.map((log) => ({
    id: log.id,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    createdAt: log.createdAt.toISOString(),
    actor: log.actorUser,
    before: log.beforeJson ? JSON.parse(log.beforeJson) : null,
    after: log.afterJson ? JSON.parse(log.afterJson) : null,
  })));
}));

router.get("/users", asyncHandler(async (_req, res) =>
{
  const users = await prisma.user.findMany({
    orderBy: [{ createdAt: "asc" }, { email: "asc" }],
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      school: {
        select: { id: true, name: true },
      },
    },
  });
  res.json(users.map((user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role === "ADMIN" ? "admin" : "user",
    school: user.school,
  })));
}));

router.patch("/users/:id/role", asyncHandler(async (req, res) =>
{
  const userId = String(req.params.id);
  const parsed = userRoleSchema.safeParse(req.body);
  if (!parsed.success)
  {
    res.status(400).json({ error: "Ungültige Eingaben" });
    return;
  }
  try
  {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!existingUser)
    {
      res.status(404).json({ error: "Benutzer nicht gefunden" });
      return;
    }
    const targetRole = parsed.data.role === "admin" ? "ADMIN" : "USER";
    if (existingUser.role === "ADMIN" && targetRole === "USER")
    {
      const adminCount = await prisma.user.count({
        where: { role: "ADMIN" },
      });
      if (adminCount <= 1)
      {
        res.status(409).json({ error: "Mindestens ein Admin muss erhalten bleiben" });
        return;
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: targetRole },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        school: {
          select: { id: true, name: true },
        },
      },
    });
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role === "ADMIN" ? "admin" : "user",
      school: user.school,
    });
    await logAdminAudit({
      actorUserId: req.userId!,
      action: "user.role.update",
      targetType: "user",
      targetId: user.id,
      before: { role: existingUser.role },
      after: { role: user.role },
    });
  }
  catch (error)
  {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025")
    {
      res.status(404).json({ error: "Benutzer nicht gefunden" });
      return;
    }
    throw error;
  }
}));

router.patch("/users/:id/school", asyncHandler(async (req, res) =>
{
  const userId = String(req.params.id);
  const parsed = userSchoolSchema.safeParse(req.body);
  if (!parsed.success)
  {
    res.status(400).json({ error: "Ungültige Eingaben" });
    return;
  }

  const targetSchool = await prisma.school.findUnique({
    where: { id: parsed.data.schoolId },
    select: { id: true },
  });
  if (!targetSchool)
  {
    res.status(404).json({ error: "Schule nicht gefunden" });
    return;
  }

  try
  {
    const beforeUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        school: { select: { id: true, name: true } },
      },
    });
    const user = await prisma.user.update({
      where: { id: userId },
      data: { schoolId: parsed.data.schoolId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        school: {
          select: { id: true, name: true },
        },
      },
    });
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role === "ADMIN" ? "admin" : "user",
      school: user.school,
    });
    await logAdminAudit({
      actorUserId: req.userId!,
      action: "user.school.update",
      targetType: "user",
      targetId: user.id,
      before: beforeUser,
      after: { id: user.id, school: user.school },
    });
  }
  catch (error)
  {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025")
    {
      res.status(404).json({ error: "Benutzer nicht gefunden" });
      return;
    }
    throw error;
  }
}));

export default router;
