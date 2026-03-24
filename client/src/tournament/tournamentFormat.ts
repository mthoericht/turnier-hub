import type { MatchPhase, MatchStatus } from "@/tournament/tournamentContext";

export function formatPhaseLabel(phase: MatchPhase | string): string 
{
  const labels: Record<string, string> = {
    GROUP: "Vorrunde",
    QUARTER: "Viertelfinale",
    SEMI: "Halbfinale",
    FINAL: "Finale",
    COMPLETED: "Abgeschlossen",
  };
  return labels[phase] ?? phase;
}

export function formatMatchStatusLabel(status: MatchStatus): string 
{
  const labels: Record<string, string> = {
    SCHEDULED: "Geplant",
    LIVE: "Läuft",
    PAUSED: "Pause",
    FINISHED: "Beendet",
    CANCELLED: "Abgebrochen",
  };
  return labels[status] ?? status;
}

/** Formats elapsed match time for display (mm:ss or h:mm:ss). */
export function formatMatchDurationMs(ms: number): string 
{
  const s = Math.floor(ms / 1000);
  const mi = Math.floor(s / 60);
  const h = Math.floor(mi / 60);
  const mm = mi % 60;
  const ss = s % 60;
  if (h > 0) 
  {
    return `${h}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }
  return `${mm}:${String(ss).padStart(2, "0")}`;
}
