import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { idSchema, mediumNameSchema } from "../lib/validation.js";

const router = Router();
router.use(authMiddleware);
router.use(requireAdmin);

const schoolSchema = z.object({
  name: mediumNameSchema,
}).strict();

async function logAdminAudit(payload: {
  actorSubject: string;
  action: string;
  targetType: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
}): Promise<void>
{
  await prisma.adminAuditLog.create({
    data: {
      actorSubject: payload.actorSubject,
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
        select: { players: true, schoolClasses: true, tournaments: true },
      },
    },
  });
  res.json(rows.map((row) => ({
    id: row.id,
    name: row.name,
    catalogCount:
      row._count.players + row._count.schoolClasses + row._count.tournaments,
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
      actorSubject: req.remoteSubject!,
      action: "school.create",
      targetType: "school",
      targetId: school.id,
      after: school,
    });
    res.status(201).json({
      ...school,
      catalogCount: 0,
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
          select: { players: true, schoolClasses: true, tournaments: true },
        },
      },
    });
    res.json({
      id: school.id,
      name: school.name,
      catalogCount:
        school._count.players + school._count.schoolClasses + school._count.tournaments,
    });
    await logAdminAudit({
      actorSubject: req.remoteSubject!,
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
    select: {
      id: true,
      _count: { select: { players: true, schoolClasses: true, tournaments: true } },
    },
  });
  if (!school)
  {
    res.status(404).json({ error: "Schule nicht gefunden" });
    return;
  }
  const catalogCount =
    school._count.players + school._count.schoolClasses + school._count.tournaments;
  if (catalogCount > 0)
  {
    res.status(409).json({
      error: "Schule enthält noch Katalogdaten (Klassen, Spieler oder Turniere) und kann nicht gelöscht werden",
    });
    return;
  }
  await logAdminAudit({
    actorSubject: req.remoteSubject!,
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
  });
  res.json(logs.map((log) => ({
    id: log.id,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    createdAt: log.createdAt.toISOString(),
    actor: { subject: log.actorSubject },
    before: log.beforeJson ? JSON.parse(log.beforeJson) : null,
    after: log.afterJson ? JSON.parse(log.afterJson) : null,
  })));
}));

export default router;
