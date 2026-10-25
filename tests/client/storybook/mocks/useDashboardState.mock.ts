import { ref } from "vue";

export function useDashboardState()
{

  const loading = ref(false);
  const error = ref("");
  const classesCount = ref(3);
  const playersCount = ref(42);
  const tournamentsCount = ref(5);
  const activeTournamentsCount = ref(2);

  const recentTournaments = ref([
    {
      id: "t1",
      name: "Sommerturnier 7a",
      sport: "Fußball",
      phase: "GROUP",
      startsAt: "2025-06-01",
    },
    {
      id: "t2",
      name: "Basketball AG",
      sport: "Basketball",
      phase: "FINAL",
      startsAt: "2025-07-10",
    },
  ]);

  function getTournamentStatus()
  {
    return "ongoing" as const;
  }

  function tournamentPillClass()
  {
    return "bg-emerald-100 text-emerald-700";
  }

  return {
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
