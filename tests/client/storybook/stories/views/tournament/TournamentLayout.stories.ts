import type { Meta, StoryObj } from "@storybook/vue3-vite";
import StorybookRouterCanvas from "../../../StorybookRouterCanvas.vue";
import {
  storyTournamentDirectKoId,
  storyTournamentId,
  storyTournamentIndividualsId,
} from "../../fixtures/tournamentDetailStory";

const meta: Meta<typeof StorybookRouterCanvas> = {
  title: "Views/Tournament/TournamentLayout",
  component: StorybookRouterCanvas,
  parameters: {
    route: {
      name: "tournament-detail",
      params: { id: storyTournamentId },
    },
  },
};

export default meta;

type Story = StoryObj<typeof StorybookRouterCanvas>;

/** Resolves to Mannschaften (roster) via the empty-path redirect, same as the app router. */
export const Default: Story = {};

export const Individuals: Story = {
  parameters: {
    route: {
      name: "tournament-detail",
      params: { id: storyTournamentIndividualsId },
    },
  },
};

export const DirectKo: Story = {
  parameters: {
    route: {
      name: "tournament-detail",
      params: { id: storyTournamentDirectKoId },
    },
  },
};
