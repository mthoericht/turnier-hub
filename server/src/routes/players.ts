import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  parseListScope,
  playerApiInclude,
  playerToApi,
} from "../lib/createdBy.js";
import { notifyUserCatalog } from "../realtime/notify.js";

const router = Router();
router.use(authMiddleware);

const createSchema = z.object({
  name: z.string().min(1),
  schoolClassId: z.string().optional().nullable(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  schoolClassId: z.string().optional().nullable(),
});

router.get("/", async (req, res) => {
  const scope = parseListScope(req.query.scope);
  const where = scope === "own" ? { userId: req.userId! } : {};
  const rows = await prisma.player.findMany({
    where,
    orderBy: { name: "asc" },
    include: playerApiInclude,
  });
  res.json(rows.map((row) => playerToApi(row)));
});

router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingaben" });
    return;
  }
  let schoolClassId: string | null = parsed.data.schoolClassId ?? null;
  if (schoolClassId) 
  {
    const sc = await prisma.schoolClass.findFirst({
      where: { id: schoolClassId, userId: req.userId! },
    });
    if (!sc) 
    {
      res.status(400).json({ error: "Klasse nicht gefunden" });
      return;
    }
  }
  const row = await prisma.player.create({
    data: {
      name: parsed.data.name,
      schoolClassId,
      userId: req.userId!,
    },
    include: playerApiInclude,
  });
  notifyUserCatalog(req.userId!, ["players", "classes"]);
  res.status(201).json(playerToApi(row));
});

router.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingaben" });
    return;
  }
  const existing = await prisma.player.findFirst({
    where: { id: req.params.id, userId: req.userId! },
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
      where: { id: parsed.data.schoolClassId, userId: req.userId! },
    });
    if (!sc) 
    {
      res.status(400).json({ error: "Klasse nicht gefunden" });
      return;
    }
  }
  const row = await prisma.player.update({
    where: { id: req.params.id },
    data: {
      ...(parsed.data.name != null ? { name: parsed.data.name } : {}),
      ...(parsed.data.schoolClassId !== undefined
        ? { schoolClassId: parsed.data.schoolClassId }
        : {}),
    },
    include: playerApiInclude,
  });
  notifyUserCatalog(req.userId!, ["players", "classes"]);
  res.json(playerToApi(row));
});

router.delete("/:id", async (req, res) => {
  const existing = await prisma.player.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!existing) {
    res.status(404).json({ error: "Spieler nicht gefunden" });
    return;
  }
  await prisma.player.delete({ where: { id: req.params.id } });
  notifyUserCatalog(req.userId!, ["players", "classes"]);
  res.status(204).send();
});

export default router;
