import { storeToRefs } from "pinia";
import { useDashboardStore } from "@/stores/dashboard";

export type { TournamentStatus } from "@/stores/dashboard";

export function useDashboardState()
{
  const store = useDashboardStore();
  return {
    ...storeToRefs(store),
    getTournamentStatus: store.getTournamentStatus,
    tournamentPillClass: store.tournamentPillClass,
    loadDashboard: store.loadDashboard,
  };
}
