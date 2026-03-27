import { computed, type ComputedRef } from "vue";
import type {
  TournamentLayoutContext,
  TournamentTeam,
} from "@/tournament/tournamentContext";

const GROUP_COLORS: Record<string, string> = {
  A: "border-l-blue-500 dark:border-l-blue-400",
  B: "border-l-emerald-500 dark:border-l-emerald-400",
  C: "border-l-amber-500 dark:border-l-amber-400",
  D: "border-l-rose-500 dark:border-l-rose-400",
  E: "border-l-violet-500 dark:border-l-violet-400",
  F: "border-l-cyan-500 dark:border-l-cyan-400",
  G: "border-l-orange-500 dark:border-l-orange-400",
  H: "border-l-pink-500 dark:border-l-pink-400",
};

const GROUP_BG: Record<string, string> = {
  A: "bg-blue-50/50 dark:bg-blue-950/20",
  B: "bg-emerald-50/50 dark:bg-emerald-950/20",
  C: "bg-amber-50/50 dark:bg-amber-950/20",
  D: "bg-rose-50/50 dark:bg-rose-950/20",
  E: "bg-violet-50/50 dark:bg-violet-950/20",
  F: "bg-cyan-50/50 dark:bg-cyan-950/20",
  G: "bg-orange-50/50 dark:bg-orange-950/20",
  H: "bg-pink-50/50 dark:bg-pink-950/20",
};

export type GroupedTeams = { label: string; teams: TournamentTeam[] };

type RosterGroupsDisplayDeps = Pick<TournamentLayoutContext, "tournament">;

export function useTournamentRosterGroupsDisplay(
  deps: RosterGroupsDisplayDeps
): {
  isIndividuals: ComputedRef<boolean>;
  hasGroups: ComputedRef<boolean>;
  teamsByGroup: ComputedRef<GroupedTeams[]>;
  groupBorderClass: (label: string) => string;
  groupBgClass: (label: string) => string;
}
{
  const isIndividuals = computed(
    () => deps.tournament.value?.teamsAreIndividuals ?? false
  );

  const hasGroups = computed(
    () => deps.tournament.value?.teams.some((t) => t.groupLabel) ?? false
  );

  const teamsByGroup = computed<GroupedTeams[]>(() =>
  {
    if (!deps.tournament.value || !hasGroups.value) return [];
    const map = new Map<string, TournamentTeam[]>();
    for (const team of deps.tournament.value.teams)
    {
      const label = team.groupLabel ?? "–";
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(team);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, teams]) => ({ label, teams }));
  });

  function groupBorderClass(label: string): string
  {
    return GROUP_COLORS[label] ?? "border-l-slate-400 dark:border-l-slate-500";
  }

  function groupBgClass(label: string): string
  {
    return GROUP_BG[label] ?? "bg-slate-50/50 dark:bg-slate-900/20";
  }

  return {
    isIndividuals,
    hasGroups,
    teamsByGroup,
    groupBorderClass,
    groupBgClass,
  };
}
