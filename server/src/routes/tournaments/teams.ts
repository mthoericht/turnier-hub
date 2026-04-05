import type { Router } from "express";
import { z } from "zod";
import { requireTournamentExists } from "./shared.js";
import { notifyTournamentChanged } from "../../realtime/notify.js";
import { ServiceError } from "../../services/ServiceError.js";
import {
  createTeam,
  patchTeam,
  deleteTeam,
  renameGroup,
  addMember,
  removeMember,
  transferKader,
} from "../../services/tournamentRosterService.js";

const createTeamSchema = z.object({
  name: z.string().min(1).max(60),
  sortOrder: z.number().int().optional(),
});

const patchTeamSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  sortOrder: z.number().int().optional(),
});

const renameGroupSchema = z.object({
  oldLabel: z.string().trim().min(1).max(40),
  newLabel: z.string().trim().min(1).max(40),
});

const addMemberSchema = z.object({
  playerId: z.string(),
});

const transferKaderBodySchema = z.object({
  overwriteExistingMembers: z.boolean().optional(),
});

export function registerTournamentTeamRoutes(router: Router): void
{
  router.post("/:id/teams", async (req, res) =>
  {
    const owned = await requireTournamentExists(res, req.params.id);
    if (!owned) return;
    const parsed = createTeamSchema.safeParse(req.body);
    if (!parsed.success)
    {
      res.status(400).json({ error: "Ungültige Mannschaftsdaten" });
      return;
    }
    try
    {
      const team = await createTeam(
        req.params.id,
        parsed.data.name.trim(),
        parsed.data.sortOrder,
      );
      notifyTournamentChanged(req.params.id);
      res.status(201).json(team);
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

  router.patch("/:id/teams/:teamId", async (req, res) =>
  {
    const owned = await requireTournamentExists(res, req.params.id);
    if (!owned) return;
    const parsed = patchTeamSchema.safeParse(req.body);
    if (!parsed.success)
    {
      res.status(400).json({ error: "Ungültige Eingaben" });
      return;
    }
    try
    {
      const team = await patchTeam(req.params.id, req.params.teamId, parsed.data);
      notifyTournamentChanged(req.params.id);
      res.json(team);
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

  router.delete("/:id/teams/:teamId", async (req, res) =>
  {
    const owned = await requireTournamentExists(res, req.params.id);
    if (!owned) return;
    try
    {
      const result = await deleteTeam(
        req.params.id,
        req.params.teamId,
        owned.teamsAreIndividuals,
      );
      notifyTournamentChanged(req.params.id);
      res.status(200).json(result);
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

  router.patch("/:id/groups/rename", async (req, res) =>
  {
    const owned = await requireTournamentExists(res, req.params.id);
    if (!owned) return;
    const parsed = renameGroupSchema.safeParse(req.body);
    if (!parsed.success)
    {
      res.status(400).json({ error: "Ungültige Gruppennamen" });
      return;
    }
    try
    {
      const detail = await renameGroup(
        req.params.id,
        parsed.data.oldLabel,
        parsed.data.newLabel,
      );
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

  router.post("/:id/teams/:teamId/members", async (req, res) =>
  {
    const parsed = addMemberSchema.safeParse(req.body);
    if (!parsed.success)
    {
      res.status(400).json({ error: "Spieler erforderlich" });
      return;
    }
    const owned = await requireTournamentExists(res, req.params.id);
    if (!owned) return;
    try
    {
      const member = await addMember(
        req.params.id,
        req.params.teamId,
        parsed.data.playerId,
      );
      notifyTournamentChanged(req.params.id);
      res.status(201).json(member);
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

  router.delete("/:id/teams/:teamId/members/:playerId", async (req, res) =>
  {
    const owned = await requireTournamentExists(res, req.params.id);
    if (!owned) return;
    await removeMember(req.params.id, req.params.teamId, req.params.playerId);
    notifyTournamentChanged(req.params.id);
    res.status(204).send();
  });

  router.post("/:id/transfer-kader-from/:sourceTournamentId", async (req, res) =>
  {
    const parsed = transferKaderBodySchema.safeParse(req.body);
    if (!parsed.success)
    {
      res.status(400).json({ error: "Ungültige Eingaben" });
      return;
    }

    const targetOwned = await requireTournamentExists(res, req.params.id);
    if (!targetOwned) return;

    const sourceOwned = await requireTournamentExists(
      res,
      req.params.sourceTournamentId
    );
    if (!sourceOwned) return;

    try
    {
      const result = await transferKader(
        req.params.id,
        req.params.sourceTournamentId,
        parsed.data.overwriteExistingMembers ?? false,
      );
      notifyTournamentChanged(req.params.id);
      notifyTournamentChanged(req.params.sourceTournamentId);
      res.json(result);
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
