import { computed, onMounted, ref, watch } from "vue";
import {
  deleteSchoolClass,
  fetchSchoolClasses,
  patchSchoolClass,
  postSchoolClass,
} from "@/api/classesApi";
import { fetchPlayers } from "@/api/playersApi";
import { useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast";
import type { Player, SchoolClass } from "@/types";

export type ClassesScope = "all" | "own";

export function useClassesManagementState() 
{
  const auth = useAuthStore();
  const toast = useToastStore();

  const scope = ref<ClassesScope>("all");
  const classes = ref<SchoolClass[]>([]);
  const players = ref<Player[]>([]);

  const loading = ref(true);
  const error = ref("");

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

  function isMine(c: SchoolClass): boolean 
  {
    return !!auth.user && c.createdBy.id === auth.user.id;
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

  watch(scope, () => void load());

  function openCreate(): void 
  {
    editingId.value = null;
    dialogName.value = "";
    dialogOpen.value = true;
  }

  function openEdit(c: SchoolClass): void 
  {
    if (!isMine(c)) return;
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
    if (
      !confirm(
        "Klasse wirklich löschen? Zugeordnete Spieler verlieren die Zuordnung.",
      )
    )
      return;
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

  onMounted(() => void load());

  return {
    scope,
    classes,
    loading,
    error,
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
  };
}

