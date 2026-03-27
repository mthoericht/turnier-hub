import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useTournamentsListStore } from "@/stores/tournamentsList";

export type { TournamentsScope } from "@/stores/tournamentsList";

export function useTournamentsListState()
{
  const store = useTournamentsListStore();
  onMounted(() =>
  {
    void store.load();
  });
  return {
    ...storeToRefs(store),
    createT: store.createT,
    remove: store.remove,
    isMine: store.isMine,
    load: store.load,
  };
}
