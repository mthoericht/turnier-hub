import { MatchPhase, TournamentPhase } from "@prisma/client";

export type KoBracketMatch = {
  phase: MatchPhase;
  roundOrder: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
};

function shuffledTeamIds(teamIds: string[]): string[]
{
  const arr = [...teamIds];
  for (let i = arr.length - 1; i > 0; i--)
  {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Returns a shuffled copy using Fisher-Yates.
 */
export function randomizeTeamIds(teamIds: string[]): string[]
{
  return shuffledTeamIds(teamIds);
}

/**
 * Produces knockout pairings by matching top-vs-bottom in ordered team ids.
 */
export function interleavedPairings(ordered: string[]): [string, string][]
{
  const pairs: [string, string][] = [];
  const half = ordered.length / 2;
  for (let i = 0; i < half; i++)
  {
    pairs.push([ordered[i]!, ordered[ordered.length - 1 - i]!]);
  }
  return pairs;
}

/**
 * Returns the next power of two greater than or equal to `n`.
 */
function nextPowerOf2(n: number): number
{
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Resolves the knockout match phase for a bracket size.
 */
export function koPhaseForBracketSize(size: number): MatchPhase
{
  if (size <= 1) return MatchPhase.FINAL;
  if (size <= 2) return MatchPhase.FINAL;
  if (size <= 4) return MatchPhase.SEMI;
  if (size <= 8) return MatchPhase.QUARTER;
  return MatchPhase.ROUND_OF_16;
}

/**
 * Maps a match phase to the corresponding tournament phase.
 */
export function tournamentPhaseForMatchPhase(mp: MatchPhase): TournamentPhase
{
  switch (mp)
  {
    case MatchPhase.ROUND_OF_16: return TournamentPhase.ROUND_OF_16;
    case MatchPhase.QUARTER: return TournamentPhase.QUARTER;
    case MatchPhase.SEMI: return TournamentPhase.SEMI;
    case MatchPhase.FINAL: return TournamentPhase.FINAL;
    default: return TournamentPhase.GROUP;
  }
}

/**
 * Generates first-round knockout pairings from seeded team ids.
 *
 * Top seeds may receive byes (represented as `awayTeamId = null`).
 */
export function generateKoBracketFirstRound(
  seededTeamIds: string[]
): { phase: MatchPhase; tournamentPhase: TournamentPhase; matches: KoBracketMatch[] }
{
  const randomizedTeamIds = shuffledTeamIds(seededTeamIds);
  const n = randomizedTeamIds.length;
  if (n < 2) throw new Error("Mindestens 2 Mannschaften für K.O. benötigt");

  const bracketSize = nextPowerOf2(n);
  const halfBracket = bracketSize / 2;
  const byes = bracketSize - n;
  const phase = koPhaseForBracketSize(bracketSize);
  const tournamentPhase = tournamentPhaseForMatchPhase(phase);

  const slots: (string | null)[] = new Array(bracketSize).fill(null);
  for (let i = 0; i < n; i++)
  {
    slots[i] = randomizedTeamIds[i]!;
  }

  const matches: KoBracketMatch[] = [];
  for (let i = 0; i < halfBracket; i++)
  {
    const home = slots[i];
    const away = slots[bracketSize - 1 - i];

    if (home && away)
    {
      matches.push({ phase, roundOrder: i, homeTeamId: home, awayTeamId: away });
    }
    else if (home && !away)
    {
      matches.push({ phase, roundOrder: i, homeTeamId: home, awayTeamId: null });
    }
  }

  return { phase, tournamentPhase, matches };
}

/**
 * Collects ordered winners from a knockout round, including bye wins.
 */
export function collectKoRoundWinners(
  matches: { homeTeamId: string | null; awayTeamId: string | null; homeScore: number | null; awayScore: number | null }[]
): string[]
{
  const winners: string[] = [];
  for (const m of matches)
  {
    if (m.awayTeamId === null && m.homeTeamId)
    {
      winners.push(m.homeTeamId);
      continue;
    }
    if (m.homeTeamId === null && m.awayTeamId)
    {
      winners.push(m.awayTeamId);
      continue;
    }
    if (m.homeScore != null && m.awayScore != null && m.homeTeamId && m.awayTeamId)
    {
      winners.push(m.homeScore >= m.awayScore ? m.homeTeamId : m.awayTeamId);
    }
  }
  return winners;
}
