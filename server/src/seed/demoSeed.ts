import bcrypt from "bcryptjs";
import {
  MatchPhase,
  MatchStatus,
  TournamentMode,
  TournamentPhase,
  type PrismaClient,
} from "@prisma/client";
import {
  distributeIntoGroups,
  generateRoundRobinSchedule,
} from "../services/roundRobinSchedule.js";
import { generateKoBracketFirstRound } from "../services/knockoutBracket.js";

export const SEED_EMAIL = "seed@turnier-hub.local";
export const SEED_USERNAME = "seeduser";
export const SEED_PASSWORD = "seedseed12";

export const SEED_PLAYERS: { name: string; className: string }[] = [
  { name: "Lina Müller", className: "10a" },
  { name: "Tom Schneider", className: "10a" },
  { name: "Aylin Yilmaz", className: "10b" },
  { name: "Felix Braun", className: "10b" },
  { name: "Mia Hoffmann", className: "9a" },
  { name: "Jonas Fischer", className: "9a" },
  { name: "Emma Wagner", className: "9b" },
  { name: "Noah Becker", className: "9b" },
  { name: "Sophie Klein", className: "10a" },
  { name: "Lukas Weber", className: "10b" },
  { name: "Hanna Richter", className: "9a" },
  { name: "Max Schwarz", className: "9b" },
];

export async function seedDemoData(prisma: PrismaClient): Promise<void>
{
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: SEED_EMAIL },
    create: {
      email: SEED_EMAIL,
      username: SEED_USERNAME,
      passwordHash,
    },
    update: {
      username: SEED_USERNAME,
      passwordHash,
    },
  });

  await prisma.tournament.deleteMany({ where: { userId: user.id } });
  await prisma.player.deleteMany({ where: { userId: user.id } });
  await prisma.schoolClass.deleteMany({ where: { userId: user.id } });

  const uniqueClassNames = [...new Set(SEED_PLAYERS.map((p) => p.className))];
  const schoolClasses = await Promise.all(
    uniqueClassNames.map((name) =>
      prisma.schoolClass.create({ data: { name, userId: user.id } })
    )
  );
  const classIdByName = Object.fromEntries(
    schoolClasses.map((c) => [c.name, c.id])
  );

  const players = await Promise.all(
    SEED_PLAYERS.map((p) =>
      prisma.player.create({
        data: {
          name: p.name,
          schoolClassId: classIdByName[p.className]!,
          userId: user.id,
        },
      })
    )
  );

  const tGroupKo = await prisma.tournament.create({
    data: {
      name: "Demo: Fußball Schulcup",
      sport: "Fußball",
      mode: TournamentMode.GROUP_KO,
      phase: TournamentPhase.GROUP,
      groupCount: 2,
      advancesPerGroup: 2,
      teamsAreIndividuals: false,
      userId: user.id,
    },
  });

  const gkoTeamNames = [
    "Löwen", "Adler", "Füchse", "Bären",
    "Falken", "Wölfe", "Panther", "Tiger",
  ];
  const gkoTeams = await Promise.all(
    gkoTeamNames.map((name, i) =>
      prisma.tournamentTeam.create({
        data: { tournamentId: tGroupKo.id, name, sortOrder: i },
      })
    )
  );

  const gkoAssignments: [number, number][] = [
    [0, 0], [0, 1],
    [1, 2], [1, 3],
    [2, 4], [2, 5],
    [3, 6], [3, 7],
    [4, 8], [4, 9],
    [5, 10], [5, 11],
    [6, 0],
    [7, 1],
  ];
  const usedInGko = new Set<string>();
  for (const [teamIdx, playerIdx] of gkoAssignments)
  {
    const key = `${tGroupKo.id}:${players[playerIdx]!.id}`;
    if (usedInGko.has(key)) continue;
    usedInGko.add(key);
    await prisma.tournamentTeamMember.create({
      data: {
        tournamentId: tGroupKo.id,
        teamId: gkoTeams[teamIdx]!.id,
        playerId: players[playerIdx]!.id,
      },
    });
  }

  const gkoTeamIds = gkoTeams.map((t) => t.id);
  const groups = distributeIntoGroups(gkoTeamIds, 2);
  for (const group of groups)
  {
    await prisma.tournamentTeam.updateMany({
      where: { id: { in: group.teamIds }, tournamentId: tGroupKo.id },
      data: { groupLabel: group.label },
    });
  }

  let gkoSlot = 0;
  for (const group of groups)
  {
    const schedule = generateRoundRobinSchedule(group.teamIds);
    for (const m of schedule)
    {
      await prisma.match.create({
        data: {
          tournamentId: tGroupKo.id,
          phase: MatchPhase.GROUP,
          groupLabel: group.label,
          roundOrder: m.round,
          slotIndex: gkoSlot++,
          homeTeamId: m.home,
          awayTeamId: m.away,
          status: MatchStatus.SCHEDULED,
        },
      });
    }
  }

  const tDirectKo = await prisma.tournament.create({
    data: {
      name: "Demo: Volleyball K.O.",
      sport: "Volleyball",
      mode: TournamentMode.DIRECT_KO,
      phase: TournamentPhase.QUARTER,
      groupCount: 1,
      advancesPerGroup: 2,
      teamsAreIndividuals: false,
      userId: user.id,
    },
  });

  const dkoTeamNames = [
    "Team Alpha", "Team Beta", "Team Gamma",
    "Team Delta", "Team Epsilon", "Team Zeta",
  ];
  const dkoTeams = await Promise.all(
    dkoTeamNames.map((name, i) =>
      prisma.tournamentTeam.create({
        data: { tournamentId: tDirectKo.id, name, sortOrder: i },
      })
    )
  );

  const dkoResult = generateKoBracketFirstRound(dkoTeams.map((t) => t.id));
  await prisma.tournament.update({
    where: { id: tDirectKo.id },
    data: { phase: dkoResult.tournamentPhase },
  });
  for (const m of dkoResult.matches)
  {
    await prisma.match.create({
      data: {
        tournamentId: tDirectKo.id,
        phase: m.phase,
        roundOrder: m.roundOrder,
        slotIndex: m.roundOrder,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        status: m.awayTeamId === null ? MatchStatus.FINISHED : MatchStatus.SCHEDULED,
      },
    });
  }

  const tRoundRobin = await prisma.tournament.create({
    data: {
      name: "Demo: Badminton Jeder gegen Jeden",
      sport: "Badminton",
      mode: TournamentMode.ROUND_ROBIN,
      phase: TournamentPhase.GROUP,
      groupCount: 1,
      advancesPerGroup: 1,
      teamsAreIndividuals: true,
      userId: user.id,
    },
  });

  const rrPlayerSubset = players.slice(0, 5);
  const rrTeams = await Promise.all(
    rrPlayerSubset.map((p, i) =>
      prisma.tournamentTeam.create({
        data: { tournamentId: tRoundRobin.id, name: p.name, sortOrder: i },
      })
    )
  );
  for (let i = 0; i < rrTeams.length; i++)
  {
    await prisma.tournamentTeamMember.create({
      data: {
        tournamentId: tRoundRobin.id,
        teamId: rrTeams[i]!.id,
        playerId: rrPlayerSubset[i]!.id,
      },
    });
  }
  const rrSchedule = generateRoundRobinSchedule(rrTeams.map((t) => t.id));
  let rrSlot = 0;
  for (const m of rrSchedule)
  {
    await prisma.match.create({
      data: {
        tournamentId: tRoundRobin.id,
        phase: MatchPhase.GROUP,
        roundOrder: m.round,
        slotIndex: rrSlot++,
        homeTeamId: m.home,
        awayTeamId: m.away,
        status: MatchStatus.SCHEDULED,
      },
    });
  }

  const tDirectKo15 = await prisma.tournament.create({
    data: {
      name: "Demo: Direkt K.O. mit 15 Mannschaften",
      sport: "Fußball",
      mode: TournamentMode.DIRECT_KO,
      phase: TournamentPhase.ROUND_OF_16,
      groupCount: 1,
      advancesPerGroup: 1,
      teamsAreIndividuals: false,
      userId: user.id,
    },
  });

  const dko15TeamNames = [
    "Team 01", "Team 02", "Team 03", "Team 04", "Team 05",
    "Team 06", "Team 07", "Team 08", "Team 09", "Team 10",
    "Team 11", "Team 12", "Team 13", "Team 14", "Team 15",
  ];
  const dko15Teams = await Promise.all(
    dko15TeamNames.map((name, i) =>
      prisma.tournamentTeam.create({
        data: { tournamentId: tDirectKo15.id, name, sortOrder: i },
      })
    )
  );

  const dko15Result = generateKoBracketFirstRound(dko15Teams.map((t) => t.id));
  await prisma.tournament.update({
    where: { id: tDirectKo15.id },
    data: { phase: dko15Result.tournamentPhase },
  });
  for (const m of dko15Result.matches)
  {
    await prisma.match.create({
      data: {
        tournamentId: tDirectKo15.id,
        phase: m.phase,
        roundOrder: m.roundOrder,
        slotIndex: m.roundOrder,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        status: m.awayTeamId === null ? MatchStatus.FINISHED : MatchStatus.SCHEDULED,
      },
    });
  }
}
