import type { CreatedBy, Player } from "@/types";
import type { TournamentTeam } from "@/tournament/tournamentContext";

const createdBy: CreatedBy = {
  id: "u-demo",
  username: "lehrer",
  email: "lehrer@schule.example",
};

export const demoPlayers: Player[] = [
  {
    id: "p1",
    name: "Anna Schmidt",
    schoolClass: { id: "c1", name: "7a" },
    createdBy,
  },
  {
    id: "p2",
    name: "Ben Müller",
    schoolClass: { id: "c1", name: "7a" },
    createdBy,
  },
  {
    id: "p3",
    name: "Cleo ohne Klasse",
    schoolClass: null,
    createdBy,
  },
];

export const demoTeamWithMembers: TournamentTeam = {
  id: "team-1",
  name: "Mannschaft Alpha",
  sortOrder: 0,
  groupLabel: "A",
  members: [
    {
      id: "m1",
      tournamentId: "t-demo",
      teamId: "team-1",
      playerId: "p1",
      player: demoPlayers[0],
    },
    {
      id: "m2",
      tournamentId: "t-demo",
      teamId: "team-1",
      playerId: "p2",
      player: demoPlayers[1],
    },
  ],
};

export const demoTeamEmpty: TournamentTeam = {
  id: "team-2",
  name: "Mannschaft Beta",
  sortOrder: 1,
  groupLabel: "A",
  members: [],
};
