import type { NextFunction, Request, Response, Router } from "express";
import type { TournamentMode, TournamentPhase } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db.js";
import { createdBySelect, parseListScope, toCreatedBy } from "../../lib/createdBy.js";
import {
  getUserSchoolId,
  loadTournamentByIdForSchool,
  requireTournamentExists,
  serializeTournamentDetail,
} from "./shared.js";
import {
  notifyTournamentChanged,
  notifyTournamentsListChanged,
} from "../../realtime/notify.js";

/** Request body schema for creating a tournament. */
const createTournamentSchema = z.object({
  name: z.string().min(1),
  sport: z.string().min(1),
  mode: z.enum(["GROUP_KO", "DIRECT_KO", "ROUND_ROBIN"]).optional(),
  groupCount: z.number().int().min(1).max(16).optional(),
  advancesPerGroup: z.number().int().min(1).max(8).optional(),
  teamsAreIndividuals: z.boolean().optional(),
});

/** Request body schema for patching editable tournament fields. */
const patchTournamentSchema = z.object({
  name: z.string().min(1).optional(),
  sport: z.string().min(1).optional(),
  groupCount: z.number().int().min(1).max(16).optional(),
  advancesPerGroup: z.number().int().min(1).max(8).optional(),
});

/** GET / - lists tournaments (all or own scope). */
async function listTournamentsHandler(req: Request, res: Response): Promise<void>
{
  const schoolId = await getUserSchoolId(req.userId!);
  if (!schoolId)
  {
    res.status(404).json({ error: "Benutzer nicht gefunden" });
    return;
  }
  const scope = parseListScope(req.query.scope);
  const where = scope === "own"
    ? { schoolId, userId: req.userId! }
    : { schoolId };
  const list = await prisma.tournament.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      user: { select: createdBySelect },
      _count: { select: { teams: true, matches: true } },
    },
  });
  res.json(
    list.map(({ user, ...row }) => ({
      ...row,
      createdBy: toCreatedBy(user),
    }))
  );
}

/** POST / - creates a tournament and returns the created row with metadata. */
async function createTournamentHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void>
{
  const schoolId = await getUserSchoolId(req.userId!);
  if (!schoolId)
  {
    res.status(404).json({ error: "Benutzer nicht gefunden" });
    return;
  }
  const parsed = createTournamentSchema.safeParse(req.body);
  if (!parsed.success)
  {
    res.status(400).json({ error: "Ungültige Eingaben" });
    return;
  }
  const mode: TournamentMode = parsed.data.mode ?? "GROUP_KO";
  const defaultPhase: TournamentPhase = mode === "DIRECT_KO"
    ? "QUARTER"
    : "GROUP";
  try
  {
    const t = await prisma.tournament.create({
      data: {
        name: parsed.data.name,
        sport: parsed.data.sport,
        mode,
        phase: defaultPhase,
        groupCount: parsed.data.groupCount ?? 1,
        userId: req.userId!,
        schoolId,
        advancesPerGroup: parsed.data.advancesPerGroup ?? 2,
        teamsAreIndividuals: parsed.data.teamsAreIndividuals ?? false,
      },
      include: {
        user: { select: createdBySelect },
        _count: { select: { teams: true, matches: true } },
      },
    });
    const { user, ...row } = t;
    notifyTournamentsListChanged();
    res.status(201).json({
      ...row,
      createdBy: toCreatedBy(user),
    });
  }
  catch (err)
  {
    next(err);
  }
}

/** GET /:id - returns one tournament detail payload. */
async function getTournamentDetailHandler(req: Request, res: Response): Promise<void>
{
  const tournamentId = String(req.params.id);
  const schoolId = await getUserSchoolId(req.userId!);
  if (!schoolId)
  {
    res.status(404).json({ error: "Benutzer nicht gefunden" });
    return;
  }
  const t = await loadTournamentByIdForSchool(tournamentId, schoolId);
  if (!t)
  {
    res.status(404).json({ error: "Turnier nicht gefunden" });
    return;
  }
  res.json(serializeTournamentDetail(t));
}

/** PATCH /:id - updates editable tournament fields and returns detail payload. */
async function patchTournamentHandler(req: Request, res: Response): Promise<void>
{
  const tournamentId = String(req.params.id);
  const schoolId = await getUserSchoolId(req.userId!);
  if (!schoolId)
  {
    res.status(404).json({ error: "Benutzer nicht gefunden" });
    return;
  }
  const parsed = patchTournamentSchema.safeParse(req.body);
  if (!parsed.success)
  {
    res.status(400).json({ error: "Ungültige Eingaben" });
    return;
  }
  const exists = await requireTournamentExists(res, tournamentId, schoolId);
  if (!exists) return;
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: parsed.data,
  });
  const full = await loadTournamentByIdForSchool(tournamentId, schoolId);
  notifyTournamentChanged(tournamentId);
  notifyTournamentsListChanged();
  res.json(serializeTournamentDetail(full!));
}

/** DELETE /:id - deletes a tournament and broadcasts realtime updates. */
async function deleteTournamentHandler(req: Request, res: Response): Promise<void>
{
  const tournamentId = String(req.params.id);
  const schoolId = await getUserSchoolId(req.userId!);
  if (!schoolId)
  {
    res.status(404).json({ error: "Benutzer nicht gefunden" });
    return;
  }
  const exists = await requireTournamentExists(res, tournamentId, schoolId);
  if (!exists) return;
  await prisma.tournament.delete({ where: { id: tournamentId } });
  notifyTournamentChanged(tournamentId);
  notifyTournamentsListChanged();
  res.status(204).send();
}

/** Registers core tournament CRUD routes. */
export function registerTournamentCoreRoutes(router: Router): void
{
  router.get("/", listTournamentsHandler);
  router.post("/", createTournamentHandler);
  router.get("/:id", getTournamentDetailHandler);
  router.patch("/:id", patchTournamentHandler);
  router.delete("/:id", deleteTournamentHandler);
}
