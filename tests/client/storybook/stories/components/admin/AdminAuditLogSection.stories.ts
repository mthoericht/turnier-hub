import type { Meta, StoryObj } from "@storybook/vue3-vite";
import AdminAuditLogSection from "@/components/admin/AdminAuditLogSection.vue";
import type { AdminAuditLog } from "@/api/adminApi";

const demoLogs: AdminAuditLog[] = [
  {
    id: "log-1",
    action: "user.role.update",
    targetType: "user",
    targetId: "user-2",
    createdAt: new Date("2026-04-27T09:30:00.000Z").toISOString(),
    actor: {
      id: "user-1",
      username: "admincoach",
      email: "admin@example.com",
    },
    before: { role: "USER" },
    after: { role: "ADMIN" },
  },
  {
    id: "log-2",
    action: "school.update",
    targetType: "school",
    targetId: "school-1",
    createdAt: new Date("2026-04-27T10:15:00.000Z").toISOString(),
    actor: {
      id: "user-1",
      username: "admincoach",
      email: "admin@example.com",
    },
    before: { name: "BBS Alt" },
    after: { name: "BBS Hannover" },
  },
];

const meta: Meta<typeof AdminAuditLogSection> = {
  title: "Components/Admin/AdminAuditLogSection",
  component: AdminAuditLogSection,
  args: {
    logs: demoLogs,
  },
};

export default meta;

type Story = StoryObj<typeof AdminAuditLogSection>;

export const Default: Story = {
  render: (args) => ({
    components: { AdminAuditLogSection },
    setup()
    {
      return { args };
    },
    template: `
      <div class="mx-auto w-full max-w-5xl p-4">
        <AdminAuditLogSection v-bind="args" />
      </div>
    `,
  }),
};

export const Empty: Story = {
  args: {
    logs: [],
  },
  render: (args) => ({
    components: { AdminAuditLogSection },
    setup()
    {
      return { args };
    },
    template: `
      <div class="mx-auto w-full max-w-5xl p-4">
        <AdminAuditLogSection v-bind="args" />
      </div>
    `,
  }),
};
