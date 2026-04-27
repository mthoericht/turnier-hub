import { computed, onMounted, ref } from "vue";
import {
  deleteAdminSchool,
  fetchAdminSchools,
  fetchAdminUsers,
  fetchAdminAuditLogs,
  patchAdminSchool,
  patchAdminUserRole,
  patchAdminUserSchool,
  postAdminSchool,
  type AdminSchool,
  type AdminUser,
  type AdminAuditLog,
} from "../../api/adminApi";
import { useAuthStore } from "../../stores/auth";
import { useConfirmDialogStore } from "../../stores/confirmDialog";
import { useToastStore } from "../../stores/toast";
import type { UserRole } from "@turnier-hub/shared";

export function useAdminManagementState()
{
  const auth = useAuthStore();
  const confirmDialog = useConfirmDialogStore();
  const toast = useToastStore();

  const loading = ref(true);
  const error = ref("");
  const schools = ref<AdminSchool[]>([]);
  const users = ref<AdminUser[]>([]);
  const auditLogs = ref<AdminAuditLog[]>([]);

  const schoolDialogOpen = ref(false);
  const schoolDialogId = ref<string | null>(null);
  const schoolDialogName = ref("");

  const isAdmin = computed(() => auth.user?.role === "admin");

  const inputClass = "ui-input-blue min-h-[48px] sm:min-h-0 sm:text-sm";
  const selectClass = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-600";

  async function load(): Promise<void>
  {
    loading.value = true;
    error.value = "";
    try
    {
      const [schoolRows, userRows] = await Promise.all([
        fetchAdminSchools(),
        fetchAdminUsers(),
      ]);
      const logs = await fetchAdminAuditLogs();
      schools.value = schoolRows;
      users.value = userRows;
      auditLogs.value = logs;
    }
    catch (err)
    {
      error.value = err instanceof Error ? err.message : "Admin-Daten konnten nicht geladen werden";
    }
    finally
    {
      loading.value = false;
    }
  }

  onMounted(() =>
  {
    if (!isAdmin.value)
    {
      loading.value = false;
      return;
    }
    void load();
  });

  function openCreateSchool(): void
  {
    schoolDialogId.value = null;
    schoolDialogName.value = "";
    schoolDialogOpen.value = true;
  }

  function openEditSchool(school: AdminSchool): void
  {
    schoolDialogId.value = school.id;
    schoolDialogName.value = school.name;
    schoolDialogOpen.value = true;
  }

  function closeSchoolDialog(): void
  {
    schoolDialogOpen.value = false;
  }

  async function submitSchoolDialog(): Promise<void>
  {
    const name = schoolDialogName.value.trim();
    if (!name)
    {
      return;
    }
    try
    {
      if (schoolDialogId.value)
      {
        await patchAdminSchool(schoolDialogId.value, { name });
        toast.showSuccess("Schule aktualisiert");
      }
      else
      {
        await postAdminSchool({ name });
        toast.showSuccess("Schule angelegt");
      }
      closeSchoolDialog();
      await load();
    }
    catch (err)
    {
      const message = err instanceof Error ? err.message : "Schule konnte nicht gespeichert werden";
      error.value = message;
      toast.showError(message);
    }
  }

  async function removeSchool(school: AdminSchool): Promise<void>
  {
    const ok = await confirmDialog.requestConfirm({
      title: "Schule löschen",
      description: `Schule "${school.name}" wirklich löschen?`,
      submitLabel: "Löschen",
    });
    if (!ok)
    {
      return;
    }
    try
    {
      await deleteAdminSchool(school.id);
      toast.showSuccess("Schule gelöscht");
      await load();
    }
    catch (err)
    {
      const message = err instanceof Error ? err.message : "Schule konnte nicht gelöscht werden";
      error.value = message;
      toast.showError(message);
    }
  }

  async function updateUserRole(user: AdminUser, role: UserRole): Promise<void>
  {
    if (user.role === role)
    {
      return;
    }
    try
    {
      await patchAdminUserRole(user.id, role);
      toast.showSuccess("Benutzerrechte aktualisiert");
      await load();
    }
    catch (err)
    {
      const message = err instanceof Error ? err.message : "Rechte konnten nicht aktualisiert werden";
      error.value = message;
      toast.showError(message);
    }
  }

  async function updateUserSchool(user: AdminUser, schoolId: string): Promise<void>
  {
    if (user.school.id === schoolId)
    {
      return;
    }
    try
    {
      await patchAdminUserSchool(user.id, schoolId);
      toast.showSuccess("Schule zugewiesen");
      await load();
    }
    catch (err)
    {
      const message = err instanceof Error ? err.message : "Schulzuweisung konnte nicht gespeichert werden";
      error.value = message;
      toast.showError(message);
    }
  }

  return {
    auth,
    loading,
    error,
    schools,
    users,
    auditLogs,
    schoolDialogOpen,
    schoolDialogId,
    schoolDialogName,
    isAdmin,
    inputClass,
    selectClass,
    load,
    openCreateSchool,
    openEditSchool,
    closeSchoolDialog,
    submitSchoolDialog,
    removeSchool,
    updateUserRole,
    updateUserSchool,
  };
}
