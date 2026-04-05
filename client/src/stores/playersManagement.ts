import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import {
  deletePlayer,
  fetchPlayers,
  patchPlayer,
  postPlayer,
} from "@/api/playersApi";
import { fetchSchoolClasses } from "@/api/classesApi";
import { useConfirmDialogStore } from "@/stores/confirmDialog";
import { useToastStore } from "@/stores/toast";
import type { Player, SchoolClass } from "@turnier-hub/shared";

export type PlayersScope = "all" | "own";

export const usePlayersManagementStore = defineStore("playersManagement", () =>
{
  const toast = useToastStore();

  const scope = ref<PlayersScope>("all");
  const players = ref<Player[]>([]);
  /** All school classes (assignable when creating/editing a player). */
  const schoolClassOptions = ref<SchoolClass[]>([]);

  const loading = ref(true);
  const classesLoading = ref(true);
  const error = ref("");
  const initialized = ref(false);

  const dialogOpen = ref(false);
  const editingId = ref<string | null>(null);
  const dialogName = ref("");
  const dialogClassId = ref("");
  const classFilter = ref("");

  function getClassName(p: Player): string
  {
    return p.schoolClass?.name ?? "Ohne Klasse";
  }

  async function loadClasses(): Promise<void>
  {
    classesLoading.value = true;
    try
    {
      schoolClassOptions.value = await fetchSchoolClasses("all");
    }
    catch
    {
      schoolClassOptions.value = [];
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
      initialized.value = true;
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

  async function reloadIfInitialized(): Promise<void>
  {
    if (!initialized.value) return;
    await loadPlayers();
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
    const ok = await useConfirmDialogStore().requestConfirm(
      {
        title: "Spieler löschen",
        description: "Spieler wirklich löschen?",
        submitLabel: "Löschen",
      }
    );
    if (!ok) return;
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

  const canAddPlayer = computed(() => !classesLoading.value);

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

  async function bootstrapView(): Promise<void>
  {
    await loadClasses();
    await loadPlayers();
  }

  return {
    scope,
    players,
    schoolClassOptions,
    loading,
    classesLoading,
    error,
    initialized,
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
    getClassName,
    loadPlayers,
    loadClasses,
    bootstrapView,
    reloadIfInitialized,
  };
});
