import { ref } from "vue";
import type { AdminAuditLog, AdminSchool, AdminUser } from "@/api/adminApi";
import type { UserRole } from "@turnier-hub/shared";

const defaultSchools: AdminSchool[] = [
  { id: "school-1", name: "BBS Hannover", userCount: 8 },
  { id: "school-2", name: "IGS Linden", userCount: 5 },
];

const defaultUsers: AdminUser[] = [
  {
    id: "user-1",
    username: "admincoach",
    email: "admin@example.com",
    role: "admin",
    school: { id: "school-1", name: "BBS Hannover" },
  },
  {
    id: "user-2",
    username: "teamlead",
    email: "teamlead@example.com",
    role: "user",
    school: { id: "school-2", name: "IGS Linden" },
  },
];

const defaultAuditLogs: AdminAuditLog[] = [
  {
    id: "log-1",
    action: "user.role.update",
    targetType: "user",
    targetId: "user-2",
    createdAt: new Date().toISOString(),
    actor: {
      id: "user-1",
      username: "admincoach",
      email: "admin@example.com",
    },
    before: { role: "USER" },
    after: { role: "ADMIN" },
  },
];

const schools = ref<AdminSchool[]>(structuredClone(defaultSchools));
const users = ref<AdminUser[]>(structuredClone(defaultUsers));
const auditLogs = ref<AdminAuditLog[]>(structuredClone(defaultAuditLogs));

const schoolDialogOpen = ref(false);
const schoolDialogId = ref<string | null>(null);
const schoolDialogName = ref("");
const loading = ref(false);
const error = ref("");
const isAdmin = ref(true);
const authUserId = ref<string | undefined>("user-1");

export function resetAdminStoryState(): void
{
  schools.value = structuredClone(defaultSchools);
  users.value = structuredClone(defaultUsers);
  auditLogs.value = structuredClone(defaultAuditLogs);
  schoolDialogOpen.value = false;
  schoolDialogId.value = null;
  schoolDialogName.value = "";
  loading.value = false;
  error.value = "";
  isAdmin.value = true;
  authUserId.value = "user-1";
}

export function setAdminStoryState(state: {
  loading?: boolean;
  error?: string;
  isAdmin?: boolean;
  authUserId?: string | undefined;
  schools?: AdminSchool[];
  users?: AdminUser[];
  auditLogs?: AdminAuditLog[];
}): void
{
  if (state.loading !== undefined) loading.value = state.loading;
  if (state.error !== undefined) error.value = state.error;
  if (state.isAdmin !== undefined) isAdmin.value = state.isAdmin;
  if (state.authUserId !== undefined) authUserId.value = state.authUserId;
  if (state.schools) schools.value = structuredClone(state.schools);
  if (state.users) users.value = structuredClone(state.users);
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

  function updateUserRole(user: AdminUser, role: UserRole): void
  {
    user.role = role;
  }

  function updateUserSchool(user: AdminUser, schoolId: string): void
  {
    const school = schools.value.find((entry) => entry.id === schoolId);
    if (!school)
    {
      return;
    }
    user.school = { id: school.id, name: school.name };
  }

  return {
    auth: {
      user: {
        id: authUserId.value,
      },
    },
    loading,
    error,
    schools,
    users,
    auditLogs,
    schoolDialogOpen,
    schoolDialogId,
    schoolDialogName,
    isAdmin,
    inputClass: "ui-input-blue min-h-[48px] sm:min-h-0 sm:text-sm",
    selectClass: "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-600",
    load: async () => {},
    openCreateSchool,
    openEditSchool,
    closeSchoolDialog,
    submitSchoolDialog,
    removeSchool,
    updateUserRole,
    updateUserSchool,
  };
}
