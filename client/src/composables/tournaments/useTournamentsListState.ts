import { onMounted, ref, watch } from "vue";
import {
  deleteTournament,
  fetchTournaments,
  postTournament,
  type TournamentListRow,
} from "@/api/tournamentsApi";
import { useAuthStore } from "@/stores/auth";
import type { TournamentMode } from "@/tournament/tournamentContext";

export type TournamentsScope = "all" | "own";

export function useTournamentsListState()
{
  const auth = useAuthStore();

  const scope = ref<TournamentsScope>("all");
  const list = ref<TournamentListRow[]>([]);
  const loading = ref(true);
  const error = ref("");

  const name = ref("");
  const sport = ref("Volleyball");
  const mode = ref<TournamentMode>("GROUP_KO");
  const teamsAreIndividuals = ref(false);

  async function load(): Promise<void>
  {
    loading.value = true;
    error.value = "";
    try
    {
      list.value = await fetchTournaments(scope.value);
    }
    catch (e)
    {
      error.value = e instanceof Error ? e.message : "Laden fehlgeschlagen";
    }
    finally
    {
      loading.value = false;
    }
  }

  function isMine(t: TournamentListRow): boolean
  {
    return !!auth.user && t.createdBy.id === auth.user.id;
  }

  watch(scope, () => void load());

  async function createT(): Promise<TournamentListRow | null>
  {
    if (!name.value.trim()) return null;
    try
    {
      const result = await postTournament({
        name: name.value.trim(),
        sport: sport.value,
        mode: mode.value,
        teamsAreIndividuals: teamsAreIndividuals.value,
      });
      name.value = "";
      mode.value = "GROUP_KO";
      teamsAreIndividuals.value = false;
      await load();
      return result;
    }
    catch (e)
    {
      error.value = e instanceof Error ? e.message : "Anlegen fehlgeschlagen";
      return null;
    }
  }

  async function remove(id: string): Promise<void>
  {
    if (!confirm("Turnier wirklich löschen?")) return;
    try
    {
      await deleteTournament(id);
      await load();
    }
    catch (e)
    {
      error.value = e instanceof Error ? e.message : "Löschen fehlgeschlagen";
    }
  }

  onMounted(() => void load());

  return {
    scope,
    list,
    loading,
    error,
    name,
    sport,
    mode,
    teamsAreIndividuals,
    createT,
    remove,
    isMine,
  };
}
