import { ref } from "vue";
import type { TournamentListRow } from "@/api/tournamentsApi";
import type { TournamentMode } from "@/tournament/tournamentContext";

export function useTournamentsListState()
{
  const list = ref<TournamentListRow[]>([
    {
      id: "t1",
      name: "Sommerturnier 7a",
      sport: "Fußball",
      mode: "GROUP_KO" as TournamentMode,
      phase: "GROUP",
      _count: { teams: 6, matches: 10 },
    },
  ]);

  const loading = ref(false);
  const error = ref("");

  const name = ref("Neues Turnier");
  const sport = ref("Volleyball");
  const mode = ref<TournamentMode>("GROUP_KO");
  const teamsAreIndividuals = ref(false);

  async function createT(): Promise<TournamentListRow | null>
  {
    return null;
  }

  async function remove(): Promise<void> {}

  return {
    list,
    loading,
    error,
    name,
    sport,
    mode,
    teamsAreIndividuals,
    createT,
    remove,
  };
}

