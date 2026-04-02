import { computed, type ComputedRef } from "vue";
import type {
  TournamentLayoutContext,
  TournamentTeam,
} from "@/tournament/tournamentContext";

const GROUP_COLORS: Record<string, string> = {
  A: "border-l-blue-500",
  B: "border-l-emerald-500",
  C: "border-l-amber-500",
  D: "border-l-rose-500",
  E: "border-l-violet-500",
  F: "border-l-cyan-500",
  G: "border-l-orange-500",
  H: "border-l-pink-500",
};

const GROUP_BG: Record<string, string> = {
  A: "bg-blue-50/50",
  B: "bg-emerald-50/50",
  C: "bg-amber-50/50",
  D: "bg-rose-50/50",
  E: "bg-violet-50/50",
  F: "bg-cyan-50/50",
  G: "bg-orange-50/50",
  H: "bg-pink-50/50",
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
    return GROUP_COLORS[label] ?? "border-l-slate-400";
  }

  function groupBgClass(label: string): string
  {
    return GROUP_BG[label] ?? "bg-slate-50/50";
  }

  return {
    isIndividuals,
    hasGroups,
    teamsByGroup,
    groupBorderClass,
    groupBgClass,
  };
}
