import { computed, ref } from "vue";

export function usePlayersManagementState()
{
  const scope = ref<"all" | "own">("all");
  const classFilter = ref("");
  const searchQuery = ref("");
  const sortKey = ref<"firstName" | "lastName" | "schoolClass">("lastName");
  const sortDirection = ref<"asc" | "desc">("asc");

  const players = ref<unknown[]>([]);
  const schoolClassOptions = ref<unknown[]>([]);

  const loading = ref(false);
  const classesLoading = ref(false);
  const error = ref("");

  const dialogOpen = ref(false);
  const editingId = ref<string | null>(null);
  const dialogFirstName = ref("");
  const dialogLastName = ref("");
  const dialogClassId = ref("");
  const importDialogOpen = ref(false);
  const importMode = ref<"reset_all" | "append" | "replace_players">("append");

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
    dialogFirstName.value = "";
    dialogLastName.value = "";
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
  function toggleSort(): void {}
  function openImportDialog(): void
  {
    importDialogOpen.value = true;
  }
  function closeImportDialog(): void
  {
    importDialogOpen.value = false;
  }
  async function importFromFile(): Promise<void> {}
  async function exportCurrentPlayers(): Promise<void> {}

  async function loadPlayers(): Promise<void> {}
  async function loadClasses(): Promise<void> {}

  return {
    scope,
    players,
    schoolClassOptions,
    classFilter,
    searchQuery,
    sortKey,
    sortDirection,
    loading,
    classesLoading,
    error,
    dialogOpen,
    editingId,
    dialogFirstName,
    dialogLastName,
    dialogClassId,
    importDialogOpen,
    importMode,
    filteredPlayers,
    canAddPlayer,
    distinctClassOptions,
    hasPlayersWithoutClass,
    openCreate,
    openEdit,
    closeDialog,
    submitDialog,
    remove,
    toggleSort,
    openImportDialog,
    closeImportDialog,
    importFromFile,
    exportCurrentPlayers,
    getClassName,
    loadPlayers,
    loadClasses,
  };
}

