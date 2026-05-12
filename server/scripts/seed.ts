import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import {
  seedDemoData,
  SEED_CREATOR_SUBJECT,
  SEED_PLAYERS,
} from "../src/seed/demoSeed.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.DATABASE_URL)
{
  config({ path: path.join(root, ".env") });
}

const prisma = new PrismaClient();

async function main(): Promise<void>
{
  console.log("Seed OK:");
  console.log(`  Demo-Ersteller-Subjekt: ${SEED_CREATOR_SUBJECT}`);
  await seedDemoData(prisma);
  console.log(`  Spieler (Fixtures): ${SEED_PLAYERS.length}`);
  console.log("  Turniere (Fixtures):");
  console.log("    - Demo: Fußball Schulcup (GROUP_KO)");
  console.log("    - Demo: Volleyball K.O. (DIRECT_KO)");
  console.log("    - Demo: Badminton Jeder gegen Jeden (ROUND_ROBIN)");
}

main()
  .catch((e) =>
  {
    console.error(e);
    process.exit(1);
  })
  .finally(async () =>
  {
    await prisma.$disconnect();
  });
