import { watch, ref } from "vue";
import { useAuthStore } from "@/stores/auth";
import { fetchPlayers } from "@/api/playersApi";
import { fetchSchoolClasses } from "@/api/classesApi";
import { fetchTournaments, type TournamentListRow } from "@/api/tournamentsApi";

export type TournamentStatus = "ongoing" | "completed" | "upcoming";

export function useDashboardState() 
{
  const auth = useAuthStore();

  const loading = ref(false);
  const error = ref("");

  const classesCount = ref(0);
  const playersCount = ref(0);
  const tournamentsCount = ref(0);
  const activeTournamentsCount = ref(0);
  const recentTournaments = ref<TournamentListRow[]>([]);

  const recentLimit = 5;

  function getTournamentStatus(t: TournamentListRow): TournamentStatus 
  {
    if (t.phase === "COMPLETED") return "completed";
    if (t._count.matches === 0) return "upcoming";
    return "ongoing";
  }

  function tournamentPillClass(
    status: TournamentStatus
  ): string 
  {
    if (status === "ongoing") 
    {
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200";
    }
    if (status === "completed") 
    {
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
    }
    return "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300";
  }

  async function loadDashboard(): Promise<void> 
  {
    loading.value = true;
    error.value = "";
    try 
    {
      const [classes, players, tournaments] = await Promise.all([
        fetchSchoolClasses("all"),
        fetchPlayers("all"),
        fetchTournaments("all"),
      ]);

      classesCount.value = classes.length;
      playersCount.value = players.length;
      tournamentsCount.value = tournaments.length;

      const ongoing = tournaments.filter(
        (t) => getTournamentStatus(t) === "ongoing",
      );
      activeTournamentsCount.value = ongoing.length;

      recentTournaments.value = tournaments.slice(0, recentLimit);
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

  watch(
    () => auth.user,
    () =>
    {
      if (auth.user) 
      {
        void loadDashboard();
      }
      else 
      {
        recentTournaments.value = [];
        classesCount.value = 0;
        playersCount.value = 0;
        tournamentsCount.value = 0;
        activeTournamentsCount.value = 0;
        error.value = "";
      }
    },
    { immediate: true },
  );

  return {
    auth,
    loading,
    error,
    classesCount,
    playersCount,
    tournamentsCount,
    activeTournamentsCount,
    recentTournaments,
    getTournamentStatus,
    tournamentPillClass,
  };
}

