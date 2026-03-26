import { prisma } from "../../../server/src/db.js";
import { seedDemoData } from "../../../server/src/seed/demoSeed.js";

export async function resetDatabase(): Promise<void>
{
  await prisma.match.deleteMany();
  await prisma.tournamentTeamMember.deleteMany();
  await prisma.tournamentTeam.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.player.deleteMany();
  await prisma.schoolClass.deleteMany();
  await prisma.user.deleteMany();
}

export async function seedTestDatabase(): Promise<void>
{
  await resetDatabase();
  await seedDemoData(prisma);
}
