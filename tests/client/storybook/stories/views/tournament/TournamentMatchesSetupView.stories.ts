import type { Meta, StoryObj } from "@storybook/vue3-vite";
import StorybookRouterCanvas from "../../../StorybookRouterCanvas.vue";
import {
  storyTournamentDirectKoId,
  storyTournamentId,
  storyTournamentIndividualsId,
} from "../../fixtures/tournamentDetailStory";

const meta: Meta<typeof StorybookRouterCanvas> = {
  title: "Views/Tournament/TournamentMatchesSetupView",
  component: StorybookRouterCanvas,
  parameters: {
    route: `/tournaments/${storyTournamentId}/matches/setup`,
  },
};

export default meta;

type Story = StoryObj<typeof StorybookRouterCanvas>;

export const Default: Story = {};

export const DirectKoMode: Story = {
  parameters: {
    route: `/tournaments/${storyTournamentDirectKoId}/matches/setup`,
  },
};

export const RoundRobinMode: Story = {
  parameters: {
    route: `/tournaments/${storyTournamentIndividualsId}/matches/setup`,
  },
};
