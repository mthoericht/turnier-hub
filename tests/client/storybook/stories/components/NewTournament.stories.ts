import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { ref } from "vue";
import NewTournament from "@/components/tournaments/NewTournament.vue";

const meta: Meta<typeof NewTournament> = {
  title: "Components/Tournaments/NewTournament",
  component: NewTournament,
  args: {
    name: "Schulcup 2026",
    sport: "Fußball",
    mode: "GROUP_KO",
    teamsAreIndividuals: false,
    createT: async () => null,
  },
};

export default meta;

type Story = StoryObj<typeof NewTournament>;

export const Default: Story = {
  parameters: {
    route: "/tournaments",
  },
  render: (args) => ({
    components: { NewTournament },
    setup()
    {
      const nameRef = ref(args.name);
      const sportRef = ref(args.sport);
      const modeRef = ref(args.mode);
      const teamsAreIndividualsRef = ref(args.teamsAreIndividuals);
      return { args, nameRef, sportRef, modeRef, teamsAreIndividualsRef };
    },
    template: `
      <div class="w-full max-w-3xl p-6 ui-card">
        <NewTournament
          v-model:name="nameRef"
          v-model:sport="sportRef"
          v-model:mode="modeRef"
          v-model:teamsAreIndividuals="teamsAreIndividualsRef"
          :create-t="args.createT"
        />
      </div>
    `,
  }),
};

