import { computed, onMounted, ref, watch } from "vue";
import {
  deletePlayer,
  fetchPlayers,
  patchPlayer,
  postPlayer,
} from "@/api/playersApi";
import { fetchSchoolClasses } from "@/api/classesApi";
import { useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast";
import type { Player, SchoolClass } from "@/types";

export type PlayersScope = "all" | "own";

export function usePlayersManagementState() 
{
  const auth = useAuthStore();
  const toast = useToastStore();

  const scope = ref<PlayersScope>("all");
  const players = ref<Player[]>([]);
  const myClasses = ref<SchoolClass[]>([]);

  const loading = ref(true);
  const classesLoading = ref(true);
  const error = ref("");

  const dialogOpen = ref(false);
  const editingId = ref<string | null>(null);
  const dialogName = ref("");
  const dialogClassId = ref<string>(""); // "" => keine Klasse

  /** "" = alle, "__none__" = ohne Klasse, sonst Klassen-ID */
  const classFilter = ref("");

  function isMine(p: Player): boolean 
  {
    return !!auth.user && p.createdBy.id === auth.user.id;
  }

  function getClassName(p: Player): string 
  {
    return p.schoolClass?.name ?? "Ohne Klasse";
  }

  async function loadClasses(): Promise<void> 
  {
    classesLoading.value = true;
    try 
    {
      myClasses.value = await fetchSchoolClasses("own");
    }
    catch 
    {
      myClasses.value = [];
    }
    finally 
    {
      classesLoading.value = false;
    }
  }

  async function loadPlayers(): Promise<void> 
  {
    loading.value = true;
    error.value = "";
    try 
    {
      players.value = await fetchPlayers(scope.value);
    }
    catch (e) 
    {
      error.value = e instanceof Error ? e.message : "Laden fehlgeschlagen";
      toast.showError(error.value);
    }
    finally 
    {
      loading.value = false;
    }
    normalizeClassFilter();
  }

  function normalizeClassFilter(): void 
  {
    if (!classFilter.value) return;
    if (classFilter.value === "__none__") 
    {
      if (!players.value.some((p) => !p.schoolClass)) classFilter.value = "";
      return;
    }
    const ids = new Set(
      players.value.map((p) => p.schoolClass?.id).filter(Boolean) as string[],
    );
    if (!ids.has(classFilter.value)) classFilter.value = "";
  }

  watch(scope, () =>
  {
    classFilter.value = "";
    void loadPlayers();
  });

  watch(
    () => players.value,
    () => normalizeClassFilter(),
    { deep: false },
  );

  function openCreate(): void 
  {
    editingId.value = null;
    dialogName.value = "";
    dialogClassId.value = "";
    dialogOpen.value = true;
  }

  function openEdit(p: Player): void 
  {
    if (!isMine(p)) return;
    editingId.value = p.id;
    dialogName.value = p.name;
    dialogClassId.value = p.schoolClass?.id ?? "";
    dialogOpen.value = true;
  }

  function closeDialog(): void 
  {
    dialogOpen.value = false;
  }

  async function submitDialog(): Promise<void> 
  {
    if (!dialogName.value.trim()) return;

    const name = dialogName.value.trim();
    const schoolClassId = dialogClassId.value || null;

    try 
    {
      if (editingId.value) 
      {
        await patchPlayer(editingId.value, { name, schoolClassId });
        toast.showSuccess("Spieler aktualisiert");
      }
      else 
      {
        await postPlayer({ name, schoolClassId });
        toast.showSuccess("Spieler hinzugefügt");
      }
      closeDialog();
      await loadPlayers();
    }
    catch (e) 
    {
      const msg = e instanceof Error ? e.message : "Speichern fehlgeschlagen";
      error.value = msg;
      toast.showError(msg);
    }
  }

  async function remove(id: string): Promise<void> 
  {
    if (!confirm("Spieler wirklich löschen?")) return;
    try 
    {
      await deletePlayer(id);
      toast.showSuccess("Spieler gelöscht");
      await loadPlayers();
    }
    catch (e) 
    {
      const msg = e instanceof Error ? e.message : "Löschen fehlgeschlagen";
      error.value = msg;
      toast.showError(msg);
    }
  }

  const canAddPlayer = computed(
    () => !classesLoading.value && myClasses.value.length > 0,
  );

  const distinctClassOptions = computed(() => 
  {
    const byId = new Map<string, string>();
    for (const p of players.value) 
    {
      if (p.schoolClass) byId.set(p.schoolClass.id, p.schoolClass.name);
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  });

  const hasPlayersWithoutClass = computed(() =>
    players.value.some((p) => !p.schoolClass),
  );

  const filteredPlayers = computed(() => 
  {
    if (!classFilter.value) return players.value;
    if (classFilter.value === "__none__") 
    {
      return players.value.filter((p) => !p.schoolClass);
    }
    return players.value.filter((p) => p.schoolClass?.id === classFilter.value);
  });

  onMounted(() =>
  {
    void loadClasses();
    void loadPlayers();
  });

  return {
    scope,
    players,
    myClasses,
    loading,
    classesLoading,
    error,
    dialogOpen,
    editingId,
    dialogName,
    dialogClassId,
    classFilter,
    filteredPlayers,
    canAddPlayer,
    distinctClassOptions,
    hasPlayersWithoutClass,
    openCreate,
    openEdit,
    closeDialog,
    submitDialog,
    remove,
    isMine,
    getClassName,
  };
}

