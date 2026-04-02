import type { MatchRow, MatchStatus } from "@/tournament/tournamentContext";

export const baseScheduledMatch: MatchRow = {
  id: "m1",
  phase: "GROUP",
  roundOrder: 1,
  groupLabel: "A",
  homeTeamId: "t1",
  awayTeamId: "t2",
  homeTeam: { id: "t1", name: "Team Alpha" },
  awayTeam: { id: "t2", name: "Team Beta" },
  homeScore: null,
  awayScore: null,
  status: "SCHEDULED",
  elapsedMs: 0,
  matchStartedAt: null,
  totalPausedMs: 0,
  pausedAt: null,
  elapsedSnapshotMs: null,
};

export function storyFormatMs(ms: number): string
{
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export function storyFormatMatchStatusLabel(status: MatchStatus): string
{
  switch (status)
  {
    case "SCHEDULED":
      return "Geplant";
    case "LIVE":
      return "Live";
    case "PAUSED":
      return "Pausiert";
    case "FINISHED":
      return "Beendet";
    case "CANCELLED":
      return "Abgesagt";
    default:
      return status;
  }
}
