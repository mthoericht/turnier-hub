import { defineStore } from "pinia";
import { ref, watch } from "vue";
import {
  deleteTournament,
  postTournament,
  fetchTournaments,
  type TournamentListRow,
} from "@/api/tournamentsApi";
import { useConfirmDialogStore } from "@/stores/confirmDialog";
import type { TournamentMode } from "@/tournament/tournamentContext";

export type TournamentsScope = "all" | "own";

export const useTournamentsListStore = defineStore("tournamentsList", () =>
{
  const scope = ref<TournamentsScope>("all");
  const list = ref<TournamentListRow[]>([]);
  const loading = ref(true);
  const error = ref("");
  const initialized = ref(false);

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
      initialized.value = true;
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

  async function reloadIfInitialized(): Promise<void>
  {
    if (!initialized.value) return;
    await load();
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
    const ok = await useConfirmDialogStore().requestConfirm(
      {
        title: "Turnier löschen",
        description: "Turnier wirklich löschen?",
        submitLabel: "Löschen",
      }
    );
    if (!ok) return;
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

  return {
    scope,
    list,
    loading,
    error,
    initialized,
    name,
    sport,
    mode,
    teamsAreIndividuals,
    createT,
    remove,
    load,
    reloadIfInitialized,
  };
});
