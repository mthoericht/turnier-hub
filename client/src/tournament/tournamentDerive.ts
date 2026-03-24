import type {
  MatchPhase,
  MatchRow,
  StandingTeamRow,
  TournamentDetail,
  TournamentTeam,
} from "@/tournament/tournamentContext";
import type { Player } from "@/types";

export type ScoreDraftMap = Record<string, { home: string; away: string }>;

export function matchNeedsTimerPoll(m: MatchRow): boolean 
{
  return m.status === "LIVE" || m.status === "PAUSED";
}

/** Eingetragene Tore, laufende/abgeschlossene/abgebrochene Spiele — Neu-Anlegen der Phase verwirft diese Daten. */
export function matchHasRecordedProgress(m: MatchRow): boolean 
{
  if (m.homeScore != null || m.awayScore != null) return true;
  return (
    m.status === "FINISHED"
    || m.status === "LIVE"
    || m.status === "PAUSED"
    || m.status === "CANCELLED"
  );
}

export function groupRegenerateRisksDataLoss(matches: MatchRow[]): boolean 
{
  return matches.some(
    (m) => m.phase === "GROUP" && matchHasRecordedProgress(m)
  );
}

function phasesClearedByAdvance(
  target: "QUARTER" | "SEMI" | "FINAL",
  tournamentPhase: string
): MatchPhase[] 
{
  if (target === "QUARTER") return ["QUARTER", "SEMI", "FINAL"];
  if (target === "SEMI") 
  {
    if (tournamentPhase === "QUARTER") return ["SEMI", "FINAL"];
    const out: MatchPhase[] = ["SEMI", "FINAL"];
    if (tournamentPhase === "GROUP") out.push("QUARTER");
    return out;
  }
  if (target === "FINAL") return ["FINAL"];
  return [];
}

/** Entspricht dem Server: welche Phasen beim Advance geleert werden, sofern betroffene Spiele Fortschritt haben. */
export function advanceTargetRisksDataLoss(
  matches: MatchRow[],
  target: "QUARTER" | "SEMI" | "FINAL",
  tournamentPhase: string
): boolean 
{
  const cleared = new Set(phasesClearedByAdvance(target, tournamentPhase));
  return matches.some(
    (m) => cleared.has(m.phase) && matchHasRecordedProgress(m)
  );
}

export function buildScoreDraftFromMatches(matches: MatchRow[]): ScoreDraftMap 
{
  const out: ScoreDraftMap = {};
  for (const m of matches) 
  {
    out[m.id] = {
      home: m.homeScore != null ? String(m.homeScore) : "0",
      away: m.awayScore != null ? String(m.awayScore) : "0",
    };
  }
  return out;
}

function scoreDraftFieldMatchesServer(
  draft: string,
  server: number | null | undefined
): boolean 
{
  if (server == null) return draft === "" || draft === "0";
  return String(server) === draft;
}

/**
 * Wie buildScoreDraftFromMatches, aber Zeilen behalten, die vom Server abweichen
 * (laufende Eingabe). Sonst überschreibt z. B. der Timer-Poll jede Sekunde den Entwurf.
 */
export function mergeScoreDraftFromMatches(
  matches: MatchRow[],
  previous: ScoreDraftMap
): ScoreDraftMap 
{
  const built = buildScoreDraftFromMatches(matches);
  const out: ScoreDraftMap = {};
  for (const m of matches) 
  {
    const b = built[m.id]!;
    const p = previous[m.id];
    if (!p) 
    {
      out[m.id] = b;
      continue;
    }
    const sameAsServer =
      scoreDraftFieldMatchesServer(p.home, m.homeScore)
      && scoreDraftFieldMatchesServer(p.away, m.awayScore);
    out[m.id] = sameAsServer ? b : p;
  }
  return out;
}

function matchPhaseForTournamentPhase(
  tournamentPhase: string | undefined
): MatchPhase | null 
{
  const tp = tournamentPhase ?? "GROUP";
  if (tp === "QUARTER") return "QUARTER";
  if (tp === "SEMI") return "SEMI";
  if (tp === "FINAL" || tp === "COMPLETED") return "FINAL";
  return null;
}

/**
 * Liefert Spiele gruppiert nach Phase. K.-o.-Phasen (VF/HF/Finale) erscheinen
 * auch als leerer Block, wenn das Turnier in dieser Phase ist — damit die UI
 * einen Container zeigen kann, sobald die Runde angelegt wurde.
 */
export function getMatchesByPhase(
  matches: MatchRow[],
  tournamentPhase?: string
): { phase: MatchPhase; matches: MatchRow[] }[] 
{
  const order: MatchPhase[] = ["GROUP", "QUARTER", "SEMI", "FINAL"];
  const map = new Map<MatchPhase, MatchRow[]>();
  for (const ph of order) map.set(ph, []);
  for (const m of matches) 
  {
    map.get(m.phase)?.push(m);
  }

  const currentKo = matchPhaseForTournamentPhase(tournamentPhase);
  const out: { phase: MatchPhase; matches: MatchRow[] }[] = [];

  for (const ph of order) 
  {
    const list = map.get(ph) ?? [];
    if (ph === "GROUP") 
    {
      if (list.length > 0) out.push({ phase: ph, matches: list });
      continue;
    }
    if (list.length > 0) 
    {
      out.push({ phase: ph, matches: list });
      continue;
    }
    if (currentKo === ph) 
    {
      out.push({ phase: ph, matches: [] });
    }
  }
  return out;
}

export function parseStandingsGroups(
  standings: Record<string, unknown> | null
): Record<string, StandingTeamRow[]> 
{
  const s = standings as { groups?: Record<string, StandingTeamRow[]> } | null;
  return s?.groups ?? {};
}

export function collectAssignedPlayerIds(teams: TournamentTeam[]): Set<string> 
{
  const s = new Set<string>();
  for (const team of teams) 
  {
    for (const m of team.members) 
    {
      s.add(m.playerId);
    }
  }
  return s;
}

export function filterAvailablePlayers(
  allPlayers: Player[],
  assigned: Set<string>
): Player[] 
{
  return allPlayers.filter((p) => !assigned.has(p.id));
}

export function canUserEditTournament(
  tournament: TournamentDetail | null,
  userId: string | undefined
): boolean 
{
  return (
    !!tournament && !!userId && tournament.createdBy.id === userId
  );
}

/** Keeps current team selection when still valid; otherwise first team or "". */
export function resolveMemberTeamSelection(
  teams: TournamentTeam[],
  currentTeamId: string
): string 
{
  if (teams.length === 0) return "";
  if (teams.some((x) => x.id === currentTeamId)) return currentTeamId;
  return teams[0]!.id;
}

export type ParsedScoreDraft =
  | { kind: "empty" }
  | { kind: "partial" }
  | { kind: "invalid" }
  | { kind: "ok"; homeScore: number; awayScore: number };

/**
 * Ergebnis für PATCH: immer beide Tore gemeinsam, sonst bleibt eine Seite in der DB null
 * (UI kann trotzdem beide Felder zeigen → „Finale anlegen“ scheitert trotz sichtbarer Zahlen).
 */
export function parseScoreDraftForPatch(d: { home: string; away: string }): ParsedScoreDraft 
{
  const hr = typeof d.home === "string" ? d.home.trim() : String(d.home ?? "").trim();
  const ar = typeof d.away === "string" ? d.away.trim() : String(d.away ?? "").trim();
  const homeSet = hr !== "";
  const awaySet = ar !== "";
  if (!homeSet && !awaySet) return { kind: "empty" };
  if (homeSet !== awaySet) return { kind: "partial" };
  const homeScore = Number(hr);
  const awayScore = Number(ar);
  if (
    Number.isNaN(homeScore)
    || homeScore < 0
    || Number.isNaN(awayScore)
    || awayScore < 0
  ) 
  {
    return { kind: "invalid" };
  }
  return { kind: "ok", homeScore, awayScore };
}
