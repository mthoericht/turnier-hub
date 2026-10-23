import { PrismaClient } from "@prisma/client";
import { access } from "node:fs/promises";
import { seedDemoData } from "./seed/demoSeed.js";

// Imported only by Electron's main process. These functions are never routes.
function client(file: string): PrismaClient
{
  return new PrismaClient({ datasources: { db: { url: `file:${file.replaceAll("\\", "/")}` } } });
}

async function withDatabase<T>(file: string, action: (db: PrismaClient) => Promise<T>): Promise<T>
{
  await access(file); // Prisma must not silently create a missing source.
  const db = client(file);
  try { return await action(db); }
  finally { await db.$disconnect(); }
}

export async function inspectDesktopDatabase(file: string, template: string)
{
  const schemaSql = "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name";
  const expected = await withDatabase(template, (db) => db.$queryRawUnsafe(schemaSql));
  return withDatabase(file, async (db) =>
  {
    const integrity = await db.$queryRawUnsafe<Array<{ quick_check: string }>>("PRAGMA quick_check");
    if (integrity.length !== 1 || integrity[0]?.quick_check !== "ok") throw new Error("Die Datenbank ist beschädigt.");
    const actual = await db.$queryRawUnsafe(schemaSql);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Das Datenbankschema passt nicht zu dieser App-Version.");
    const foreignKeys = await db.$queryRawUnsafe<unknown[]>("PRAGMA foreign_key_check");
    if (foreignKeys.length) throw new Error("Die Sicherung enthält ungültige Datenverknüpfungen.");
    const invalid = await db.$queryRawUnsafe<unknown[]>(`
      SELECT m.id FROM TournamentTeamMember m JOIN TournamentTeam t ON t.id = m.teamId
      WHERE m.tournamentId != t.tournamentId
      UNION ALL
      SELECT m.id FROM Match m LEFT JOIN TournamentTeam h ON h.id = m.homeTeamId
      LEFT JOIN TournamentTeam a ON a.id = m.awayTeamId
      WHERE (h.id IS NOT NULL AND h.tournamentId != m.tournamentId)
         OR (a.id IS NOT NULL AND a.tournamentId != m.tournamentId)`);
    if (invalid.length) throw new Error("Teams oder Spiele sind einem falschen Turnier zugeordnet.");
    const [classes, players, tournaments, teams, members, matches] = await Promise.all([
      db.schoolClass.count(), db.player.count(), db.tournament.count(),
      db.tournamentTeam.count(), db.tournamentTeamMember.count(), db.match.count(),
    ]);
    return { classes, players, tournaments, teams, members, matches };
  });
}

export async function snapshotDesktopDatabase(source: string, destination: string): Promise<void>
{
  // The host has stopped HTTP/WS and disconnected the application client first.
  // VACUUM INTO also includes committed WAL pages in the standalone snapshot.
  await withDatabase(source, async (db) =>
  {
    await db.$executeRawUnsafe(`VACUUM INTO '${destination.replaceAll("'", "''")}'`);
  });
}

export async function seedDesktopDatabase(file: string): Promise<void>
{
  await withDatabase(file, seedDemoData);
}
