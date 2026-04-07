import type { Request, Response, Router } from "express";
import { z } from "zod";
import { requireTournamentExists } from "./shared.js";
import { notifyTournamentChanged } from "../../realtime/notify.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import {
  generateGroupMatches,
  generateKnockoutMatches,
  deleteAllMatches,
  patchMatchScores,
  handleTimerAction,
} from "../../services/tournamentMatchService.js";

/** Request body schema for score updates (both values optional in payload). */
const scoresSchema = z.object({
  homeScore: z.number().int().min(0).optional(),
  awayScore: z.number().int().min(0).optional(),
});

/** Request body schema for match timer actions. */
const timerSchema = z.object({
  action: z.enum(["start", "pause", "resume", "end", "cancel"]),
});

/** POST /:id/generate-group-matches - creates group-stage matches. */
async function generateGroupMatchesHandler(req: Request, res: Response): Promise<void>
{
  const tournamentId = String(req.params.id);
  const owned = await requireTournamentExists(res, tournamentId);
  if (!owned) return;
  const detail = await generateGroupMatches(tournamentId);
  notifyTournamentChanged(tournamentId);
  res.json(detail);
}

/** POST /:id/generate-knockout - creates knockout matches. */
async function generateKnockoutMatchesHandler(req: Request, res: Response): Promise<void>
{
  const tournamentId = String(req.params.id);
  const owned = await requireTournamentExists(res, tournamentId);
  if (!owned) return;
  const detail = await generateKnockoutMatches(tournamentId);
  notifyTournamentChanged(tournamentId);
  res.json(detail);
}

/** DELETE /:id/matches - removes all matches and resets phase. */
async function deleteAllMatchesHandler(req: Request, res: Response): Promise<void>
{
  const tournamentId = String(req.params.id);
  const owned = await requireTournamentExists(res, tournamentId);
  if (!owned) return;
  const detail = await deleteAllMatches(tournamentId);
  notifyTournamentChanged(tournamentId);
  res.json(detail);
}

/** PATCH /:id/matches/:matchId/scores - updates persisted match scores. */
async function patchMatchScoresHandler(req: Request, res: Response): Promise<void>
{
  const tournamentId = String(req.params.id);
  const matchId = String(req.params.matchId);
  const parsed = scoresSchema.safeParse(req.body);
  if (!parsed.success)
  {
    res.status(400).json({ error: "Ungültige Ergebnisse" });
    return;
  }
  const owned = await requireTournamentExists(res, tournamentId);
  if (!owned) return;
  const match = await patchMatchScores(
    tournamentId,
    matchId,
    parsed.data,
  );
  notifyTournamentChanged(tournamentId);
  res.json(match);
}

/** POST /:id/matches/:matchId/timer - executes one timer action. */
async function handleTimerActionHandler(req: Request, res: Response): Promise<void>
{
  const tournamentId = String(req.params.id);
  const matchId = String(req.params.matchId);
  const parsed = timerSchema.safeParse(req.body);
  if (!parsed.success)
  {
    res.status(400).json({ error: "Ungültige Aktion" });
    return;
  }
  const owned = await requireTournamentExists(res, tournamentId);
  if (!owned) return;
  const match = await handleTimerAction(
    tournamentId,
    matchId,
    parsed.data.action,
  );
  notifyTournamentChanged(tournamentId);
  res.json(match);
}

/** Registers tournament match generation, score, and timer routes. */
export function registerTournamentMatchRoutes(router: Router): void
{
  router.post("/:id/generate-group-matches", asyncHandler(generateGroupMatchesHandler));
  router.post("/:id/generate-knockout", asyncHandler(generateKnockoutMatchesHandler));
  router.delete("/:id/matches", asyncHandler(deleteAllMatchesHandler));
  router.patch("/:id/matches/:matchId/scores", asyncHandler(patchMatchScoresHandler));
  router.post("/:id/matches/:matchId/timer", asyncHandler(handleTimerActionHandler));
}
