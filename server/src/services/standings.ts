import type { Match } from "@prisma/client";
import { MatchPhase, MatchStatus } from "@prisma/client";

export type TeamRef = { id: string; name: string };

export type TeamStandingRow = {
  teamId: string;
  team: TeamRef;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

function isMatchDecided(m: Match): boolean {
  if (m.status === MatchStatus.CANCELLED) return false;
  return m.homeScore != null && m.awayScore != null;
}

export function computePoolStandings(
  teamIds: string[],
  teamsById: Map<string, TeamRef>,
  groupMatches: Match[]
): TeamStandingRow[] {
  const idSet = new Set(teamIds);
  const stats = new Map<
    string,
    Omit<TeamStandingRow, "team" | "teamId"> & { teamId: string }
  >();

  for (const tid of teamIds) {
    stats.set(tid, {
      teamId: tid,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    });
  }

  for (const m of groupMatches) {
    if (m.phase !== MatchPhase.GROUP) continue;
    if (!m.homeTeamId || !m.awayTeamId) continue;
    if (!idSet.has(m.homeTeamId) || !idSet.has(m.awayTeamId)) continue;
    if (!isMatchDecided(m)) continue;

    const hs = m.homeScore ?? 0;
    const as = m.awayScore ?? 0;
    const h = stats.get(m.homeTeamId);
    const a = stats.get(m.awayTeamId);
    if (!h || !a) continue;

    h.played += 1;
    a.played += 1;
    h.goalsFor += hs;
    h.goalsAgainst += as;
    a.goalsFor += as;
    a.goalsAgainst += hs;

    if (hs > as) {
      h.wins += 1;
      h.points += 3;
      a.losses += 1;
    } else if (as > hs) {
      a.wins += 1;
      a.points += 3;
      h.losses += 1;
    } else {
      h.draws += 1;
      a.draws += 1;
      h.points += 1;
      a.points += 1;
    }
  }

  const rows: TeamStandingRow[] = teamIds.map((tid) => {
    const s = stats.get(tid)!;
    const team = teamsById.get(tid);
    if (!team) throw new Error(`Team ${tid} is missing`);
    return { ...s, teamId: tid, team };
  });

  rows.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    const xgd = x.goalsFor - x.goalsAgainst;
    const ygd = y.goalsFor - y.goalsAgainst;
    if (ygd !== xgd) return ygd - xgd;
    if (y.goalsFor !== x.goalsFor) return y.goalsFor - x.goalsFor;
    return x.team.name.localeCompare(y.team.name);
  });

  return rows;
}

export function winnerTeamId(m: Match): string | null {
  if (m.homeScore == null || m.awayScore == null) return null;
  if (m.homeScore > m.awayScore) return m.homeTeamId;
  if (m.awayScore > m.homeScore) return m.awayTeamId;
  return null;
}

/**
 * K.-o.-Fortschritt: Sieger nur aus gespeicherten, unterschiedlichen Torzahlen.
 * „Spiel beenden“ allein setzt nur den Status — ohne Speichern der Tore gibt es keinen Sieger.
 */
export function requireKnockoutWinnerTeamId(
  m: Match,
  roundLabel: string
): string {
  if (m.homeScore == null || m.awayScore == null) {
    throw new Error(
      `${roundLabel}: Es fehlen gespeicherte Torzahlen. Beide Werte eintragen und „Speichern“ wählen — `
        + "„Spiel beenden“ beendet das Spiel nur, ermittelt aber keinen Sieger für die nächste Runde."
    );
  }
  if (m.homeScore === m.awayScore) {
    throw new Error(
      `${roundLabel}: Unentschieden — für die nächste Runde wird ein eindeutiger Sieger benötigt `
        + "(z. B. Ergebnis nach Verlängerung oder Elfmeterschießen als Tore)."
    );
  }
  const w = winnerTeamId(m);
  if (!w) {
    throw new Error(`${roundLabel}: Sieger konnte nicht ermittelt werden`);
  }
  return w;
}
