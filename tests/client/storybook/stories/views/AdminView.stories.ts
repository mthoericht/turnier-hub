import type { Meta, StoryObj } from "@storybook/vue3-vite";
import AdminView from "@/views/AdminView.vue";
import {
  resetAdminStoryState,
  setAdminStoryState,
} from "@/composables/admin/useAdminManagementState";

const meta: Meta<typeof AdminView> = {
  title: "Views/AdminView",
  component: AdminView,
};

export default meta;

type Story = StoryObj<typeof AdminView>;

function createManyAuditLogs(count: number)
{
  return Array.from({ length: count }, (_, index) => ({
    id: `log-${index + 1}`,
    action: index % 2 === 0 ? "user.role.update" : "school.update",
    targetType: index % 2 === 0 ? "user" : "school",
    targetId: index % 2 === 0 ? `user-${(index % 4) + 1}` : `school-${(index % 3) + 1}`,
    createdAt: new Date(Date.UTC(2026, 3, 27, 8, index)).toISOString(),
    actor: {
      id: "user-1",
      username: "admincoach",
      email: "admin@example.com",
    },
    before: index % 2 === 0 ? { role: "USER" } : { name: `School ${index + 1}` },
    after: index % 2 === 0 ? { role: "ADMIN" } : { name: `School ${index + 1} Updated` },
  }));
}

function buildStory(state: Parameters<typeof setAdminStoryState>[0]): Story
{
  return {
    render: () =>
    {
      resetAdminStoryState();
      setAdminStoryState(state);
      return {
        components: { AdminView },
        template: `<AdminView />`,
      };
    },
  };
}

export const Default: Story = buildStory({});

export const Loading: Story = buildStory({
  loading: true,
});

export const Error: Story = buildStory({
  error: "Admin-Daten konnten nicht geladen werden",
});

export const NonAdmin: Story = buildStory({
  isAdmin: false,
  authUserId: "user-2",
});

export const ManyAuditLogs: Story = buildStory({
  auditLogs: createManyAuditLogs(30),
});
