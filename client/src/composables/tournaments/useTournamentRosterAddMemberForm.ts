import {
  computed,
  ref,
  watch,
  type ComputedRef,
  type Ref,
} from "vue";
import type {
  TournamentLayoutContext,
  TournamentTeam,
} from "@/tournament/tournamentContext";

type RosterAddMemberFormDeps = Pick<
  TournamentLayoutContext,
  "tournament" | "addMemberTeamId"
>;

export function useTournamentRosterAddMemberForm(
  deps: RosterAddMemberFormDeps
): {
  selectedClassId: Ref<string>;
  selectedAddGroupLabel: Ref<string>;
  addMemberGroupOptions: ComputedRef<string[]>;
  addMemberSelectableTeams: ComputedRef<TournamentTeam[]>;
}
{
  const selectedClassId = ref<string>("");
  const selectedAddGroupLabel = ref<string>("");

  const addMemberGroupOptions = computed(() =>
  {
    if (!deps.tournament.value) return [];
    const labels = new Set<string>();
    for (const team of deps.tournament.value.teams)
    {
      if (team.groupLabel) labels.add(team.groupLabel);
    }
    return [...labels].sort((a, b) => a.localeCompare(b));
  });

  const addMemberSelectableTeams = computed(() =>
  {
    if (!deps.tournament.value) return [];
    if (!selectedAddGroupLabel.value) return deps.tournament.value.teams;
    return deps.tournament.value.teams.filter(
      (t) => t.groupLabel === selectedAddGroupLabel.value
    );
  });

  watch(addMemberSelectableTeams, (teams) =>
  {
    if (teams.some((t) => t.id === deps.addMemberTeamId.value)) return;
    deps.addMemberTeamId.value = teams[0]?.id ?? "";
  });

  return {
    selectedClassId,
    selectedAddGroupLabel,
    addMemberGroupOptions,
    addMemberSelectableTeams,
  };
}
