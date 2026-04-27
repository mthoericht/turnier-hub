import type { Meta, StoryObj } from "@storybook/vue3-vite";
import PlayersViewPreset from "@/views/PlayersViewPreset.vue";
import {
  resetPlayersStoryState,
  setPlayersStoryState,
} from "@/composables/players/usePlayersManagementState";
import type { Player } from "@turnier-hub/shared";

const meta: Meta<typeof PlayersViewPreset> = {
  title: "Views/PlayersViewPreset",
  component: PlayersViewPreset,
};

export default meta;

type Story = StoryObj<typeof PlayersViewPreset>;

const populatedPlayers: Player[] = [
  {
    id: "player-1",
    firstName: "Lina",
    lastName: "Meyer",
    schoolClass: { id: "class-1", name: "10a" },
    createdBy: {
      id: "user-1",
      username: "coach",
      email: "coach@example.com",
    },
  },
  {
    id: "player-2",
    firstName: "Tom",
    lastName: "Schulz",
    schoolClass: { id: "class-2", name: "9b" },
    createdBy: {
      id: "user-2",
      username: "teacher",
      email: "teacher@example.com",
    },
  },
];

function buildStory(players: Player[]): Story
{
  return {
    parameters: {
      route: "/players",
    },
    render: () =>
    {
      resetPlayersStoryState();
      setPlayersStoryState({ players });
      return {
        components: { PlayersViewPreset },
        template: `<PlayersViewPreset />`,
      };
    },
  };
}

export const Default: Story = buildStory(populatedPlayers);

export const Empty: Story = buildStory([]);

