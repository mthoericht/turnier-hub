import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import {
  PrismaClient,
  MatchPhase,
  MatchStatus,
  TournamentPhase,
} from "@prisma/client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.DATABASE_URL) {
  config({ path: path.join(root, ".env") });
}

const prisma = new PrismaClient();

const SEED_EMAIL = "seed@turnier-hub.local";
const SEED_USERNAME = "seeduser";
const SEED_PASSWORD = "seedseed12";

const TOURNAMENT_NAME = "Demo: Fußball Schulcup";

/** 8 Spieler im Kader von vier Mannschaften (eine Vorrunde, alle gegen alle). */
const SEED_PLAYERS: { name: string; className: string }[] = [
  { name: "Lina Müller", className: "10a" },
  { name: "Tom Schneider", className: "10a" },
  { name: "Aylin Yilmaz", className: "10b" },
  { name: "Felix Braun", className: "10b" },
  { name: "Mia Hoffmann", className: "9a" },
  { name: "Jonas Fischer", className: "9a" },
  { name: "Emma Wagner", className: "9b" },
  { name: "Noah Becker", className: "9b" },
];

async function main(): Promise<void> {
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

  const tournament = await prisma.tournament.create({
    data: {
      name: TOURNAMENT_NAME,
      sport: "Fußball",
      phase: TournamentPhase.GROUP,
      advancesPerGroup: 4,
      userId: user.id,
    },
  });

  const teamA1 = await prisma.tournamentTeam.create({
    data: {
      tournamentId: tournament.id,
      name: "Mannschaft A1",
      sortOrder: 0,
    },
  });
  const teamA2 = await prisma.tournamentTeam.create({
    data: {
      tournamentId: tournament.id,
      name: "Mannschaft A2",
      sortOrder: 1,
    },
  });
  const teamB1 = await prisma.tournamentTeam.create({
    data: {
      tournamentId: tournament.id,
      name: "Mannschaft B1",
      sortOrder: 2,
    },
  });
  const teamB2 = await prisma.tournamentTeam.create({
    data: {
      tournamentId: tournament.id,
      name: "Mannschaft B2",
      sortOrder: 3,
    },
  });

  const uniqueClassNames = [...new Set(SEED_PLAYERS.map((p) => p.className))];
  const schoolClasses = await Promise.all(
    uniqueClassNames.map((name) =>
      prisma.schoolClass.create({
        data: { name, userId: user.id },
      })
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

  const assignments: { teamId: string; playerIndex: number }[] = [
    { teamId: teamA1.id, playerIndex: 0 },
    { teamId: teamA1.id, playerIndex: 1 },
    { teamId: teamA2.id, playerIndex: 2 },
    { teamId: teamA2.id, playerIndex: 3 },
    { teamId: teamB1.id, playerIndex: 4 },
    { teamId: teamB1.id, playerIndex: 5 },
    { teamId: teamB2.id, playerIndex: 6 },
    { teamId: teamB2.id, playerIndex: 7 },
  ];

  for (const a of assignments) {
    await prisma.tournamentTeamMember.create({
      data: {
        tournamentId: tournament.id,
        teamId: a.teamId,
        playerId: players[a.playerIndex]!.id,
      },
    });
  }

  const teamIds = [teamA1.id, teamA2.id, teamB1.id, teamB2.id];
  let slot = 0;
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      await prisma.match.create({
        data: {
          tournamentId: tournament.id,
          phase: MatchPhase.GROUP,
          slotIndex: slot++,
          homeTeamId: teamIds[i]!,
          awayTeamId: teamIds[j]!,
          status: MatchStatus.SCHEDULED,
        },
      });
    }
  }

  console.log("Seed OK:");
  console.log(`  Benutzer: ${SEED_EMAIL} / ${SEED_USERNAME}`);
  console.log(`  Passwort: ${SEED_PASSWORD}`);
  console.log(`  Spieler: ${players.length} (im Kader von 4 Mannschaften)`);
  console.log(
    `  Turnier: „${TOURNAMENT_NAME}“ — eine Vorrunde (alle gegen alle), Mannschaft vs. Mannschaft`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
