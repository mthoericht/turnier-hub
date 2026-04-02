import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useClassesManagementStore } from "@/stores/classesManagement";

export type { ClassesScope } from "@/stores/classesManagement";

export function useClassesManagementState()
{
  const store = useClassesManagementStore();
  onMounted(() =>
  {
    void store.load();
  });
  return {
    ...storeToRefs(store),
    getPlayerCount: store.getPlayerCount,
    openCreate: store.openCreate,
    openEdit: store.openEdit,
    closeDialog: store.closeDialog,
    submitDialog: store.submitDialog,
    remove: store.remove,
    load: store.load,
  };
}
