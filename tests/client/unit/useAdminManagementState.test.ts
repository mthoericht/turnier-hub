/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import type { AdminSchool, AdminUser } from "../../../client/src/api/adminApi";

const fetchAdminSchoolsMock = vi.fn<() => Promise<AdminSchool[]>>();
const fetchAdminUsersMock = vi.fn<() => Promise<AdminUser[]>>();
const fetchAdminAuditLogsMock = vi.fn();
const postAdminSchoolMock = vi.fn();
const patchAdminSchoolMock = vi.fn();
const deleteAdminSchoolMock = vi.fn();
const patchAdminUserRoleMock = vi.fn();
const patchAdminUserSchoolMock = vi.fn();
const requestConfirmMock = vi.fn();
const showSuccessMock = vi.fn();
const showErrorMock = vi.fn();

const authStore: { user: { id: string; role: "admin" | "user" } | null } = {
  user: { id: "admin-1", role: "admin" },
};

vi.mock("../../../client/src/api/adminApi", () => ({
  fetchAdminSchools: fetchAdminSchoolsMock,
  fetchAdminUsers: fetchAdminUsersMock,
  fetchAdminAuditLogs: fetchAdminAuditLogsMock,
  postAdminSchool: postAdminSchoolMock,
  patchAdminSchool: patchAdminSchoolMock,
  deleteAdminSchool: deleteAdminSchoolMock,
  patchAdminUserRole: patchAdminUserRoleMock,
  patchAdminUserSchool: patchAdminUserSchoolMock,
}));

vi.mock("../../../client/src/stores/auth", () => ({
  useAuthStore: () => authStore,
}));

vi.mock("../../../client/src/stores/confirmDialog", () => ({
  useConfirmDialogStore: () => ({
    requestConfirm: requestConfirmMock,
  }),
}));

vi.mock("../../../client/src/stores/toast", () => ({
  useToastStore: () => ({
    showSuccess: showSuccessMock,
    showError: showErrorMock,
  }),
}));

async function flushMicrotasks(rounds = 3): Promise<void>
{
  for (let i = 0; i < rounds; i += 1)
  {
    await Promise.resolve();
  }
}

describe("useAdminManagementState", () =>
{
  beforeEach(() =>
  {
    authStore.user = { id: "admin-1", role: "admin" };
    fetchAdminSchoolsMock.mockResolvedValue([
      { id: "s1", name: "School 1", userCount: 1 },
    ]);
    fetchAdminUsersMock.mockResolvedValue([
      {
        id: "u1",
        username: "admin",
        email: "admin@example.com",
        role: "admin",
        school: { id: "s1", name: "School 1" },
      },
    ]);
    fetchAdminAuditLogsMock.mockResolvedValue([
      {
        id: "l1",
        action: "user.role.update",
        targetType: "user",
        targetId: "u1",
        createdAt: new Date().toISOString(),
        actor: {
          id: "u1",
          username: "admin",
          email: "admin@example.com",
        },
        before: null,
        after: null,
      },
    ]);
    requestConfirmMock.mockResolvedValue(true);
    postAdminSchoolMock.mockResolvedValue(undefined);
    patchAdminSchoolMock.mockResolvedValue(undefined);
    deleteAdminSchoolMock.mockResolvedValue(undefined);
    patchAdminUserRoleMock.mockResolvedValue(undefined);
    patchAdminUserSchoolMock.mockResolvedValue(undefined);
    showSuccessMock.mockReset();
    showErrorMock.mockReset();
  });

  afterEach(() =>
  {
    vi.clearAllMocks();
  });

  it("loads admin schools and users on mount for admins", async () =>
  {
    let exposed!: ReturnType<typeof import("../../../client/src/composables/admin/useAdminManagementState").useAdminManagementState>;
    const { useAdminManagementState } = await import("../../../client/src/composables/admin/useAdminManagementState");

    mount(defineComponent({
      setup()
      {
        exposed = useAdminManagementState();
        return () => null;
      },
    }));
    await nextTick();
    await flushMicrotasks();

    expect(fetchAdminSchoolsMock).toHaveBeenCalledOnce();
    expect(fetchAdminUsersMock).toHaveBeenCalledOnce();
    expect(fetchAdminAuditLogsMock).toHaveBeenCalledOnce();
    expect(exposed.loading.value).toBe(false);
    expect(exposed.schools.value).toHaveLength(1);
    expect(exposed.users.value).toHaveLength(1);
  });

  it("skips initial loading for non-admins", async () =>
  {
    authStore.user = { id: "u2", role: "user" };
    let exposed!: ReturnType<typeof import("../../../client/src/composables/admin/useAdminManagementState").useAdminManagementState>;
    const { useAdminManagementState } = await import("../../../client/src/composables/admin/useAdminManagementState");

    mount(defineComponent({
      setup()
      {
        exposed = useAdminManagementState();
        return () => null;
      },
    }));
    await nextTick();
    await flushMicrotasks();

    expect(fetchAdminSchoolsMock).not.toHaveBeenCalled();
    expect(fetchAdminUsersMock).not.toHaveBeenCalled();
    expect(fetchAdminAuditLogsMock).not.toHaveBeenCalled();
    expect(exposed.loading.value).toBe(false);
  });

  it("creates a school via submitSchoolDialog", async () =>
  {
    let exposed!: ReturnType<typeof import("../../../client/src/composables/admin/useAdminManagementState").useAdminManagementState>;
    const { useAdminManagementState } = await import("../../../client/src/composables/admin/useAdminManagementState");

    mount(defineComponent({
      setup()
      {
        exposed = useAdminManagementState();
        return () => null;
      },
    }));
    await flushMicrotasks();

    exposed.openCreateSchool();
    exposed.schoolDialogName.value = "  New School  ";
    await exposed.submitSchoolDialog();

    expect(postAdminSchoolMock).toHaveBeenCalledWith({ name: "New School" });
    expect(showSuccessMock).toHaveBeenCalledWith("Schule angelegt");
    expect(exposed.schoolDialogOpen.value).toBe(false);
  });

  it("does not delete school when confirm dialog returns false", async () =>
  {
    requestConfirmMock.mockResolvedValue(false);
    let exposed!: ReturnType<typeof import("../../../client/src/composables/admin/useAdminManagementState").useAdminManagementState>;
    const { useAdminManagementState } = await import("../../../client/src/composables/admin/useAdminManagementState");

    mount(defineComponent({
      setup()
      {
        exposed = useAdminManagementState();
        return () => null;
      },
    }));
    await flushMicrotasks();

    await exposed.removeSchool({ id: "s1", name: "School 1", userCount: 1 });
    expect(deleteAdminSchoolMock).not.toHaveBeenCalled();
  });

  it("skips role update when role is unchanged", async () =>
  {
    let exposed!: ReturnType<typeof import("../../../client/src/composables/admin/useAdminManagementState").useAdminManagementState>;
    const { useAdminManagementState } = await import("../../../client/src/composables/admin/useAdminManagementState");

    mount(defineComponent({
      setup()
      {
        exposed = useAdminManagementState();
        return () => null;
      },
    }));
    await flushMicrotasks();

    const user: AdminUser = {
      id: "u1",
      username: "admin",
      email: "admin@example.com",
      role: "admin",
      school: { id: "s1", name: "School 1" },
    };
    await exposed.updateUserRole(user, "admin");
    expect(patchAdminUserRoleMock).not.toHaveBeenCalled();
  });

  it("handles school submit errors with error toast", async () =>
  {
    postAdminSchoolMock.mockRejectedValue(new Error("save failed"));
    let exposed!: ReturnType<typeof import("../../../client/src/composables/admin/useAdminManagementState").useAdminManagementState>;
    const { useAdminManagementState } = await import("../../../client/src/composables/admin/useAdminManagementState");

    mount(defineComponent({
      setup()
      {
        exposed = useAdminManagementState();
        return () => null;
      },
    }));
    await flushMicrotasks();

    exposed.openCreateSchool();
    exposed.schoolDialogName.value = "School X";
    await exposed.submitSchoolDialog();

    expect(exposed.error.value).toBe("save failed");
    expect(showErrorMock).toHaveBeenCalledWith("save failed");
  });

  it("handles delete errors with error toast", async () =>
  {
    deleteAdminSchoolMock.mockRejectedValue(new Error("delete failed"));
    requestConfirmMock.mockResolvedValue(true);
    let exposed!: ReturnType<typeof import("../../../client/src/composables/admin/useAdminManagementState").useAdminManagementState>;
    const { useAdminManagementState } = await import("../../../client/src/composables/admin/useAdminManagementState");

    mount(defineComponent({
      setup()
      {
        exposed = useAdminManagementState();
        return () => null;
      },
    }));
    await flushMicrotasks();

    await exposed.removeSchool({ id: "s1", name: "School 1", userCount: 1 });
    expect(exposed.error.value).toBe("delete failed");
    expect(showErrorMock).toHaveBeenCalledWith("delete failed");
  });

  it("handles user update errors with error toast", async () =>
  {
    patchAdminUserSchoolMock.mockRejectedValue(new Error("assignment failed"));
    patchAdminUserRoleMock.mockRejectedValue(new Error("role failed"));
    let exposed!: ReturnType<typeof import("../../../client/src/composables/admin/useAdminManagementState").useAdminManagementState>;
    const { useAdminManagementState } = await import("../../../client/src/composables/admin/useAdminManagementState");

    mount(defineComponent({
      setup()
      {
        exposed = useAdminManagementState();
        return () => null;
      },
    }));
    await flushMicrotasks();

    const user: AdminUser = {
      id: "u1",
      username: "admin",
      email: "admin@example.com",
      role: "admin",
      school: { id: "s1", name: "School 1" },
    };
    await exposed.updateUserSchool(user, "s2");
    expect(exposed.error.value).toBe("assignment failed");
    expect(showErrorMock).toHaveBeenCalledWith("assignment failed");

    await exposed.updateUserRole(user, "user");
    expect(exposed.error.value).toBe("role failed");
    expect(showErrorMock).toHaveBeenCalledWith("role failed");
  });

  it("uses fallback messages when thrown value is not an Error", async () =>
  {
    // Simulate a non-Error rejection (some clients may reject plain values).
    const NON_ERROR_THROWN = "non-error-thrown";
    fetchAdminSchoolsMock.mockRejectedValue(NON_ERROR_THROWN);
    let exposed!: ReturnType<typeof import("../../../client/src/composables/admin/useAdminManagementState").useAdminManagementState>;
    const { useAdminManagementState } = await import("../../../client/src/composables/admin/useAdminManagementState");

    mount(defineComponent({
      setup()
      {
        exposed = useAdminManagementState();
        return () => null;
      },
    }));
    await flushMicrotasks();
    expect(exposed.error.value).toBe("Admin-Daten konnten nicht geladen werden");

    postAdminSchoolMock.mockRejectedValue(NON_ERROR_THROWN);
    exposed.openCreateSchool();
    exposed.schoolDialogName.value = "School X";
    await exposed.submitSchoolDialog();
    expect(exposed.error.value).toBe("Schule konnte nicht gespeichert werden");

    requestConfirmMock.mockResolvedValue(true);
    deleteAdminSchoolMock.mockRejectedValue(NON_ERROR_THROWN);
    await exposed.removeSchool({ id: "s1", name: "School 1", userCount: 1 });
    expect(exposed.error.value).toBe("Schule konnte nicht gelöscht werden");

    const user: AdminUser = {
      id: "u1",
      username: "admin",
      email: "admin@example.com",
      role: "admin",
      school: { id: "s1", name: "School 1" },
    };
    patchAdminUserRoleMock.mockRejectedValue(NON_ERROR_THROWN);
    await exposed.updateUserRole(user, "user");
    expect(exposed.error.value).toBe("Rechte konnten nicht aktualisiert werden");

    patchAdminUserSchoolMock.mockRejectedValue(NON_ERROR_THROWN);
    await exposed.updateUserSchool(user, "s2");
    expect(exposed.error.value).toBe("Schulzuweisung konnte nicht gespeichert werden");
  });
});
