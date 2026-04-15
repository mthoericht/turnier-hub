import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import {
  deletePlayer,
  fetchPlayers,
  importPlayersFromRows,
  type PlayerImportMode,
  patchPlayer,
  postPlayer,
} from "@/api/playersApi";
import { fetchSchoolClasses } from "@/api/classesApi";
import { useConfirmDialogStore } from "@/stores/confirmDialog";
import { useToastStore } from "@/stores/toast";
import { formatPlayerName, type Player, type SchoolClass } from "@turnier-hub/shared";
import { exportPlayersToXlsx, parsePlayersImportFile } from "@/utils/playersExchange";

export type PlayersScope = "all" | "own";
export type PlayerSortKey = "firstName" | "lastName" | "schoolClass";
export type SortDirection = "asc" | "desc";

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
  const dialogFirstName = ref("");
  const dialogLastName = ref("");
  const dialogClassId = ref("");
  const classFilter = ref("");
  const searchQuery = ref("");
  const sortKey = ref<PlayerSortKey>("lastName");
  const sortDirection = ref<SortDirection>("asc");
  const importDialogOpen = ref(false);
  const importMode = ref<PlayerImportMode>("append");

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
    dialogFirstName.value = "";
    dialogLastName.value = "";
    dialogClassId.value = "";
    dialogOpen.value = true;
  }

  function openEdit(p: Player): void
  {
    editingId.value = p.id;
    dialogFirstName.value = p.firstName;
    dialogLastName.value = p.lastName;
    dialogClassId.value = p.schoolClass?.id ?? "";
    dialogOpen.value = true;
  }

  function closeDialog(): void
  {
    dialogOpen.value = false;
  }

  async function submitDialog(): Promise<void>
  {
    if (!dialogFirstName.value.trim() || !dialogLastName.value.trim()) return;

    const firstName = dialogFirstName.value.trim();
    const lastName = dialogLastName.value.trim();
    const schoolClassId = dialogClassId.value || null;

    try
    {
      if (editingId.value)
      {
        await patchPlayer(editingId.value, { firstName, lastName, schoolClassId });
        toast.showSuccess("Spieler aktualisiert");
      }
      else
      {
        await postPlayer({ firstName, lastName, schoolClassId });
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

  function openImportDialog(): void
  {
    importMode.value = "append";
    importDialogOpen.value = true;
  }

  function closeImportDialog(): void
  {
    importDialogOpen.value = false;
  }

  async function importFromFile(file: File): Promise<void>
  {
    try
    {
      const rows = await parsePlayersImportFile(file);
      const result = await importPlayersFromRows(rows, importMode.value);
      toast.showSuccess(`${result.imported} Spieler importiert`);
      await Promise.all([loadClasses(), loadPlayers()]);
    }
    catch (e)
    {
      const msg = e instanceof Error ? e.message : "Import fehlgeschlagen";
      error.value = msg;
      toast.showError(msg);
    }
  }

  async function exportCurrentPlayers(): Promise<void>
  {
    if (players.value.length === 0)
    {
      toast.showInfo("Keine Spieler zum Exportieren vorhanden");
      return;
    }

    const rows = [...players.value]
      .sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "de", { sensitivity: "base" }),
      )
      .map((p) => ({
        firstName: p.firstName,
        lastName: p.lastName,
        className: p.schoolClass?.name ?? "",
      }));

    const result = await exportPlayersToXlsx(rows, "players-export.xlsx");
    if (result === "cancelled")
    {
      toast.showInfo("Export abgebrochen");
      return;
    }
    if (result === "saved")
    {
      toast.showSuccess(`${rows.length} Spieler gespeichert`);
      return;
    }
    toast.showSuccess(`${rows.length} Spieler exportiert`);
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
    const byClass = classFilter.value
      ? classFilter.value === "__none__"
        ? players.value.filter((p) => !p.schoolClass)
        : players.value.filter((p) => p.schoolClass?.id === classFilter.value)
      : players.value;

    const query = searchQuery.value.trim().toLocaleLowerCase("de");
    const bySearch = query
      ? byClass.filter((p) =>
      {
        const firstName = p.firstName.toLocaleLowerCase("de");
        const lastName = p.lastName.toLocaleLowerCase("de");
        const fullName = `${p.firstName} ${p.lastName}`.trim().toLocaleLowerCase("de");
        const className = (p.schoolClass?.name ?? "").toLocaleLowerCase("de");

        return firstName.includes(query)
          || lastName.includes(query)
          || fullName.includes(query)
          || className.includes(query);
      })
      : byClass;

    return [...bySearch].sort((a, b) =>
    {
      const dir = sortDirection.value === "asc" ? 1 : -1;
      const aValue = sortKey.value === "firstName"
        ? a.firstName
        : sortKey.value === "lastName"
          ? a.lastName
          : (a.schoolClass?.name ?? "");
      const bValue = sortKey.value === "firstName"
        ? b.firstName
        : sortKey.value === "lastName"
          ? b.lastName
          : (b.schoolClass?.name ?? "");

      const primary = aValue.localeCompare(bValue, "de", { sensitivity: "base" });
      if (primary !== 0) return primary * dir;

      const tieA = `${a.lastName} ${a.firstName}`.trim();
      const tieB = `${b.lastName} ${b.firstName}`.trim();
      return tieA.localeCompare(tieB, "de", { sensitivity: "base" }) * dir;
    });
  });

  function toggleSort(nextKey: PlayerSortKey): void
  {
    if (sortKey.value === nextKey)
    {
      sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
      return;
    }
    sortKey.value = nextKey;
    sortDirection.value = "asc";
  }

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
    dialogFirstName,
    dialogLastName,
    dialogClassId,
    classFilter,
    searchQuery,
    sortKey,
    sortDirection,
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
    openImportDialog,
    closeImportDialog,
    importFromFile,
    exportCurrentPlayers,
    toggleSort,
    formatPlayerName,
    getClassName,
    loadPlayers,
    loadClasses,
    bootstrapView,
    reloadIfInitialized,
  };
});
