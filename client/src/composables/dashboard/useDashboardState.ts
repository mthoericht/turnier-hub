import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useDashboardStore } from "@/stores/dashboard";

export type { TournamentStatus } from "@/stores/dashboard";

export function useDashboardState()
{
  const store = useDashboardStore();
  onMounted(() => void store.loadDashboard());
  return {
    ...storeToRefs(store),
    getTournamentStatus: store.getTournamentStatus,
    tournamentPillClass: store.tournamentPillClass,
    loadDashboard: store.loadDashboard,
  };
}
