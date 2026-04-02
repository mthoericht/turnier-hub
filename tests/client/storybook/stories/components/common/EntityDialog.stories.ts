import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { fn } from "storybook/test";
import EntityDialog from "@/components/common/EntityDialog.vue";

const meta: Meta<typeof EntityDialog> = {
  title: "Components/Common/EntityDialog",
  component: EntityDialog,
  args: {
    open: true,
    title: "Eintrag löschen?",
    description: "Diese Aktion kann nicht rückgängig gemacht werden.",
    submitLabel: "Löschen",
    submitDisabled: false,
    onClose: fn(),
    onSubmit: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof EntityDialog>;

export const Default: Story = {
  render: (args) => ({
    components: { EntityDialog },
    setup()
    {
      return { args };
    },
    template: `
      <EntityDialog
        v-bind="args"
        @close="args.onClose"
        @submit="args.onSubmit"
      >
        <p class="text-sm text-slate-600">
          Beispiel-Inhalt im Dialog.
        </p>
      </EntityDialog>
    `,
  }),
};
