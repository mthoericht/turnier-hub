import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { ref } from "vue";
import AdminSchoolDialog from "@/components/admin/AdminSchoolDialog.vue";

const inputClass = "ui-input-blue min-h-[48px] sm:min-h-0 sm:text-sm";

const meta: Meta<typeof AdminSchoolDialog> = {
  title: "Components/Admin/AdminSchoolDialog",
  component: AdminSchoolDialog,
  args: {
    open: true,
    editingId: null,
    modelValue: "",
    inputClass,
  },
};

export default meta;

type Story = StoryObj<typeof AdminSchoolDialog>;

export const Default: Story = {
  render: (args) => ({
    components: { AdminSchoolDialog },
    setup()
    {
      const value = ref(args.modelValue);
      return { args, value };
    },
    template: `
      <div class="relative min-h-[28rem] w-full bg-slate-100 p-4">
        <AdminSchoolDialog
          :open="args.open"
          :editing-id="args.editingId"
          :model-value="value"
          :input-class="args.inputClass"
          @update:model-value="(next) => (value = next)"
          @close="console.log('close')"
          @submit="console.log('submit', value)"
        />
      </div>
    `,
  }),
};

export const Editing: Story = {
  args: {
    open: true,
    editingId: "school-1",
    modelValue: "BBS Hannover",
    inputClass,
  },
  render: (args) => ({
    components: { AdminSchoolDialog },
    setup()
    {
      const value = ref(args.modelValue);
      return { args, value };
    },
    template: `
      <div class="relative min-h-[28rem] w-full bg-slate-100 p-4">
        <AdminSchoolDialog
          :open="args.open"
          :editing-id="args.editingId"
          :model-value="value"
          :input-class="args.inputClass"
          @update:model-value="(next) => (value = next)"
          @close="console.log('close')"
          @submit="console.log('submit', value)"
        />
      </div>
    `,
  }),
};
