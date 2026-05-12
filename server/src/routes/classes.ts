import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { getCatalogSchoolId } from "../lib/catalogSchool.js";
import {
  parseListScope,
  schoolClassToApi,
} from "../lib/createdBy.js";
import { classNameSchema } from "../lib/validation.js";
import { notifyCatalogChanged } from "../realtime/notify.js";

const router = Router();
router.use(authMiddleware);

const createSchema = z.object({
  name: classNameSchema,
}).strict();

const updateSchema = z.object({
  name: classNameSchema,
}).strict();

router.get("/", asyncHandler(async (req, res) =>
{
  const schoolId = await getCatalogSchoolId();
  const scope = parseListScope(req.query.scope);
  const where = scope === "own"
    ? { schoolId, createdBySubject: req.remoteSubject! }
    : { schoolId };
  const rows = await prisma.schoolClass.findMany({
    where,
    orderBy: { name: "asc" },
  });
  res.json(rows.map((row) => schoolClassToApi(row)));
}));

router.post("/", asyncHandler(async (req, res) =>
{
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success)
  {
    res.status(400).json({ error: "Ungültige Eingaben" });
    return;
  }
  const name = parsed.data.name.trim();
  const schoolId = await getCatalogSchoolId();
  try
  {
    const row = await prisma.schoolClass.create({
      data: { name, createdBySubject: req.remoteSubject!, schoolId },
    });
    notifyCatalogChanged(["classes", "players"]);
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
}));

router.patch("/:id", asyncHandler(async (req, res) =>
{
  const classId = String(req.params.id);
  const schoolId = await getCatalogSchoolId();
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success)
  {
    res.status(400).json({ error: "Ungültige Eingaben" });
    return;
  }
  const existing = await prisma.schoolClass.findFirst({
    where: { id: classId, schoolId },
  });
  if (!existing)
  {
    res.status(404).json({ error: "Klasse nicht gefunden" });
    return;
  }
  const name = parsed.data.name.trim();
  try
  {
    const row = await prisma.schoolClass.update({
      where: { id: classId },
      data: { name },
    });
    notifyCatalogChanged(["classes", "players"]);
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
}));

router.delete("/:id", asyncHandler(async (req, res) =>
{
  const classId = String(req.params.id);
  const schoolId = await getCatalogSchoolId();
  const existing = await prisma.schoolClass.findFirst({
    where: { id: classId, schoolId },
  });
  if (!existing)
  {
    res.status(404).json({ error: "Klasse nicht gefunden" });
    return;
  }
  await prisma.schoolClass.delete({ where: { id: classId } });
  notifyCatalogChanged(["classes", "players"]);
  res.status(204).send();
}));

export default router;
