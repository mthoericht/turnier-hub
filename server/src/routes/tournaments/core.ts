import type { Request, Response, Router } from "express";
import type { TournamentMode, TournamentPhase } from "@turnier-hub/shared";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { prisma } from "../../db.js";
import { mediumNameSchema } from "../../lib/validation.js";
import {

  loadTournamentById,
  requireTournamentExists,
  serializeTournamentDetail,
} from "./shared.js";
import {
  notifyTournamentChanged,
  notifyTournamentsListChanged,
} from "../../realtime/notify.js";

/** Request body schema for creating a tournament. */
const createTournamentSchema = z.object({
  name: mediumNameSchema,
  sport: mediumNameSchema,
  mode: z.enum(["GROUP_KO", "DIRECT_KO", "ROUND_ROBIN"]).optional(),
  groupCount: z.number().int().min(1).max(16).optional(),
  advancesPerGroup: z.number().int().min(1).max(8).optional(),
  teamsAreIndividuals: z.boolean().optional(),
}).strict();

/** Request body schema for patching editable tournament fields. */
const patchTournamentSchema = z.object({
  name: mediumNameSchema.optional(),
  sport: mediumNameSchema.optional(),
  groupCount: z.number().int().min(1).max(16).optional(),
  advancesPerGroup: z.number().int().min(1).max(8).optional(),
}).strict();

/** GET / - lists the shared tournaments. */
async function listTournamentsHandler(req: Request, res: Response): Promise<void>
{
  const list = await prisma.tournament.findMany({
    orderBy: { updatedAt: "desc" },
    include: {

      _count: { select: { teams: true, matches: true } },
    },
  });
  res.json(list);
}

/** POST / - creates a tournament and returns the created row with metadata. */
async function createTournamentHandler(
  req: Request,
  res: Response
): Promise<void>
{
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

        advancesPerGroup: parsed.data.advancesPerGroup ?? 2,
        teamsAreIndividuals: parsed.data.teamsAreIndividuals ?? false,
      },
      include: {

        _count: { select: { teams: true, matches: true } },
      },
    });
    notifyTournamentsListChanged();
    res.status(201).json(t);
  }
  catch (err)
  {
    throw err;
  }
}

/** GET /:id - returns one tournament detail payload. */
async function getTournamentDetailHandler(req: Request, res: Response): Promise<void>
{
  const tournamentId = String(req.params.id);
  const t = await loadTournamentById(tournamentId);
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
  const parsed = patchTournamentSchema.safeParse(req.body);
  if (!parsed.success)
  {
    res.status(400).json({ error: "Ungültige Eingaben" });
    return;
  }
  const exists = await requireTournamentExists(res, tournamentId);
  if (!exists) return;
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: parsed.data,
  });
  const full = await loadTournamentById(tournamentId);
  notifyTournamentChanged(tournamentId);
  notifyTournamentsListChanged();
  res.json(serializeTournamentDetail(full!));
}

/** DELETE /:id - deletes a tournament and broadcasts realtime updates. */
async function deleteTournamentHandler(req: Request, res: Response): Promise<void>
{
  const tournamentId = String(req.params.id);
  const exists = await requireTournamentExists(res, tournamentId);
  if (!exists) return;
  await prisma.tournament.delete({ where: { id: tournamentId } });
  notifyTournamentChanged(tournamentId);
  notifyTournamentsListChanged();
  res.status(204).send();
}

/** Registers core tournament CRUD routes. */
export function registerTournamentCoreRoutes(router: Router): void
{
  router.get("/", asyncHandler(listTournamentsHandler));
  router.post("/", asyncHandler(createTournamentHandler));
  router.get("/:id", asyncHandler(getTournamentDetailHandler));
  router.patch("/:id", asyncHandler(patchTournamentHandler));
  router.delete("/:id", asyncHandler(deleteTournamentHandler));
}
