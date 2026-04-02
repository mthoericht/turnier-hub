import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { onMounted } from "vue";
import ToastHost from "@/components/ToastHost.vue";
import { useToastStore } from "@/stores/toast";

const meta: Meta<typeof ToastHost> = {
  title: "Common/ToastHost",
  component: ToastHost,
};

export default meta;

type Story = StoryObj<typeof ToastHost>;

export const MitBeispielToasts: Story = {
  render: () => ({
    components: { ToastHost },
    setup()
    {
      const toast = useToastStore();
      onMounted(() =>
      {
        toast.push("Turnier wurde gespeichert.", { variant: "success" });
        toast.push("Bitte alle Pflichtfelder ausfüllen.", { variant: "error" });
        toast.push("Tipp: Spieler unter „Spieler“ anlegen.", { variant: "info" });
      });
      return {};
    },
    template: `
      <div class="relative min-h-[220px] w-full bg-slate-100">
        <p class="p-4 text-sm text-slate-600">
          Toasts erscheinen unten (fixed). Drei Beispiele werden beim Mount angezeigt.
        </p>
        <ToastHost />
      </div>
    `,
  }),
};
