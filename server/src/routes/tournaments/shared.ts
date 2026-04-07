import type { Response } from "express";
import type { MatchPhase, MatchStatus, TournamentPhase, Match } from "@prisma/client";
import type { MatchRow, TournamentDetail } from "@turnier-hub/shared";
import { prisma } from "../../db.js";
import {
  createdBySelect,
  playerApiInclude,
  playerToApi,
  toCreatedBy,
} from "../../lib/createdBy.js";
import { computeElapsedMs } from "../../services/matchTimer.js";

/** Stable sort order used to present matches in UI/API responses. */
const phaseOrder: Record<MatchPhase, number> = {
  GROUP: 0,
  ROUND_OF_16: 1,
  QUARTER: 2,
  SEMI: 3,
  FINAL: 4,
};

/** Sorts matches by phase, then round order, then slot index. */
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

/** Include object for match updates that need team name/id on both sides. */
export const matchUpdateInclude = {
  homeTeam: { select: { id: true, name: true } },
  awayTeam: { select: { id: true, name: true } },
} as const;

function dateToIso(d: Date | null): string | null
{
  return d ? d.toISOString() : null;
}

/** Serializes a Prisma match row to shared API shape with computed elapsed time. */
export function serializeMatch(m: MatchWithTeams): MatchRow
{
  const now = new Date();
  const { homeTeam, awayTeam, matchStartedAt, pausedAt, ...rest } = m;
  return {
    ...rest,
    matchStartedAt: dateToIso(matchStartedAt),
    pausedAt: dateToIso(pausedAt),
    homeTeam: homeTeam ?? null,
    awayTeam: awayTeam ?? null,
    elapsedMs: computeElapsedMs(m, now),
  };
}

/** Loads one tournament with all nested data required for detail responses. */
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

/** Serializes a loaded tournament row to the shared tournament detail DTO. */
export function serializeTournamentDetail(
  t: NonNullable<Awaited<ReturnType<typeof loadTournamentById>>>
): TournamentDetail
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

/** Marks a tournament as completed once all final matches are finished. */
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

/** Any authenticated user may mutate tournaments; `userId` on the row is the original creator (display only). */
export async function requireTournamentExists(
  res: Response,
  tournamentId: string
)
{
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t)
  {
    res.status(404).json({ error: "Turnier nicht gefunden" });
    return null;
  }
  return t;
}
