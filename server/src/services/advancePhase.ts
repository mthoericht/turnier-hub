import {
  MatchPhase,
  MatchStatus,
  type Match,
  type PrismaClient,
  type Tournament,
  TournamentPhase,
} from "@prisma/client";
import {
  computePoolStandings,
  requireKnockoutWinnerTeamId,
} from "./standings.js";
import {
  collectKoRoundWinners,
  interleavedPairings,
  randomizeTeamIds,
  tournamentPhaseForMatchPhase,
} from "./knockoutBracket.js";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export type AdvanceTeamRow = {
  id: string;
  name: string;
  sortOrder: number;
  groupLabel: string | null;
};

type QualifierSelectionResult = {
  teamIds: string[];
  notices: string[];
};

/**
 * Builds a stable 32-bit hash from a string input.
 */
function seedFromString(input: string): number
{
  let h = 2166136261;
  for (let i = 0; i < input.length; i++)
  {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Creates a deterministic pseudo-random number generator in range [0, 1).
 */
function mulberry32(seed: number): () => number
{
  let t = seed >>> 0;
  return () =>
  {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns the knockout match phase that fits a participant count.
 */
function koPhaseFromCount(count: number): MatchPhase
{
  if (count <= 2) return MatchPhase.FINAL;
  if (count <= 4) return MatchPhase.SEMI;
  if (count <= 8) return MatchPhase.QUARTER;
  return MatchPhase.ROUND_OF_16;
}

/**
 * Selects qualifiers from group standings and returns optional tie-break notices.
 *
 * For multi-group tournaments, selection is performed per group using the
 * configured `advancesPerGroup`. For a single group, selection is performed
 * from the global group table.
 */
function collectGroupQualifiers(
  tournamentId: string,
  teams: AdvanceTeamRow[],
  matches: Match[],
  groupCount: number,
  advancesPerGroup: number
): QualifierSelectionResult
{
  const teamsById = new Map(
    teams.map((t) => [t.id, { id: t.id, name: t.name }] as const)
  );
  const groupMatches = matches.filter((m) => m.phase === MatchPhase.GROUP);

  if (groupCount > 1)
  {
    const labels = [...new Set(teams.map((t) => t.groupLabel).filter(Boolean))] as string[];
    labels.sort();
    const allQualifiers: string[] = [];
    const notices: string[] = [];
    for (const label of labels)
    {
      const gTeamIds = teams
        .filter((t) => t.groupLabel === label)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .map((t) => t.id);
      const gMatches = groupMatches.filter((m) => m.groupLabel === label);
      const table = computePoolStandings(gTeamIds, teamsById, gMatches);
      const picked = pickQualifiersWithRandomPointsTie(
        tournamentId,
        table,
        advancesPerGroup,
        `Gruppe ${label}`
      );
      allQualifiers.push(...picked.teamIds);
      notices.push(...picked.notices);
    }
    return { teamIds: allQualifiers, notices };
  }

  const teamsSorted = [...teams].sort((a, b) =>
    a.sortOrder !== b.sortOrder
      ? a.sortOrder - b.sortOrder
      : a.name.localeCompare(b.name)
  );
  const table = computePoolStandings(
    teamsSorted.map((t) => t.id),
    teamsById,
    groupMatches
  );
  return pickQualifiersWithRandomPointsTie(
    tournamentId,
    table,
    Math.min(teamsSorted.length, advancesPerGroup),
    "Gruppenspiele"
  );
}

/**
 * Selects the first `limit` teams from a standings table.
 *
 * If the cutoff position is tied on points across multiple teams, deterministic
 * pseudo-random selection is used for the remaining slots and a notice is emitted.
 */
export function pickQualifiersWithRandomPointsTie(
  tournamentId: string,
  table: ReturnType<typeof computePoolStandings>,
  limit: number,
  label: string
): QualifierSelectionResult
{
  if (limit <= 0 || table.length === 0)
  {
    return { teamIds: [], notices: [] };
  }
  if (limit >= table.length)
  {
    return { teamIds: table.map((r) => r.teamId), notices: [] };
  }

  const boundaryPoints = table[limit - 1]!.points;
  const firstTieIdx = table.findIndex((r) => r.points === boundaryPoints);
  const tieRows: typeof table = [];
  for (const row of table)
  {
    if (row.points === boundaryPoints) tieRows.push(row);
  }
  const fixedBefore = table.slice(0, firstTieIdx);
  const slotsFromTie = limit - fixedBefore.length;

  if (slotsFromTie <= 0 || slotsFromTie >= tieRows.length)
  {
    return { teamIds: table.slice(0, limit).map((r) => r.teamId), notices: [] };
  }

  const shuffled = [...tieRows];
  const rand = mulberry32(
    seedFromString(`${tournamentId}|${label}|${boundaryPoints}|${limit}|${tieRows.length}`)
  );
  for (let i = shuffled.length - 1; i > 0; i--)
  {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const chosen = shuffled.slice(0, slotsFromTie);
  const chosenNames = chosen.map((r) => r.team.name).sort((a, b) => a.localeCompare(b));
  const notice =
    `${label}: Mehrere Teams hatten gleich viele Punkte auf dem Qualifikationsplatz. `
    + `Die Auswahl für die K.-o.-Phase wurde per Zufallsprinzip getroffen `
    + `(${chosenNames.join(", ")}).`;

  return {
    teamIds: [...fixedBefore, ...chosen].map((r) => r.teamId),
    notices: [notice],
  };
}

/**
 * Persists knockout matches for a specific phase and ordered pairings.
 */
async function createKoRoundMatches(
  tx: Tx,
  tournamentId: string,
  phase: MatchPhase,
  pairs: [string, string][]
): Promise<void>
{
  let order = 0;
  for (const [home, away] of pairs)
  {
    await tx.match.create({
      data: {
        tournamentId,
        phase,
        roundOrder: order++,
        homeTeamId: home,
        awayTeamId: away,
        status: MatchStatus.SCHEDULED,
      },
    });
  }
}

const KO_PHASES_ORDER: MatchPhase[] = [
  MatchPhase.ROUND_OF_16,
  MatchPhase.QUARTER,
  MatchPhase.SEMI,
  MatchPhase.FINAL,
];

/**
 * Returns all knockout phases at or after a target phase.
 */
function phasesAtOrAfter(target: MatchPhase): MatchPhase[]
{
  const idx = KO_PHASES_ORDER.indexOf(target);
  return idx >= 0 ? KO_PHASES_ORDER.slice(idx) : [];
}

/**
 * Collects winners from the previous knockout phase.
 *
 * Bye matches auto-advance the home team. Non-bye matches must be finished
 * and provide a persisted winner.
 */
function collectWinnersFromPreviousPhase(
  prevKoMatches: Match[],
  prevKoPhase: MatchPhase
): string[]
{
  const winners: string[] = [];
  for (const m of prevKoMatches)
  {
    if (m.awayTeamId === null && m.homeTeamId)
    {
      winners.push(m.homeTeamId);
      continue;
    }
    if (m.status !== MatchStatus.FINISHED)
    {
      throw new Error(
        `Alle ${formatPhaseName(prevKoPhase)}-Spiele müssen beendet sein`
      );
    }
    winners.push(
      requireKnockoutWinnerTeamId(
        m,
        `${formatPhaseName(prevKoPhase)} (Spiel ${m.roundOrder + 1})`
      )
    );
  }
  return winners;
}

/**
 * Returns the participant count required for a requested knockout phase.
 */
function requiredQualifierCount(targetMatchPhase: MatchPhase): number
{
  return targetMatchPhase === MatchPhase.ROUND_OF_16 ? 16
    : targetMatchPhase === MatchPhase.QUARTER ? 8
      : targetMatchPhase === MatchPhase.SEMI ? 4
        : 2;
}

/**
 * Deletes target and later knockout rounds, recreates the target phase
 * with provided pairings, and updates the tournament phase.
 */
async function rebuildKnockoutFromPairs(
  prisma: PrismaClient,
  tournament: Tournament & {
    teams: AdvanceTeamRow[];
    matches: Match[];
    groupCount: number;
  },
  targetMatchPhase: MatchPhase,
  targetTournamentPhase: TournamentPhase,
  pairs: [string, string][]
): Promise<void>
{
  await prisma.$transaction(async (tx: Tx) =>
  {
    await tx.match.deleteMany({
      where: {
        tournamentId: tournament.id,
        phase: { in: phasesAtOrAfter(targetMatchPhase) },
      },
    });
    if (tournament.phase === TournamentPhase.GROUP)
    {
      const extraPhases = KO_PHASES_ORDER.filter(
        (p) => KO_PHASES_ORDER.indexOf(p) < KO_PHASES_ORDER.indexOf(targetMatchPhase)
      );
      if (extraPhases.length > 0)
      {
        await tx.match.deleteMany({
          where: { tournamentId: tournament.id, phase: { in: extraPhases } },
        });
      }
    }
    await createKoRoundMatches(tx, tournament.id, targetMatchPhase, pairs);
    await tx.tournament.update({
      where: { id: tournament.id },
      data: { phase: targetTournamentPhase },
    });
  });
}

/**
 * Advances or (re)builds a knockout phase and returns informational notices.
 *
 * If a previous knockout round exists, winners from that round are used.
 * Otherwise, qualifiers are derived from group standings.
 */
export async function advanceTournamentPhase(
  prisma: PrismaClient,
  tournament: Tournament & {
    teams: AdvanceTeamRow[];
    matches: Match[];
    groupCount: number;
  },
  target: "ROUND_OF_16" | "QUARTER" | "SEMI" | "FINAL"
): Promise<{ notices: string[] }>
{
  const targetMatchPhase = MatchPhase[target];
  const targetTournamentPhase = tournamentPhaseForMatchPhase(targetMatchPhase);

  const prevKoPhaseIdx = KO_PHASES_ORDER.indexOf(targetMatchPhase) - 1;
  const prevKoPhase = prevKoPhaseIdx >= 0 ? KO_PHASES_ORDER[prevKoPhaseIdx] : null;

  const prevKoMatches = prevKoPhase
    ? tournament.matches
      .filter((m) => m.phase === prevKoPhase)
      .sort((a, b) => a.roundOrder - b.roundOrder)
    : null;

  if (prevKoMatches && prevKoMatches.length > 0)
  {
    const winners = collectWinnersFromPreviousPhase(prevKoMatches, prevKoPhase!);
    const pairs = interleavedPairings(winners);
    await rebuildKnockoutFromPairs(
      prisma,
      tournament,
      targetMatchPhase,
      targetTournamentPhase,
      pairs
    );
    return { notices: [] };
  }

  const qualifierResult = collectGroupQualifiers(
    tournament.id,
    tournament.teams,
    tournament.matches,
    tournament.groupCount,
    tournament.advancesPerGroup
  );

  const qualNeeded = requiredQualifierCount(targetMatchPhase);

  const effectiveQualifiers = qualifierResult.teamIds.slice(0, qualNeeded);

  if (effectiveQualifiers.length < 2)
  {
    throw new Error(
      `Für ${formatPhaseName(targetMatchPhase)} werden mindestens 2 qualifizierte Mannschaften benötigt (aktuell: ${effectiveQualifiers.length}).`
    );
  }

  const randomQualifiers = randomizeTeamIds(effectiveQualifiers);
  const pairs = interleavedPairings(randomQualifiers);

  await rebuildKnockoutFromPairs(
    prisma,
    tournament,
    targetMatchPhase,
    targetTournamentPhase,
    pairs
  );
  return { notices: qualifierResult.notices };
}

/**
 * Formats a knockout/group phase identifier into a German UI label.
 */
function formatPhaseName(phase: MatchPhase): string
{
  const names: Record<string, string> = {
    ROUND_OF_16: "Achtelfinale",
    QUARTER: "Viertelfinale",
    SEMI: "Halbfinale",
    FINAL: "Finale",
    GROUP: "Gruppenspiele",
  };
  return names[phase] ?? phase;
}
