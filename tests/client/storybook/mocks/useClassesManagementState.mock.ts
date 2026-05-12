import { computed, ref } from "vue";
import type { SchoolClass } from "@turnier-hub/shared";

const defaultClasses: SchoolClass[] = [
  {
    id: "class-1",
    name: "10a",
    createdBy: {
      subject: "coach",
    },
  },
  {
    id: "class-2",
    name: "9b",
    createdBy: {
      subject: "teacher",
    },
  },
];

const classes = ref<SchoolClass[]>(structuredClone(defaultClasses));
const loading = ref(false);
const error = ref("");

export function resetClassesStoryState(): void
{
  classes.value = structuredClone(defaultClasses);
  loading.value = false;
  error.value = "";
}

export function setClassesStoryState(state: {
  classes?: SchoolClass[];
  loading?: boolean;
  error?: string;
}): void
{
  if (state.classes !== undefined) classes.value = structuredClone(state.classes);
  if (state.loading !== undefined) loading.value = state.loading;
  if (state.error !== undefined) error.value = state.error;
}

export function useClassesManagementState()
{
  const scope = ref<"all" | "own">("all");

  const dialogOpen = ref(false);
  const editingId = ref<string | null>(null);
  const dialogName = ref("");

  function getPlayerCount(classId: string): number
  {
    if (classId === "class-1") return 18;
    if (classId === "class-2") return 14;
    return 0;
  }

  function openCreate(): void
  {
    editingId.value = null;
    dialogName.value = "";
    dialogOpen.value = true;
  }

  function openEdit(schoolClass: SchoolClass): void
  {
    editingId.value = schoolClass.id;
    dialogName.value = schoolClass.name;
    dialogOpen.value = true;
  }

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
    openCreate,
    openEdit,
    closeDialog,
    submitDialog,
    remove,
    load,
  };
}

