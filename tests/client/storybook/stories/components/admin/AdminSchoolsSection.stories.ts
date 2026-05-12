import type { Meta, StoryObj } from "@storybook/vue3-vite";
import AdminSchoolsSection from "@/components/admin/AdminSchoolsSection.vue";
import type { AdminSchool } from "@/api/adminApi";

const demoSchools: AdminSchool[] = [
  { id: "s1", name: "BBS Hannover", catalogCount: 12 },
  { id: "s2", name: "IGS Linden", catalogCount: 7 },
  { id: "s3", name: "Gymnasium Nord", catalogCount: 3 },
];

const meta: Meta<typeof AdminSchoolsSection> = {
  title: "Components/Admin/AdminSchoolsSection",
  component: AdminSchoolsSection,
  args: {
    schools: demoSchools,
  },
};

export default meta;

type Story = StoryObj<typeof AdminSchoolsSection>;

export const Default: Story = {
  render: (args) => ({
    components: { AdminSchoolsSection },
    setup()
    {
      return { args };
    },
    template: `
      <div class="mx-auto w-full max-w-5xl p-4">
        <AdminSchoolsSection
          v-bind="args"
          @create-school="console.log('create-school')"
          @edit-school="(school) => console.log('edit-school', school)"
          @remove-school="(school) => console.log('remove-school', school)"
        />
      </div>
    `,
  }),
};

export const Empty: Story = {
  args: {
    schools: [],
  },
  render: (args) => ({
    components: { AdminSchoolsSection },
    setup()
    {
      return { args };
    },
    template: `
      <div class="mx-auto w-full max-w-5xl p-4">
        <AdminSchoolsSection
          v-bind="args"
          @create-school="console.log('create-school')"
          @edit-school="(school) => console.log('edit-school', school)"
          @remove-school="(school) => console.log('remove-school', school)"
        />
      </div>
    `,
  }),
};
