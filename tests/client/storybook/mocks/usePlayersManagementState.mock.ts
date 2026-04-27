import { computed, ref } from "vue";
import type { Player, SchoolClass } from "@turnier-hub/shared";

const defaultSchoolClasses: SchoolClass[] = [
  {
    id: "class-1",
    name: "10a",
    createdBy: {
      id: "user-1",
      username: "coach",
      email: "coach@example.com",
    },
  },
  {
    id: "class-2",
    name: "9b",
    createdBy: {
      id: "user-2",
      username: "teacher",
      email: "teacher@example.com",
    },
  },
];

const defaultPlayers: Player[] = [
  {
    id: "player-1",
    firstName: "Lina",
    lastName: "Meyer",
    schoolClass: { id: "class-1", name: "10a" },
    createdBy: {
      id: "user-1",
      username: "coach",
      email: "coach@example.com",
    },
  },
  {
    id: "player-2",
    firstName: "Tom",
    lastName: "Schulz",
    schoolClass: { id: "class-2", name: "9b" },
    createdBy: {
      id: "user-2",
      username: "teacher",
      email: "teacher@example.com",
    },
  },
];

const players = ref<Player[]>(structuredClone(defaultPlayers));
const schoolClassOptions = ref<SchoolClass[]>(structuredClone(defaultSchoolClasses));
const loading = ref(false);
const classesLoading = ref(false);
const error = ref("");

export function resetPlayersStoryState(): void
{
  players.value = structuredClone(defaultPlayers);
  schoolClassOptions.value = structuredClone(defaultSchoolClasses);
  loading.value = false;
  classesLoading.value = false;
  error.value = "";
}

export function setPlayersStoryState(state: {
  players?: Player[];
  schoolClassOptions?: SchoolClass[];
  loading?: boolean;
  classesLoading?: boolean;
  error?: string;
}): void
{
  if (state.players !== undefined) players.value = structuredClone(state.players);
  if (state.schoolClassOptions !== undefined) schoolClassOptions.value = structuredClone(state.schoolClassOptions);
  if (state.loading !== undefined) loading.value = state.loading;
  if (state.classesLoading !== undefined) classesLoading.value = state.classesLoading;
  if (state.error !== undefined) error.value = state.error;
}

export function usePlayersManagementState()
{
  const scope = ref<"all" | "own">("all");
  const classFilter = ref("");
  const searchQuery = ref("");
  const sortKey = ref<"firstName" | "lastName" | "schoolClass">("lastName");
  const sortDirection = ref<"asc" | "desc">("asc");

  const dialogOpen = ref(false);
  const editingId = ref<string | null>(null);
  const dialogFirstName = ref("");
  const dialogLastName = ref("");
  const dialogClassId = ref("");
  const importDialogOpen = ref(false);
  const importMode = ref<"reset_all" | "append" | "replace_players">("append");

  const filteredPlayers = computed(() => players.value);

  const canAddPlayer = computed(() => true);

  const distinctClassOptions = computed(() => schoolClassOptions.value);
  const hasPlayersWithoutClass = computed(() =>
    players.value.some((player) => !player.schoolClass)
  );

  function getClassName(player: Player): string
  {
    return player.schoolClass?.name ?? "Ohne Klasse";
  }

  function openCreate(): void
  {
    editingId.value = null;
    dialogFirstName.value = "";
    dialogLastName.value = "";
    dialogClassId.value = "";
    dialogOpen.value = true;
  }

  function openEdit(player: Player): void
  {
    editingId.value = player.id;
    dialogFirstName.value = player.firstName;
    dialogLastName.value = player.lastName;
    dialogClassId.value = player.schoolClass?.id ?? "";
    dialogOpen.value = true;
  }

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

