import type { Response } from "express";
import type { MatchPhase, MatchStatus, TournamentPhase, Match } from "@prisma/client";
import { prisma } from "../../db.js";
import {
  createdBySelect,
  playerApiInclude,
  playerToApi,
  toCreatedBy,
} from "../../lib/createdBy.js";
import { computeElapsedMs } from "../../services/matchTimer.js";

const phaseOrder: Record<MatchPhase, number> = {
  GROUP: 0,
  ROUND_OF_16: 1,
  QUARTER: 2,
  SEMI: 3,
  FINAL: 4,
};

export function sortMatches<T extends { phase: MatchPhase; roundOrder: number; slotIndex: number }>(
  matches: T[]
): T[]
{
  return [...matches].sort((a, b) =>
  {
    const po = phaseOrder[a.phase] - phaseOrder[b.phase];
    if (po !== 0) return po;
    if (a.roundOrder !== b.roundOrder) return a.roundOrder - b.roundOrder;
    return a.slotIndex - b.slotIndex;
  });
}

export type MatchWithTeams = Match & {
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
};

export const matchUpdateInclude = {
  homeTeam: { select: { id: true, name: true } },
  awayTeam: { select: { id: true, name: true } },
} as const;

export function serializeMatch(m: MatchWithTeams)
{
  const now = new Date();
  const { homeTeam, awayTeam, ...rest } = m;
  return {
    ...rest,
    homeTeam: homeTeam ?? null,
    awayTeam: awayTeam ?? null,
    elapsedMs: computeElapsedMs(m, now),
  };
}

export async function loadTournamentById(id: string)
{
  return prisma.tournament.findFirst({
    where: { id },
    include: {
      user: { select: createdBySelect },
      teams: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          members: {
            include: {
              player: { include: playerApiInclude },
            },
          },
        },
      },
      matches: {
        include: {
          homeTeam: { select: { id: true, name: true } },
          awayTeam: { select: { id: true, name: true } },
        },
        orderBy: [{ roundOrder: "asc" }, { slotIndex: "asc" }],
      },
    },
  });
}

export function serializeTournamentDetail(
  t: NonNullable<Awaited<ReturnType<typeof loadTournamentById>>>
)
{
  const { user, matches, teams, ...rest } = t;
  return {
    ...rest,
    createdBy: toCreatedBy(user),
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      sortOrder: team.sortOrder,
      groupLabel: team.groupLabel ?? null,
      members: team.members.map((m) => ({
        id: m.id,
        tournamentId: m.tournamentId,
        teamId: m.teamId,
        playerId: m.playerId,
        player: playerToApi(m.player),
      })),
    })),
    matches: sortMatches(matches).map((m) =>
      serializeMatch(m as MatchWithTeams)
    ),
  };
}

export async function completeTournamentIfFinalFinished(tournamentId: string): Promise<void>
{
  const finalCount = await prisma.match.count({
    where: { tournamentId, phase: "FINAL" },
  });
  if (finalCount === 0) return;

  const unfinishedFinals = await prisma.match.count({
    where: {
      tournamentId,
      phase: "FINAL",
      status: { not: "FINISHED" },
    },
  });
  if (unfinishedFinals > 0) return;

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { phase: "COMPLETED" },
  });
}

export async function requireTournamentOwner(
  res: Response,
  tournamentId: string,
  userId: string
)
{
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t)
  {
    res.status(404).json({ error: "Turnier nicht gefunden" });
    return null;
  }
  if (t.userId !== userId)
  {
    res.status(403).json({ error: "Nur der Ersteller darf das bearbeiten." });
    return null;
  }
  return t;
}
