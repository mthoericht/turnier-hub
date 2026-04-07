import type { Meta, StoryObj } from "@storybook/vue3-vite";
import StorybookRouterCanvas from "../../../StorybookRouterCanvas.vue";
import {
  storyTournamentDirectKoId,
  storyTournamentId,
  storyTournamentIndividualsId,
} from "../../fixtures/tournamentDetailStory";

const meta: Meta<typeof StorybookRouterCanvas> = {
  title: "Views/Tournament/TournamentMatchesOverviewView",
  component: StorybookRouterCanvas,
  parameters: {
    route: `/tournaments/${storyTournamentId}/matches`,
  },
};

export default meta;

type Story = StoryObj<typeof StorybookRouterCanvas>;

export const Default: Story = {};

export const DirectKoFinishedMatch: Story = {
  parameters: {
    route: `/tournaments/${storyTournamentDirectKoId}/matches`,
  },
};

export const IndividualsRoundRobin: Story = {
  parameters: {
    route: `/tournaments/${storyTournamentIndividualsId}/matches`,
  },
};
