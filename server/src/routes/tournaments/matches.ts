import type { Router } from "express";
import { z } from "zod";
import { requireTournamentExists } from "./shared.js";
import { notifyTournamentChanged } from "../../realtime/notify.js";
import { ServiceError } from "../../services/ServiceError.js";
import {
  generateGroupMatches,
  generateKnockoutMatches,
  deleteAllMatches,
  patchMatchScores,
  handleTimerAction,
} from "../../services/tournamentMatchService.js";

const scoresSchema = z.object({
  homeScore: z.number().int().min(0).optional(),
  awayScore: z.number().int().min(0).optional(),
});

const timerSchema = z.object({
  action: z.enum(["start", "pause", "resume", "end", "cancel"]),
});

export function registerTournamentMatchRoutes(router: Router): void
{
  router.post("/:id/generate-group-matches", async (req, res) =>
  {
    const owned = await requireTournamentExists(res, req.params.id);
    if (!owned) return;
    try
    {
      const detail = await generateGroupMatches(req.params.id);
      notifyTournamentChanged(req.params.id);
      res.json(detail);
    }
    catch (err)
    {
      if (err instanceof ServiceError)
      {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: "Interner Fehler" });
    }
  });

  router.post("/:id/generate-knockout", async (req, res) =>
  {
    const owned = await requireTournamentExists(res, req.params.id);
    if (!owned) return;
    try
    {
      const detail = await generateKnockoutMatches(req.params.id);
      notifyTournamentChanged(req.params.id);
      res.json(detail);
    }
    catch (err)
    {
      if (err instanceof ServiceError)
      {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: "Interner Fehler" });
    }
  });

  router.delete("/:id/matches", async (req, res) =>
  {
    const owned = await requireTournamentExists(res, req.params.id);
    if (!owned) return;
    try
    {
      const detail = await deleteAllMatches(req.params.id);
      notifyTournamentChanged(req.params.id);
      res.json(detail);
    }
    catch (err)
    {
      if (err instanceof ServiceError)
      {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: "Interner Fehler" });
    }
  });

  router.patch("/:id/matches/:matchId/scores", async (req, res) =>
  {
    const parsed = scoresSchema.safeParse(req.body);
    if (!parsed.success)
    {
      res.status(400).json({ error: "Ungültige Ergebnisse" });
      return;
    }
    const owned = await requireTournamentExists(res, req.params.id);
    if (!owned) return;
    try
    {
      const match = await patchMatchScores(
        req.params.id,
        req.params.matchId,
        parsed.data,
      );
      notifyTournamentChanged(req.params.id);
      res.json(match);
    }
    catch (err)
    {
      if (err instanceof ServiceError)
      {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: "Interner Fehler" });
    }
  });

  router.post("/:id/matches/:matchId/timer", async (req, res) =>
  {
    const parsed = timerSchema.safeParse(req.body);
    if (!parsed.success)
    {
      res.status(400).json({ error: "Ungültige Aktion" });
      return;
    }
    const owned = await requireTournamentExists(res, req.params.id);
    if (!owned) return;
    try
    {
      const match = await handleTimerAction(
        req.params.id,
        req.params.matchId,
        parsed.data.action,
      );
      notifyTournamentChanged(req.params.id);
      res.json(match);
    }
    catch (err)
    {
      if (err instanceof ServiceError)
      {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: "Interner Fehler" });
    }
  });
}
