import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  createdBySelect,
  parseListScope,
  schoolClassToApi,
} from "../lib/createdBy.js";

const router = Router();
router.use(authMiddleware);

const createSchema = z.object({
  name: z.string().min(1),
});

const updateSchema = z.object({
  name: z.string().min(1),
});

router.get("/", async (req, res) => {
  const scope = parseListScope(req.query.scope);
  const where = scope === "own" ? { userId: req.userId! } : {};
  const rows = await prisma.schoolClass.findMany({
    where,
    orderBy: { name: "asc" },
    include: { user: { select: createdBySelect } },
  });
  res.json(rows.map((row) => schoolClassToApi(row)));
});

router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingaben" });
    return;
  }
  const name = parsed.data.name.trim();
  try 
  {
    const row = await prisma.schoolClass.create({
      data: { name, userId: req.userId! },
      include: { user: { select: createdBySelect } },
    });
    res.status(201).json(schoolClassToApi(row));
  }
  catch (e) 
  {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError
      && e.code === "P2002"
    ) 
    {
      res.status(409).json({ error: "Diese Klasse existiert bereits" });
      return;
    }
    throw e;
  }
});

router.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingaben" });
    return;
  }
  const existing = await prisma.schoolClass.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!existing) {
    res.status(404).json({ error: "Klasse nicht gefunden" });
    return;
  }
  const name = parsed.data.name.trim();
  try 
  {
    const row = await prisma.schoolClass.update({
      where: { id: req.params.id },
      data: { name },
      include: { user: { select: createdBySelect } },
    });
    res.json(schoolClassToApi(row));
  }
  catch (e) 
  {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError
      && e.code === "P2002"
    ) 
    {
      res.status(409).json({ error: "Diese Klasse existiert bereits" });
      return;
    }
    throw e;
  }
});

router.delete("/:id", async (req, res) => {
  const existing = await prisma.schoolClass.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!existing) {
    res.status(404).json({ error: "Klasse nicht gefunden" });
    return;
  }
  await prisma.schoolClass.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
