import "../src/config.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // Minimaler Safety-Check gegen versehentliches Löschen.
  // (Kann bei Bedarf später erweitert werden.)
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    throw new Error(
      "Refusing to clear DB in production. Run in dev or set NODE_ENV=development."
    );
  }

  // Nicht zwingend, aber hilft beim sicheren Aufruf im Terminal.
  // Nutzung: npm run db:clear -- --yes
  const wantYes = process.argv.includes("--yes") || process.argv.includes("-y");
  if (!wantYes) {
    // eslint-disable-next-line no-console
    console.log("DB clear aborted. Run again with '--yes' to confirm.");
    return;
  }

  // Reihenfolge: Fremdschlüssel zuerst, dann Container.
  await prisma.adminAuditLog.deleteMany();
  await prisma.match.deleteMany();
  await prisma.tournamentTeamMember.deleteMany();
  await prisma.tournamentTeam.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.player.deleteMany();
  await prisma.schoolClass.deleteMany();

  // eslint-disable-next-line no-console
  console.log("DB cleared (catalog data).");
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

