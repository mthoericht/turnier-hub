import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import {
  AdminUserServiceError,
  promoteUserToAdminByEmail,
} from "../src/services/adminUserService.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.DATABASE_URL)
{
  config({ path: path.join(root, ".env") });
}

function readEmailArg(): string | null
{
  const emailFlagIndex = process.argv.indexOf("--email");
  if (emailFlagIndex >= 0)
  {
    return process.argv[emailFlagIndex + 1] ?? null;
  }
  const positional = process.argv.slice(2).find((arg) => !arg.startsWith("-"));
  return positional ?? null;
}

const prisma = new PrismaClient();

async function main(): Promise<void>
{
  const email = readEmailArg();
  if (!email)
  {
    console.error("Usage: npm run db:promote-admin -- --email <user@example.com> --yes");
    process.exitCode = 1;
    return;
  }

  const confirmed = process.argv.includes("--yes") || process.argv.includes("-y");
  if (!confirmed)
  {
    console.log(`Abgebrochen. Erneut mit --yes ausführen, um ${email} zu ADMIN zu befördern.`);
    return;
  }

  try
  {
    const result = await promoteUserToAdminByEmail(prisma, email);
    if (result.alreadyAdmin)
    {
      console.log(`User ${result.email} (${result.id}) ist bereits ADMIN.`);
      return;
    }
    console.log(`User ${result.email} (${result.id}) wurde zu ADMIN befördert.`);
    console.log("Hinweis: Nutzer muss sich neu anmelden oder /api/auth/me aktualisieren, damit die Admin-Navigation erscheint.");
  }
  catch (error)
  {
    if (error instanceof AdminUserServiceError)
    {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

main()
  .catch((error) =>
  {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () =>
  {
    await prisma.$disconnect();
  });
