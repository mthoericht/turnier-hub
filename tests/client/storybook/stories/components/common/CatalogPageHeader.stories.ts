import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { ref } from "vue";
import CatalogPageHeader from "@/components/common/CatalogPageHeader.vue";
import ScopeToggle from "@/components/common/ScopeToggle.vue";

const meta: Meta<typeof CatalogPageHeader> = {
  title: "Components/Common/CatalogPageHeader",
  component: CatalogPageHeader,
  args: {
    title: "Turniere",
    variant: "catalog",
  },
};

export default meta;

type Story = StoryObj<typeof CatalogPageHeader>;

export const Default: Story = {
  render: (args) => ({
    components: { CatalogPageHeader, ScopeToggle },
    setup()
    {
      const scope = ref<"all" | "own">("all");
      return { args, scope };
    },
    template: `
      <div class="mx-auto w-full max-w-5xl rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <CatalogPageHeader v-bind="args">
          <template #actions>
            <ScopeToggle v-model="scope" />
            <button type="button" class="ui-btn-primary-blue">
              + Neues Turnier
            </button>
          </template>
        </CatalogPageHeader>
      </div>
    `,
  }),
};

export const WithDescription: Story = {
  args: {
    title: "Klassen",
    variant: "catalog",
  },
  render: (args) => ({
    components: { CatalogPageHeader, ScopeToggle },
    setup()
    {
      const scope = ref<"all" | "own">("all");
      return { args, scope };
    },
    template: `
      <div class="mx-auto w-full max-w-5xl rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <CatalogPageHeader v-bind="args">
          <template #description>
            <p class="text-sm text-slate-600">
              Schulklassen im gemeinsamen Katalog. Beim Anlegen von Spielern kann
              jede Klasse zugewiesen werden.
            </p>
          </template>
          <template #actions>
            <ScopeToggle v-model="scope" />
            <button type="button" class="ui-btn-primary-blue">
              + Neue Klasse
            </button>
          </template>
        </CatalogPageHeader>
      </div>
    `,
  }),
};

export const Hero: Story = {
  args: {
    title: "Dashboard",
    variant: "hero",
  },
  render: (args) => ({
    components: { CatalogPageHeader },
    setup()
    {
      return { args };
    },
    template: `
      <div class="mx-auto w-full max-w-5xl space-y-8 rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <CatalogPageHeader v-bind="args">
          <template #description>
            <p class="text-slate-600">
              Übersicht über Klassen, Spieler und deine Turniere
            </p>
          </template>
          <template #actions>
            <a
              class="ui-btn-primary-blue inline-flex shrink-0 items-center justify-center no-underline"
              href="#"
              @click.prevent
            >
              + Neues Turnier
            </a>
          </template>
        </CatalogPageHeader>
        <p class="text-sm text-slate-500">Darunter folgt der Seiteninhalt (Abstand via space-y-8).</p>
      </div>
    `,
  }),
};
