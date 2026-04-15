import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import { usePlayersManagementStore } from "@/stores/playersManagement";

export type { PlayersScope } from "@/stores/playersManagement";

export function usePlayersManagementState()
{
  const store = usePlayersManagementStore();
  onMounted(() =>
  {
    void store.bootstrapView();
  });
  return {
    ...storeToRefs(store),
    formatPlayerName: store.formatPlayerName,
    toggleSort: store.toggleSort,
    getClassName: store.getClassName,
    openCreate: store.openCreate,
    openEdit: store.openEdit,
    closeDialog: store.closeDialog,
    submitDialog: store.submitDialog,
    remove: store.remove,
    openImportDialog: store.openImportDialog,
    closeImportDialog: store.closeImportDialog,
    importFromFile: store.importFromFile,
    exportCurrentPlayers: store.exportCurrentPlayers,
    loadPlayers: store.loadPlayers,
    loadClasses: store.loadClasses,
  };
}
