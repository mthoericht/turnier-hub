import type { Meta, StoryObj } from "@storybook/vue3-vite";
import AdminUsersSection from "@/components/admin/AdminUsersSection.vue";
import type { AdminSchool, AdminUser } from "@/api/adminApi";

const demoSchools: AdminSchool[] = [
  { id: "s1", name: "BBS Hannover", userCount: 12 },
  { id: "s2", name: "IGS Linden", userCount: 7 },
];

const demoUsers: AdminUser[] = [
  {
    id: "u1",
    username: "admincoach",
    email: "admin@example.com",
    role: "admin",
    school: { id: "s1", name: "BBS Hannover" },
  },
  {
    id: "u2",
    username: "teamlead",
    email: "lead@example.com",
    role: "user",
    school: { id: "s2", name: "IGS Linden" },
  },
];

const meta: Meta<typeof AdminUsersSection> = {
  title: "Components/Admin/AdminUsersSection",
  component: AdminUsersSection,
  args: {
    users: demoUsers,
    schools: demoSchools,
    selectClass: "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-600",
    currentUserId: "u1",
  },
};

export default meta;

type Story = StoryObj<typeof AdminUsersSection>;

export const Default: Story = {
  render: (args) => ({
    components: { AdminUsersSection },
    setup()
    {
      return { args };
    },
    template: `
      <div class="mx-auto w-full max-w-5xl p-4">
        <AdminUsersSection
          v-bind="args"
          @update-user-school="(payload) => console.log('update-user-school', payload)"
          @update-user-role="(payload) => console.log('update-user-role', payload)"
        />
      </div>
    `,
  }),
};

export const Empty: Story = {
  args: {
    users: [],
  },
  render: (args) => ({
    components: { AdminUsersSection },
    setup()
    {
      return { args };
    },
    template: `
      <div class="mx-auto w-full max-w-5xl p-4">
        <AdminUsersSection
          v-bind="args"
          @update-user-school="(payload) => console.log('update-user-school', payload)"
          @update-user-role="(payload) => console.log('update-user-role', payload)"
        />
      </div>
    `,
  }),
};
