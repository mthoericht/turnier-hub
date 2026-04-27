import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  parseListScope,
  playerApiInclude,
  playerToApi,
} from "../lib/createdBy.js";
import {
  classNameSchema,
  idSchema,
  mediumNameSchema,
} from "../lib/validation.js";
import { notifyCatalogChanged } from "../realtime/notify.js";

const router = Router();
router.use(authMiddleware);

const createSchema = z.object({
  firstName: mediumNameSchema,
  lastName: mediumNameSchema,
  schoolClassId: idSchema.optional().nullable(),
}).strict();

const updateSchema = z.object({
  firstName: mediumNameSchema.optional(),
  lastName: mediumNameSchema.optional(),
  schoolClassId: idSchema.optional().nullable(),
}).strict();

const importSchema = z.object({
  mode: z.enum(["reset_all", "append", "replace_players"]).default("append"),
  rows: z.array(
    z.object({
      firstName: mediumNameSchema,
      lastName: mediumNameSchema,
      className: classNameSchema,
    }).strict(),
  ).min(1),
}).strict();

async function getRequestUserSchoolId(userId: string): Promise<string | null>
{
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { schoolId: true },
  });
  return user?.schoolId ?? null;
}

router.get("/", asyncHandler(async (req, res) => {
  const schoolId = await getRequestUserSchoolId(req.userId!);
  if (!schoolId) {
    res.status(404).json({ error: "Benutzer nicht gefunden" });
    return;
  }
  const scope = parseListScope(req.query.scope);
  const where = scope === "own"
    ? { schoolId, userId: req.userId! }
    : { schoolId };
  const rows = await prisma.player.findMany({
    where,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    include: playerApiInclude,
  });
  res.json(rows.map((row) => playerToApi(row)));
}));

router.post("/", asyncHandler(async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingaben" });
    return;
  }
  const schoolId = await getRequestUserSchoolId(req.userId!);
  if (!schoolId) {
    res.status(404).json({ error: "Benutzer nicht gefunden" });
    return;
  }
  let schoolClassId: string | null = parsed.data.schoolClassId ?? null;
  if (schoolClassId) 
  {
    const sc = await prisma.schoolClass.findFirst({
      where: { id: schoolClassId, schoolId },
    });
    if (!sc) 
    {
      res.status(400).json({ error: "Klasse nicht gefunden" });
      return;
    }
  }
  const row = await prisma.player.create({
    data: {
      firstName: parsed.data.firstName.trim(),
      lastName: parsed.data.lastName.trim(),
      schoolClassId,
      userId: req.userId!,
      schoolId,
    },
    include: playerApiInclude,
  });
  notifyCatalogChanged(["players", "classes"]);
  res.status(201).json(playerToApi(row));
}));

router.patch("/:id", asyncHandler(async (req, res) => {
  const playerId = String(req.params.id);
  const schoolId = await getRequestUserSchoolId(req.userId!);
  if (!schoolId) {
    res.status(404).json({ error: "Benutzer nicht gefunden" });
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingaben" });
    return;
  }
  const existing = await prisma.player.findFirst({
    where: { id: playerId, schoolId },
  });
  if (!existing) {
    res.status(404).json({ error: "Spieler nicht gefunden" });
    return;
  }
  if (
    parsed.data.schoolClassId !== undefined
    && parsed.data.schoolClassId
  ) 
  {
    const sc = await prisma.schoolClass.findFirst({
      where: { id: parsed.data.schoolClassId, schoolId },
    });
    if (!sc) 
    {
      res.status(400).json({ error: "Klasse nicht gefunden" });
      return;
    }
  }
  const row = await prisma.player.update({
    where: { id: playerId },
    data: {
      ...(parsed.data.firstName != null ? { firstName: parsed.data.firstName.trim() } : {}),
      ...(parsed.data.lastName != null ? { lastName: parsed.data.lastName.trim() } : {}),
      ...(parsed.data.schoolClassId !== undefined
        ? { schoolClassId: parsed.data.schoolClassId }
        : {}),
    },
    include: playerApiInclude,
  });
  notifyCatalogChanged(["players", "classes"]);
  res.json(playerToApi(row));
}));

router.post("/import", asyncHandler(async (req, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success)
  {
    res.status(400).json({ error: "Ungültige Importdaten" });
    return;
  }

  const mode = parsed.data.mode;
  const schoolId = await getRequestUserSchoolId(req.userId!);
  if (!schoolId)
  {
    res.status(404).json({ error: "Benutzer nicht gefunden" });
    return;
  }

  await prisma.$transaction(async (tx) =>
  {
    const buildKey = (firstName: string, lastName: string, schoolClassId: string | null): string =>
      `${firstName}\u0000${lastName}\u0000${schoolClassId ?? ""}`;

    if (mode === "reset_all")
    {
      await tx.tournament.deleteMany({ where: { schoolId } });
      await tx.player.deleteMany({ where: { schoolId } });
      await tx.schoolClass.deleteMany({ where: { schoolId } });
    }
    const classNameSet = new Set(
      parsed.data.rows.map((row) => row.className.trim()).filter(Boolean),
    );
    const classNames = [...classNameSet];

    const existingClasses = await tx.schoolClass.findMany({
      where: {
        userId: req.userId!,
        schoolId,
        name: { in: classNames },
      },
      select: { id: true, name: true },
    });
    const classByName = new Map(existingClasses.map((c) => [c.name, c.id] as const));

    const missingClassNames = classNames.filter((name) => !classByName.has(name));
    if (missingClassNames.length > 0)
    {
      const createdClasses = await Promise.all(
        missingClassNames.map((name) =>
          tx.schoolClass.create({
            data: { name, userId: req.userId!, schoolId },
            select: { id: true, name: true },
          })
        ),
      );
      for (const c of createdClasses) classByName.set(c.name, c.id);
    }

    const normalizedRows = parsed.data.rows.map((row) => ({
      firstName: row.firstName.trim(),
      lastName: row.lastName.trim(),
      schoolClassId: classByName.get(row.className.trim()) ?? null,
    }));

    if (mode === "replace_players")
    {
      const existingPlayers = await tx.player.findMany({
        where: { schoolId, userId: req.userId! },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          schoolClassId: true,
        },
      });

      const desiredKeys = new Set(
        normalizedRows.map((row) => buildKey(row.firstName, row.lastName, row.schoolClassId)),
      );
      const existingKeys = new Set(
        existingPlayers.map((p) => buildKey(p.firstName, p.lastName, p.schoolClassId)),
      );

      const playerIdsToDelete = existingPlayers
        .filter((p) => !desiredKeys.has(buildKey(p.firstName, p.lastName, p.schoolClassId)))
        .map((p) => p.id);

      if (playerIdsToDelete.length > 0)
      {
        await tx.player.deleteMany({
          where: { id: { in: playerIdsToDelete } },
        });
      }

      const rowsToCreate = normalizedRows.filter((row) =>
        !existingKeys.has(buildKey(row.firstName, row.lastName, row.schoolClassId)),
      );

      if (rowsToCreate.length > 0)
      {
        await tx.player.createMany({
          data: rowsToCreate.map((row) => ({
            firstName: row.firstName,
            lastName: row.lastName,
            schoolClassId: row.schoolClassId,
            userId: req.userId!,
            schoolId,
          })),
        });
      }
      return;
    }

    await tx.player.createMany({
      data: normalizedRows.map((row) => ({
        firstName: row.firstName,
        lastName: row.lastName,
        schoolClassId: row.schoolClassId,
        userId: req.userId!,
        schoolId,
      })),
    });
  });

  notifyCatalogChanged(["players", "classes"]);
  res.status(201).json({ imported: parsed.data.rows.length });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const playerId = String(req.params.id);
  const schoolId = await getRequestUserSchoolId(req.userId!);
  if (!schoolId) {
    res.status(404).json({ error: "Benutzer nicht gefunden" });
    return;
  }
  const existing = await prisma.player.findFirst({
    where: { id: playerId, schoolId },
  });
  if (!existing) {
    res.status(404).json({ error: "Spieler nicht gefunden" });
    return;
  }
  await prisma.player.delete({ where: { id: playerId } });
  notifyCatalogChanged(["players", "classes"]);
  res.status(204).send();
}));

export default router;
