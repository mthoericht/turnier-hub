import { ref } from "vue";
import type { AdminAuditLog, AdminSchool } from "@/api/adminApi";

const defaultSchools: AdminSchool[] = [
  { id: "school-1", name: "BBS Hannover", catalogCount: 42 },
  { id: "school-2", name: "IGS Linden", catalogCount: 17 },
];

const defaultAuditLogs: AdminAuditLog[] = [
  {
    id: "log-1",
    action: "school.update",
    targetType: "school",
    targetId: "school-1",
    createdAt: new Date().toISOString(),
    actor: { subject: "admincoach" },
    before: { name: "Alt" },
    after: { name: "Neu" },
  },
];

const schools = ref<AdminSchool[]>(structuredClone(defaultSchools));
const auditLogs = ref<AdminAuditLog[]>(structuredClone(defaultAuditLogs));

const schoolDialogOpen = ref(false);
const schoolDialogId = ref<string | null>(null);
const schoolDialogName = ref("");
const loading = ref(false);
const error = ref("");
const isAdmin = ref(true);

export function resetAdminStoryState(): void
{
  schools.value = structuredClone(defaultSchools);
  auditLogs.value = structuredClone(defaultAuditLogs);
  schoolDialogOpen.value = false;
  schoolDialogId.value = null;
  schoolDialogName.value = "";
  loading.value = false;
  error.value = "";
  isAdmin.value = true;
}

export function setAdminStoryState(state: {
  loading?: boolean;
  error?: string;
  isAdmin?: boolean;
  schools?: AdminSchool[];
  auditLogs?: AdminAuditLog[];
}): void
{
  if (state.loading !== undefined) loading.value = state.loading;
  if (state.error !== undefined) error.value = state.error;
  if (state.isAdmin !== undefined) isAdmin.value = state.isAdmin;
  if (state.schools) schools.value = structuredClone(state.schools);
  if (state.auditLogs) auditLogs.value = structuredClone(state.auditLogs);
}

export function useAdminManagementState()
{
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

  function submitSchoolDialog(): void
  {
    closeSchoolDialog();
  }

  function removeSchool(_school: AdminSchool): void
  {
    // Storybook mock: no-op
  }

  return {
    auth: {
      user: {
        subject: "admincoach",
        role: "admin" as const,
        logoutUrl: null,
      },
    },
    loading,
    error,
    schools,
    auditLogs,
    schoolDialogOpen,
    schoolDialogId,
    schoolDialogName,
    isAdmin,
    inputClass: "ui-input-blue min-h-[48px] sm:min-h-0 sm:text-sm",
    load: async () => {},
    openCreateSchool,
    openEditSchool,
    closeSchoolDialog,
    submitSchoolDialog,
    removeSchool,
  };
}
