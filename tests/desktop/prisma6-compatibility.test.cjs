const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { createHostMaintenance } = require("../../desktop/app/maintenance.cjs");
const { initializePrototypeData } = require("../../desktop/app/storage.cjs");
const database = require("../../desktop/runtime/server.cjs");
const runtimeDir = path.resolve(__dirname, "../../desktop/runtime");
const schemaId = "1ef88f16376a0505a35a11ce2b254ddeef575792e402742f9f59055c801f3262";

test("Prisma 6 schema/settings/backup and integer timestamps survive Prisma 7 restore and writes", async (t) =>
{
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "turnier-hub-prisma6-compat-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const legacyFile = path.join(root, "legacy.db");
  const legacy = database.createDatabaseClient(`file:${legacyFile}`);
  try
  {
    const sql = await fs.readFile(path.join(__dirname, "fixtures/prisma6-schema.sql"), "utf8");
    for (const statement of sql.split(";").map((s) => s.trim()).filter(Boolean)) await legacy.$executeRawUnsafe(statement);
    await legacy.$executeRawUnsafe("INSERT INTO SchoolClass (id,name,createdAt) VALUES ('class','10a',1577934245000)");
    await legacy.$executeRawUnsafe("INSERT INTO Player (id,firstName,lastName,schoolClassId,createdAt) VALUES ('player','Anna','Muster','class',1577934245000)");
    await legacy.$executeRawUnsafe("INSERT INTO Tournament (id,name,sport,mode,phase,groupCount,advancesPerGroup,teamsAreIndividuals,createdAt,updatedAt) VALUES ('tournament','Altbestand','Fußball','DIRECT_KO','FINAL',1,2,0,1577934245000,1577934245000)");
    await legacy.$executeRawUnsafe("INSERT INTO TournamentTeam (id,tournamentId,name,sortOrder) VALUES ('home','tournament','Heim',0),('away','tournament','Gast',1)");
    await legacy.$executeRawUnsafe("INSERT INTO TournamentTeamMember (id,tournamentId,teamId,playerId) VALUES ('member','tournament','home','player')");
    await legacy.$executeRawUnsafe("INSERT INTO Match (id,tournamentId,phase,roundOrder,slotIndex,homeTeamId,awayTeamId,homeScore,awayScore,status,matchStartedAt,pausedAt,totalPausedMs,elapsedSnapshotMs) VALUES ('match','tournament','FINAL',0,0,'home','away',2,1,'PAUSED',1577934245000,1577934255000,321,9876)");
  }
  finally { await legacy.$disconnect(); }
  const bytes = await fs.readFile(legacyFile);
  const backupFile = path.join(root, "prisma6.thbackup");
  await fs.writeFile(backupFile, JSON.stringify({
    format: "turnier-hub-backup", version: 1, schemaId, appVersion: "0.2.0",
    createdAt: "2020-01-02T03:04:05.000Z", settings: { schemaId },
    database: { encoding: "base64", byteLength: bytes.length, data: bytes.toString("base64"), sha256: crypto.createHash("sha256").update(bytes).digest("hex") },
  }));
  const dataDir = path.join(root, "current");
  const { dbPath, settings } = await initializePrototypeData(dataDir, runtimeDir);
  assert.equal(settings.schemaId, schemaId);
  const manager = createHostMaintenance({ dataDir, runtimeDir, schemaId, appVersion: "0.2.0", database, stop: async () => {}, start: async () => {} });
  const prepared = await manager.prepareRestore(backupFile);
  await manager.restore(prepared);
  const db = database.createDatabaseClient(`file:${dbPath}`);
  try
  {
    assert.equal((await db.player.findUnique({ where: { id: "player" } })).createdAt.toISOString(), "2020-01-02T03:04:05.000Z");
    const match = await db.match.findUnique({ where: { id: "match" } });
    assert.equal(match.matchStartedAt.toISOString(), "2020-01-02T03:04:05.000Z");
    assert.equal(match.homeScore, 2);
    assert.equal(match.elapsedSnapshotMs, 9876);
    assert.equal(match.totalPausedMs, 321);
    assert.equal(await db.tournamentTeamMember.count(), 1);
    await db.match.update({ where: { id: "match" }, data: { pausedAt: new Date("2020-01-02T03:04:25.000Z") } });
    const [stored] = await db.$queryRawUnsafe("SELECT typeof(pausedAt) AS storageType, pausedAt FROM Match WHERE id='match'");
    assert.equal(stored.storageType, "integer");
    assert.equal(Number(stored.pausedAt), 1577934265000);
  }
  finally { await db.$disconnect(); }
  const roundtrip = path.join(root, "roundtrip.thbackup");
  await manager.export(roundtrip);
  await manager.reset();
  await manager.restore(await manager.prepareRestore(roundtrip));
  const reopened = database.createDatabaseClient(`file:${dbPath}`);
  try
  {
    const match = await reopened.match.findUnique({ where: { id: "match" } });
    assert.equal(match.pausedAt.toISOString(), "2020-01-02T03:04:25.000Z");
    assert.equal(match.homeScore, 2);
    assert.equal(await reopened.tournamentTeamMember.count(), 1);
  }
  finally { await reopened.$disconnect(); }
});
