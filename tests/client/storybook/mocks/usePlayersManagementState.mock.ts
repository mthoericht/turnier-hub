import { computed, ref } from "vue";

export function usePlayersManagementState()
{
  const scope = ref<"all" | "own">("all");
  const classFilter = ref("");

  const players = ref<unknown[]>([]);
  const schoolClassOptions = ref<unknown[]>([]);

  const loading = ref(false);
  const classesLoading = ref(false);
  const error = ref("");

  const dialogOpen = ref(false);
  const editingId = ref<string | null>(null);
  const dialogName = ref("");
  const dialogClassId = ref("");

  const filteredPlayers = computed(() => []);

  const canAddPlayer = computed(() => true);

  const distinctClassOptions = computed(() => []);
  const hasPlayersWithoutClass = computed(() => false);

  function getClassName(): string
  {
    return "Ohne Klasse";
  }

  function openCreate(): void
  {
    editingId.value = null;
    dialogName.value = "";
    dialogClassId.value = "";
    dialogOpen.value = true;
  }

  function openEdit(): void {}

  function closeDialog(): void
  {
    dialogOpen.value = false;
  }

  async function submitDialog(): Promise<void> {}

  async function remove(): Promise<void> {}

  async function loadPlayers(): Promise<void> {}
  async function loadClasses(): Promise<void> {}

  return {
    scope,
    players,
    schoolClassOptions,
    classFilter,
    loading,
    classesLoading,
    error,
    dialogOpen,
    editingId,
    dialogName,
    dialogClassId,
    filteredPlayers,
    canAddPlayer,
    distinctClassOptions,
    hasPlayersWithoutClass,
    openCreate,
    openEdit,
    closeDialog,
    submitDialog,
    remove,
    getClassName,
    loadPlayers,
    loadClasses,
  };
}

