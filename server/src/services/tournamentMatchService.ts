import type { TournamentDetail, MatchRow } from "@turnier-hub/shared";
import { prisma } from "../db.js";
import { computeElapsedMs } from "./matchTimer.js";
import { distributeIntoGroups, generateRoundRobinSchedule } from "./roundRobinSchedule.js";
import { generateKoBracketFirstRound } from "./knockoutBracket.js";
import {
  completeTournamentIfFinalFinished,
  loadTournamentById,
  matchUpdateInclude,
  serializeMatch,
  serializeTournamentDetail,
  type MatchWithTeams,
} from "../routes/tournaments/shared.js";
import { ServiceError } from "./ServiceError.js";

export async function generateGroupMatches(
  tournamentId: string,
): Promise<TournamentDetail>
{
  const t = await loadTournamentById(tournamentId);
  if (!t)
  {
    throw new ServiceError("Turnier nicht gefunden", 404);
  }
  const sortedTeams = [...t.teams].sort((a, b) =>
    a.sortOrder !== b.sortOrder
      ? a.sortOrder - b.sortOrder
      : a.name.localeCompare(b.name)
  );
  const teamIds = sortedTeams.map((tm) => tm.id);
  if (teamIds.length < 2)
  {
    throw new ServiceError(
      "Für Gruppenspiele werden mindestens zwei Mannschaften benötigt.",
    );
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
  return serializeTournamentDetail(full!);
}

export async function generateKnockoutMatches(
  tournamentId: string,
): Promise<TournamentDetail>
{
  const t = await loadTournamentById(tournamentId);
  if (!t)
  {
    throw new ServiceError("Turnier nicht gefunden", 404);
  }
  if (t.mode !== "DIRECT_KO")
  {
    throw new ServiceError("K.O.-Generierung nur für Direkt-K.O.-Turniere");
  }
  const sortedTeams = [...t.teams].sort((a, b) =>
    a.sortOrder !== b.sortOrder
      ? a.sortOrder - b.sortOrder
      : a.name.localeCompare(b.name)
  );
  if (sortedTeams.length < 2)
  {
    throw new ServiceError("Mindestens 2 Mannschaften für K.O. benötigt");
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
  return serializeTournamentDetail(full!);
}

export async function deleteAllMatches(
  tournamentId: string,
): Promise<TournamentDetail>
{
  const t = await loadTournamentById(tournamentId);
  if (!t)
  {
    throw new ServiceError("Turnier nicht gefunden", 404);
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
  return serializeTournamentDetail(full!);
}

export async function patchMatchScores(
  tournamentId: string,
  matchId: string,
  scores: { homeScore?: number; awayScore?: number },
): Promise<MatchRow>
{
  const m = await prisma.match.findFirst({
    where: { id: matchId, tournamentId },
  });
  if (!m)
  {
    throw new ServiceError("Spiel nicht gefunden", 404);
  }
  const updated = await prisma.match.update({
    where: { id: m.id },
    data: {
      ...(scores.homeScore !== undefined
        ? { homeScore: scores.homeScore }
        : {}),
      ...(scores.awayScore !== undefined
        ? { awayScore: scores.awayScore }
        : {}),
    },
    include: matchUpdateInclude,
  });
  if (m.phase === "FINAL")
  {
    await completeTournamentIfFinalFinished(tournamentId);
  }
  return serializeMatch(updated as MatchWithTeams);
}

export async function handleTimerAction(
  tournamentId: string,
  matchId: string,
  action: "start" | "pause" | "resume" | "end" | "cancel",
): Promise<MatchRow>
{
  const m = await prisma.match.findFirst({
    where: { id: matchId, tournamentId },
  });
  if (!m)
  {
    throw new ServiceError("Spiel nicht gefunden", 404);
  }

  const now = new Date();

  if (action === "start")
  {
    if (m.status !== "SCHEDULED" && m.status !== "CANCELLED")
    {
      throw new ServiceError("Spiel kann nur von \u201EGeplant\u201C gestartet werden");
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
    return serializeMatch(updated as MatchWithTeams);
  }

  if (action === "pause")
  {
    if (m.status !== "LIVE")
    {
      throw new ServiceError("Nur laufende Spiele können pausiert werden");
    }
    const updated = await prisma.match.update({
      where: { id: m.id },
      data: { status: "PAUSED", pausedAt: now },
      include: matchUpdateInclude,
    });
    return serializeMatch(updated as MatchWithTeams);
  }

  if (action === "resume")
  {
    if (m.status !== "PAUSED" || !m.pausedAt)
    {
      throw new ServiceError("Spiel ist nicht pausiert");
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
    return serializeMatch(updated as MatchWithTeams);
  }

  if (action === "end")
  {
    if (
      m.status !== "LIVE"
      && m.status !== "PAUSED"
      && m.status !== "SCHEDULED"
    )
    {
      throw new ServiceError("Spiel kann so nicht beendet werden");
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
      await completeTournamentIfFinalFinished(tournamentId);
    }
    return serializeMatch(updated as MatchWithTeams);
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
    return serializeMatch(updated as MatchWithTeams);
  }

  throw new ServiceError("Unbekannte Aktion");
}
