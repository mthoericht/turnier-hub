import type { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db.js";
import { computeElapsedMs } from "../../services/matchTimer.js";
import { distributeIntoGroups, generateRoundRobinSchedule } from "../../services/roundRobinSchedule.js";
import { generateKoBracketFirstRound } from "../../services/knockoutBracket.js";
import {
  completeTournamentIfFinalFinished,
  loadTournamentById,
  matchUpdateInclude,
  requireTournamentExists,
  serializeMatch,
  serializeTournamentDetail,
  type MatchWithTeams,
} from "./shared.js";
import { notifyTournamentChanged } from "../../realtime/notify.js";

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
    const t = await loadTournamentById(req.params.id);
    if (!t)
    {
      res.status(404).json({ error: "Turnier nicht gefunden" });
      return;
    }
    const sortedTeams = [...t.teams].sort((a, b) =>
      a.sortOrder !== b.sortOrder
        ? a.sortOrder - b.sortOrder
        : a.name.localeCompare(b.name)
    );
    const teamIds = sortedTeams.map((tm) => tm.id);
    if (teamIds.length < 2)
    {
      res.status(400).json({
        error:
          "Für Gruppenspiele werden mindestens zwei Mannschaften benötigt.",
      });
      return;
    }

    const gc = t.groupCount;
    const groups = gc > 1
      ? distributeIntoGroups(teamIds, gc)
      : [{ label: "A", teamIds }];

    await prisma.$transaction(async (tx) =>
    {
      await tx.match.deleteMany({
        where: { tournamentId: t.id },
      });

      await tx.tournamentTeam.updateMany({
        where: { tournamentId: t.id },
        data: { groupLabel: null },
      });

      for (const group of groups)
      {
        await tx.tournamentTeam.updateMany({
          where: { id: { in: group.teamIds }, tournamentId: t.id },
          data: { groupLabel: gc > 1 ? group.label : null },
        });
      }

      let globalSlot = 0;
      for (const group of groups)
      {
        const schedule = generateRoundRobinSchedule(group.teamIds);
        for (const m of schedule)
        {
          await tx.match.create({
            data: {
              tournamentId: t.id,
              phase: "GROUP",
              groupLabel: gc > 1 ? group.label : null,
              roundOrder: m.round,
              slotIndex: globalSlot++,
              homeTeamId: m.home,
              awayTeamId: m.away,
              status: "SCHEDULED",
            },
          });
        }
      }

      await tx.tournament.update({
        where: { id: t.id },
        data: { phase: "GROUP" },
      });
    });

    const full = await loadTournamentById(t.id);
    notifyTournamentChanged(t.id);
    res.json(serializeTournamentDetail(full!));
  });

  router.post("/:id/generate-knockout", async (req, res) =>
  {
    const owned = await requireTournamentExists(res, req.params.id);
    if (!owned) return;
    const t = await loadTournamentById(req.params.id);
    if (!t)
    {
      res.status(404).json({ error: "Turnier nicht gefunden" });
      return;
    }
    if (t.mode !== "DIRECT_KO")
    {
      res.status(400).json({ error: "K.O.-Generierung nur für Direkt-K.O.-Turniere" });
      return;
    }
    const sortedTeams = [...t.teams].sort((a, b) =>
      a.sortOrder !== b.sortOrder
        ? a.sortOrder - b.sortOrder
        : a.name.localeCompare(b.name)
    );
    if (sortedTeams.length < 2)
    {
      res.status(400).json({ error: "Mindestens 2 Mannschaften für K.O. benötigt" });
      return;
    }

    const { tournamentPhase, matches } = generateKoBracketFirstRound(
      sortedTeams.map((tm) => tm.id)
    );

    await prisma.$transaction(async (tx) =>
    {
      await tx.match.deleteMany({ where: { tournamentId: t.id } });

      for (const m of matches)
      {
        await tx.match.create({
          data: {
            tournamentId: t.id,
            phase: m.phase,
            roundOrder: m.roundOrder,
            slotIndex: m.roundOrder,
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId,
            status: m.awayTeamId === null ? "FINISHED" : "SCHEDULED",
          },
        });
      }

      await tx.tournament.update({
        where: { id: t.id },
        data: { phase: tournamentPhase },
      });
    });

    const full = await loadTournamentById(t.id);
    notifyTournamentChanged(t.id);
    res.json(serializeTournamentDetail(full!));
  });

  router.delete("/:id/matches", async (req, res) =>
  {
    const owned = await requireTournamentExists(res, req.params.id);
    if (!owned) return;
    const t = await loadTournamentById(req.params.id);
    if (!t)
    {
      res.status(404).json({ error: "Turnier nicht gefunden" });
      return;
    }
    await prisma.match.deleteMany({ where: { tournamentId: t.id } });
    await prisma.tournamentTeam.updateMany({
      where: { tournamentId: t.id },
      data: { groupLabel: null },
    });
    await prisma.tournament.update({
      where: { id: t.id },
      data: { phase: "GROUP" },
    });
    const full = await loadTournamentById(t.id);
    notifyTournamentChanged(t.id);
    res.json(serializeTournamentDetail(full!));
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
    const m = await prisma.match.findFirst({
      where: { id: req.params.matchId, tournamentId: req.params.id },
    });
    if (!m)
    {
      res.status(404).json({ error: "Spiel nicht gefunden" });
      return;
    }
    const updated = await prisma.match.update({
      where: { id: m.id },
      data: {
        ...(parsed.data.homeScore !== undefined
          ? { homeScore: parsed.data.homeScore }
          : {}),
        ...(parsed.data.awayScore !== undefined
          ? { awayScore: parsed.data.awayScore }
          : {}),
      },
      include: matchUpdateInclude,
    });
    if (m.phase === "FINAL")
    {
      await completeTournamentIfFinalFinished(req.params.id);
    }
    notifyTournamentChanged(req.params.id);
    res.json(serializeMatch(updated as MatchWithTeams));
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
    const m = await prisma.match.findFirst({
      where: { id: req.params.matchId, tournamentId: req.params.id },
    });
    if (!m)
    {
      res.status(404).json({ error: "Spiel nicht gefunden" });
      return;
    }

    const now = new Date();
    const action = parsed.data.action;

    if (action === "start")
    {
      if (m.status !== "SCHEDULED" && m.status !== "CANCELLED")
      {
        res.status(400).json({ error: "Spiel kann nur von „Geplant“ gestartet werden" });
        return;
      }
      const updated = await prisma.match.update({
        where: { id: m.id },
        data: {
          status: "LIVE",
          matchStartedAt: now,
          totalPausedMs: 0,
          pausedAt: null,
          elapsedSnapshotMs: null,
        },
        include: matchUpdateInclude,
      });
      notifyTournamentChanged(req.params.id);
      res.json(serializeMatch(updated as MatchWithTeams));
      return;
    }

    if (action === "pause")
    {
      if (m.status !== "LIVE")
      {
        res.status(400).json({ error: "Nur laufende Spiele können pausiert werden" });
        return;
      }
      const updated = await prisma.match.update({
        where: { id: m.id },
        data: { status: "PAUSED", pausedAt: now },
        include: matchUpdateInclude,
      });
      notifyTournamentChanged(req.params.id);
      res.json(serializeMatch(updated as MatchWithTeams));
      return;
    }

    if (action === "resume")
    {
      if (m.status !== "PAUSED" || !m.pausedAt)
      {
        res.status(400).json({ error: "Spiel ist nicht pausiert" });
        return;
      }
      const extra = now.getTime() - m.pausedAt.getTime();
      const updated = await prisma.match.update({
        where: { id: m.id },
        data: {
          status: "LIVE",
          totalPausedMs: m.totalPausedMs + extra,
          pausedAt: null,
        },
        include: matchUpdateInclude,
      });
      notifyTournamentChanged(req.params.id);
      res.json(serializeMatch(updated as MatchWithTeams));
      return;
    }

    if (action === "end")
    {
      if (
        m.status !== "LIVE"
        && m.status !== "PAUSED"
        && m.status !== "SCHEDULED"
      )
      {
        res.status(400).json({ error: "Spiel kann so nicht beendet werden" });
        return;
      }
      const snap = computeElapsedMs(m, now);
      const updated = await prisma.match.update({
        where: { id: m.id },
        data: {
          status: "FINISHED",
          elapsedSnapshotMs: snap,
          pausedAt: null,
        },
        include: matchUpdateInclude,
      });
      if (m.phase === "FINAL")
      {
        await completeTournamentIfFinalFinished(req.params.id);
      }
      notifyTournamentChanged(req.params.id);
      res.json(serializeMatch(updated as MatchWithTeams));
      return;
    }

    if (action === "cancel")
    {
      const snap =
        m.matchStartedAt && (m.status === "LIVE" || m.status === "PAUSED")
          ? computeElapsedMs(m, now)
          : 0;
      const updated = await prisma.match.update({
        where: { id: m.id },
        data: {
          status: "CANCELLED",
          elapsedSnapshotMs: snap,
          pausedAt: null,
        },
        include: matchUpdateInclude,
      });
      notifyTournamentChanged(req.params.id);
      res.json(serializeMatch(updated as MatchWithTeams));
      return;
    }

    res.status(400).json({ error: "Unbekannte Aktion" });
  });
}
