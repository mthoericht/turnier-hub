import { resetCatalogSchoolIdCacheForTests } from "../../../server/src/lib/catalogSchool.js";
import { prisma } from "../../../server/src/db.js";
import { seedDemoData } from "../../../server/src/seed/demoSeed.js";

export async function resetDatabase(): Promise<void>
{
  await prisma.adminAuditLog.deleteMany();
  await prisma.match.deleteMany();
  await prisma.tournamentTeamMember.deleteMany();
  await prisma.tournamentTeam.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.player.deleteMany();
  await prisma.schoolClass.deleteMany();
  await prisma.school.deleteMany();
  resetCatalogSchoolIdCacheForTests();
  await prisma.school.createMany({
    data: [{ name: "defaultSchool" }, { name: "secondSchool" }],
  });
}

export async function seedTestDatabase(): Promise<void>
{
  await resetDatabase();
  await seedDemoData(prisma);
}
