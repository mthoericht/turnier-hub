import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import {
  deleteSchoolClass,
  fetchSchoolClasses,
  patchSchoolClass,
  postSchoolClass,
} from "@/api/classesApi";
import { fetchPlayers } from "@/api/playersApi";
import { useConfirmDialogStore } from "@/stores/confirmDialog";
import { useToastStore } from "@/stores/toast";
import type { Player, SchoolClass } from "@/types";

export type ClassesScope = "all" | "own";

export const useClassesManagementStore = defineStore("classesManagement", () =>
{
  const toast = useToastStore();

  const scope = ref<ClassesScope>("all");
  const classes = ref<SchoolClass[]>([]);
  const players = ref<Player[]>([]);

  const loading = ref(true);
  const error = ref("");
  const initialized = ref(false);

  const dialogOpen = ref(false);
  const editingId = ref<string | null>(null);
  const dialogName = ref("");

  const playerCountByClassId = computed(() =>
  {
    const map = new Map<string, number>();
    for (const p of players.value)
    {
      const classId = p.schoolClass?.id;
      if (!classId) continue;
      map.set(classId, (map.get(classId) ?? 0) + 1);
    }
    return map;
  });

  function getPlayerCount(classId: string): number
  {
    return playerCountByClassId.value.get(classId) ?? 0;
  }

  async function load(): Promise<void>
  {
    loading.value = true;
    error.value = "";
    try
    {
      const [cls, pls] = await Promise.all([
        fetchSchoolClasses(scope.value),
        fetchPlayers("all"),
      ]);
      classes.value = cls;
      players.value = pls;
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
  }

  async function reloadIfInitialized(): Promise<void>
  {
    if (!initialized.value) return;
    await load();
  }

  watch(scope, () => void load());

  function openCreate(): void
  {
    editingId.value = null;
    dialogName.value = "";
    dialogOpen.value = true;
  }

  function openEdit(c: SchoolClass): void
  {
    editingId.value = c.id;
    dialogName.value = c.name;
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
    try
    {
      if (editingId.value)
      {
        await patchSchoolClass(editingId.value, { name });
        toast.showSuccess("Klasse aktualisiert");
      }
      else
      {
        await postSchoolClass({ name });
        toast.showSuccess("Klasse hinzugefügt");
      }
      closeDialog();
      await load();
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
        title: "Klasse löschen",
        description:
          "Klasse wirklich löschen? Zugeordnete Spieler verlieren die Zuordnung.",
        submitLabel: "Löschen",
      }
    );
    if (!ok) return;
    try
    {
      await deleteSchoolClass(id);
      toast.showSuccess("Klasse gelöscht");
      await load();
    }
    catch (e)
    {
      const msg = e instanceof Error ? e.message : "Löschen fehlgeschlagen";
      error.value = msg;
      toast.showError(msg);
    }
  }

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
    reloadIfInitialized,
  };
});
