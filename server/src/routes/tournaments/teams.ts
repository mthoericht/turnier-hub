import type { Router } from "express";
import type { MatchPhase } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db.js";
import { playerApiInclude, playerToApi } from "../../lib/createdBy.js";
import {
  loadTournamentById,
  requireTournamentExists,
  serializeTournamentDetail,
} from "./shared.js";
import { notifyTournamentChanged } from "../../realtime/notify.js";

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
    const name = parsed.data.name.trim();
    const maxRow = await prisma.tournamentTeam.aggregate({
      where: { tournamentId: req.params.id },
      _max: { sortOrder: true },
    });
    const sortOrder =
      parsed.data.sortOrder ?? (maxRow._max.sortOrder ?? -1) + 1;
    try
    {
      const team = await prisma.tournamentTeam.create({
        data: {
          tournamentId: req.params.id,
          name,
          sortOrder,
        },
      });
      notifyTournamentChanged(req.params.id);
      res.status(201).json({
        id: team.id,
        name: team.name,
        sortOrder: team.sortOrder,
      });
    }
    catch
    {
      res.status(409).json({ error: "Mannschaftsname im Turnier schon vergeben" });
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
    const existing = await prisma.tournamentTeam.findFirst({
      where: { id: req.params.teamId, tournamentId: req.params.id },
    });
    if (!existing)
    {
      res.status(404).json({ error: "Mannschaft nicht gefunden" });
      return;
    }
    try
    {
      const team = await prisma.tournamentTeam.update({
        where: { id: req.params.teamId },
        data: {
          ...(parsed.data.name != null ? { name: parsed.data.name.trim() } : {}),
          ...(parsed.data.sortOrder !== undefined
            ? { sortOrder: parsed.data.sortOrder }
            : {}),
        },
      });
      notifyTournamentChanged(req.params.id);
      res.json({
        id: team.id,
        name: team.name,
        sortOrder: team.sortOrder,
      });
    }
    catch
    {
      res.status(409).json({ error: "Mannschaftsname im Turnier schon vergeben" });
    }
  });

  router.delete("/:id/teams/:teamId", async (req, res) =>
  {
    const owned = await requireTournamentExists(res, req.params.id);
    if (!owned) return;
    const existing = await prisma.tournamentTeam.findFirst({
      where: { id: req.params.teamId, tournamentId: req.params.id },
    });
    if (!existing)
    {
      res.status(404).json({ error: "Mannschaft nicht gefunden" });
      return;
    }
    const [memCount, teamMatches] = await Promise.all([
      prisma.tournamentTeamMember.count({ where: { teamId: req.params.teamId } }),
      prisma.match.findMany({
        where: {
          tournamentId: req.params.id,
          OR: [
            { homeTeamId: req.params.teamId },
            { awayTeamId: req.params.teamId },
          ],
        },
        select: { id: true, status: true, phase: true },
      }),
    ]);
    const removableGroupMatchIds = teamMatches
      .filter((m) => m.phase === "GROUP")
      .map((m) => m.id);
    const blockingMatchCount = teamMatches.length - removableGroupMatchIds.length;

    if (blockingMatchCount > 0)
    {
      res.status(400).json({
        error:
          "Mannschaft ist noch in K.-o.-Spielen enthalten. "
          + "Bitte diese Spiele zuerst löschen oder zurücksetzen.",
      });
      return;
    }

    if (memCount > 0)
    {
      if (!owned.teamsAreIndividuals)
      {
        res.status(400).json({
          error:
            "Mannschaft ist noch belegt (Kader). Entferne zuerst Spieler aus der Mannschaft.",
        });
        return;
      }
      await prisma.tournamentTeamMember.deleteMany({
        where: { tournamentId: req.params.id, teamId: req.params.teamId },
      });
    }

    if (removableGroupMatchIds.length > 0)
    {
      await prisma.match.deleteMany({
        where: { id: { in: removableGroupMatchIds } },
      });
    }

    try
    {
      await prisma.tournamentTeam.delete({ where: { id: req.params.teamId } });
    }
    catch
    {
      res.status(400).json({
        error:
          "Mannschaft konnte nicht gelöscht werden. Bitte prüfe vorhandene Zuordnungen.",
      });
      return;
    }
    notifyTournamentChanged(req.params.id);
    res.status(200).json({
      deletedTeamId: req.params.teamId,
      removedGroupMatches: removableGroupMatchIds.length,
    });
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
    const oldLabel = parsed.data.oldLabel;
    const newLabel = parsed.data.newLabel;
    if (oldLabel === newLabel)
    {
      const full = await loadTournamentById(req.params.id);
      notifyTournamentChanged(req.params.id);
      res.json(serializeTournamentDetail(full!));
      return;
    }
    const existingNew = await prisma.tournamentTeam.count({
      where: {
        tournamentId: req.params.id,
        groupLabel: newLabel,
      },
    });
    if (existingNew > 0)
    {
      res.status(409).json({ error: "Gruppenname bereits vorhanden" });
      return;
    }
    await prisma.$transaction([
      prisma.tournamentTeam.updateMany({
        where: { tournamentId: req.params.id, groupLabel: oldLabel },
        data: { groupLabel: newLabel },
      }),
      prisma.match.updateMany({
          where: { tournamentId: req.params.id, phase: "GROUP", groupLabel: oldLabel },
        data: { groupLabel: newLabel },
      }),
    ]);
    const full = await loadTournamentById(req.params.id);
    notifyTournamentChanged(req.params.id);
    res.json(serializeTournamentDetail(full!));
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
    const team = await prisma.tournamentTeam.findFirst({
      where: { id: req.params.teamId, tournamentId: req.params.id },
    });
    if (!team)
    {
      res.status(404).json({ error: "Mannschaft nicht gefunden" });
      return;
    }
    const player = await prisma.player.findFirst({
      where: { id: parsed.data.playerId },
      include: playerApiInclude,
    });
    if (!player)
    {
      res.status(404).json({ error: "Spieler nicht gefunden" });
      return;
    }
    try
    {
      const row = await prisma.tournamentTeamMember.create({
        data: {
          tournamentId: req.params.id,
          teamId: req.params.teamId,
          playerId: parsed.data.playerId,
        },
        include: {
          player: { include: playerApiInclude },
        },
      });
      notifyTournamentChanged(req.params.id);
      res.status(201).json({
        id: row.id,
        tournamentId: row.tournamentId,
        teamId: row.teamId,
        playerId: row.playerId,
        player: playerToApi(row.player),
      });
    }
    catch
    {
      res.status(409).json({
        error: "Spieler ist bereits einem Kader in diesem Turnier zugeordnet",
      });
    }
  });

  router.delete("/:id/teams/:teamId/members/:playerId", async (req, res) =>
  {
    const owned = await requireTournamentExists(res, req.params.id);
    if (!owned) return;
    await prisma.tournamentTeamMember.deleteMany({
      where: {
        tournamentId: req.params.id,
        teamId: req.params.teamId,
        playerId: req.params.playerId,
      },
    });
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

    const overwriteExistingMembers =
      parsed.data.overwriteExistingMembers ?? false;

    const sourceTournament = await prisma.tournament.findUnique({
      where: { id: req.params.sourceTournamentId },
      include: {
        teams: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            members: {
              select: { playerId: true },
            },
          },
        },
      },
    });

    if (!sourceTournament)
    {
      res.status(404).json({ error: "Quell-Turnier nicht gefunden" });
      return;
    }

    if (overwriteExistingMembers)
    {
      await prisma.tournamentTeamMember.deleteMany({
        where: { tournamentId: req.params.id },
      });
    }

    let createdTeams = 0;
    let addedMembers = 0;

    for (const sTeam of sourceTournament.teams)
    {
      let tTeam = await prisma.tournamentTeam.findFirst({
        where: { tournamentId: req.params.id, name: sTeam.name },
      });

      if (!tTeam)
      {
        tTeam = await prisma.tournamentTeam.create({
          data: {
            tournamentId: req.params.id,
            name: sTeam.name,
            sortOrder: sTeam.sortOrder,
          },
        });
        createdTeams++;
      }

      for (const m of sTeam.members)
      {
        try
        {
          await prisma.tournamentTeamMember.create({
            data: {
              tournamentId: req.params.id,
              teamId: tTeam!.id,
              playerId: m.playerId,
            },
          });
          addedMembers++;
        }
        catch
        {
          // Eindeutigkeit pro Turnier/Spieler: bereits zugeordnet -> überspringen.
        }
      }
    }

    notifyTournamentChanged(req.params.id);
    notifyTournamentChanged(req.params.sourceTournamentId);
    res.json({ createdTeams, addedMembers });
  });
}
