import { computed, ref } from "vue";

export function useClassesManagementState()
{
  const scope = ref<"all" | "own">("all");
  const classes = ref<unknown[]>([]);
  const loading = ref(false);
  const error = ref("");

  const dialogOpen = ref(false);
  const editingId = ref<string | null>(null);
  const dialogName = ref("");

  function getPlayerCount(): number
  {
    return 0;
  }

  function isMine(): boolean
  {
    return false;
  }

  function openCreate(): void
  {
    editingId.value = null;
    dialogName.value = "";
    dialogOpen.value = true;
  }

  function openEdit(): void {}

  function closeDialog(): void
  {
    dialogOpen.value = false;
  }

  async function submitDialog(): Promise<void> {}

  async function remove(): Promise<void> {}

  async function load(): Promise<void> {}

  const initialized = computed(() => true);

  return {
    scope,
    classes,
    loading,
    error,
    initialized,
    dialogOpen,
    editingId,
    dialogName,
    getPlayerCount,
    isMine,
    openCreate,
    openEdit,
    closeDialog,
    submitDialog,
    remove,
    load,
  };
}

