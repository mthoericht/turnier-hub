import { prisma } from "../../../server/src/db.js";
import { seedDemoData } from "../../../server/src/seed/demoSeed.js";

export async function resetDatabase(): Promise<void>
{
  if (process.env.NODE_ENV !== "test" || process.env.TURNIER_HUB_ISOLATED_TEST !== "1")
  {
    throw new Error("Database reset requires the isolated test runner.");
  }
  await prisma.match.deleteMany();
  await prisma.tournamentTeamMember.deleteMany();
  await prisma.tournamentTeam.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.player.deleteMany();
  await prisma.schoolClass.deleteMany();
}

export async function seedTestDatabase(): Promise<void>
{
  await resetDatabase();
  await seedDemoData(prisma);
}
