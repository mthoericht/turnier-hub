import type { Meta, StoryObj } from "@storybook/vue3-vite";
import TournamentStandingsTable from "@/components/tournament/TournamentStandingsTable.vue";
import type { StandingTeamRow } from "@/tournament/tournamentContext";

const groupA: StandingTeamRow[] = [
  {
    teamId: "t1",
    team: { id: "t1", name: "7a Fußball" },
    played: 3,
    wins: 2,
    draws: 1,
    losses: 0,
    goalsFor: 6,
    goalsAgainst: 2,
    points: 7,
  },
  {
    teamId: "t2",
    team: { id: "t2", name: "7b Fußball" },
    played: 3,
    wins: 1,
    draws: 1,
    losses: 1,
    goalsFor: 4,
    goalsAgainst: 4,
    points: 4,
  },
  {
    teamId: "t3",
    team: { id: "t3", name: "8a Fußball" },
    played: 3,
    wins: 0,
    draws: 0,
    losses: 3,
    goalsFor: 1,
    goalsAgainst: 5,
    points: 0,
  },
];

const meta: Meta<typeof TournamentStandingsTable> = {
  title: "Tournament/TournamentStandingsTable",
  component: TournamentStandingsTable,
  args: {
    standingsGroups: { A: groupA },
    cardClass: "ui-card p-4",
  },
};

export default meta;

type Story = StoryObj<typeof TournamentStandingsTable>;

export const EineGruppe: Story = {
  render: (args) => ({
    components: { TournamentStandingsTable },
    setup()
    {
      return { args };
    },
    template: `
      <div class="max-w-3xl p-4">
        <TournamentStandingsTable v-bind="args" />
      </div>
    `,
  }),
};

export const ZweiGruppen: Story = {
  args: {
    standingsGroups: {
      A: groupA,
      B: [
        {
          teamId: "t4",
          team: { id: "t4", name: "Team Nord" },
          played: 2,
          wins: 2,
          draws: 0,
          losses: 0,
          goalsFor: 5,
          goalsAgainst: 0,
          points: 6,
        },
        {
          teamId: "t5",
          team: { id: "t5", name: "Team Süd" },
          played: 2,
          wins: 0,
          draws: 0,
          losses: 2,
          goalsFor: 0,
          goalsAgainst: 5,
          points: 0,
        },
      ],
    },
  },
  render: (args) => ({
    components: { TournamentStandingsTable },
    setup()
    {
      return { args };
    },
    template: `
      <div class="max-w-4xl p-4">
        <TournamentStandingsTable v-bind="args" />
      </div>
    `,
  }),
};
