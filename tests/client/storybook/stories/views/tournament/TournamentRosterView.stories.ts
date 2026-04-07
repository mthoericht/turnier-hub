import type { Meta, StoryObj } from "@storybook/vue3-vite";
import StorybookRouterCanvas from "../../../StorybookRouterCanvas.vue";
import {
  storyTournamentId,
  storyTournamentIndividualsId,
} from "../../fixtures/tournamentDetailStory";

const meta: Meta<typeof StorybookRouterCanvas> = {
  title: "Views/Tournament/TournamentRosterView",
  component: StorybookRouterCanvas,
  parameters: {
    route: `/tournaments/${storyTournamentId}/roster`,
  },
};

export default meta;

type Story = StoryObj<typeof StorybookRouterCanvas>;

export const Default: Story = {};

export const IndividualsMode: Story = {
  parameters: {
    route: `/tournaments/${storyTournamentIndividualsId}/roster`,
  },
};
