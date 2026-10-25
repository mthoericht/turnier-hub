const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { createHostMaintenance, recoverReplacement } = require("../../desktop/app/maintenance.cjs");
const { initializePrototypeData } = require("../../desktop/app/storage.cjs");

process.env.TURNIER_HUB_DESKTOP = "1";
const database = require("../../desktop/runtime/server.cjs");
const { createDatabaseClient } = database;
const runtimeDir = path.resolve(__dirname, "../../desktop/runtime");

async function fixture(t, hooks = {})
{
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "turnier-hub-maintenance-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const dataDir = path.join(root, "Daten mit Umlauten äö");
  const { dbPath, settings } = await initializePrototypeData(dataDir, runtimeDir);
  const manager = createHostMaintenance({
    dataDir, runtimeDir, schemaId: settings.schemaId, appVersion: "0.2.0", database,
    stop: async () => {}, start: async () => {}, ...hooks,
  });
  const connect = () => createDatabaseClient(`file:${dbPath}`);
  return { root, dataDir, dbPath, manager, connect };
}

test("full backup roundtrip preserves classes, players, all tournament modes, scores, rosters and timers", async (t) =>
{
  const { root, manager, connect } = await fixture(t);
  const seeded = await manager.seed();
  assert.deepEqual(seeded.counts, { classes: 4, players: 12, tournaments: 4, teams: 34, members: 17, matches: 34 });
  const db = connect();
  const match = await db.match.findFirst({ where: { awayTeamId: { not: null } } });
  await db.match.update({ where: { id: match.id }, data: {
    homeScore: 3, awayScore: 1, status: "PAUSED", matchStartedAt: new Date("2026-10-23T10:00:00Z"),
    pausedAt: new Date("2026-10-23T10:04:00Z"), totalPausedMs: 12000, elapsedSnapshotMs: 228000,
  } });
  const before = await db.match.findUnique({ where: { id: match.id } });
  await db.$disconnect();
  const exported = path.join(root, "vollständig.thbackup");
  await manager.export(exported);
  const reset = await manager.reset();
  assert.equal(reset.counts.matches, 0);
  assert.equal((await manager.inspectCurrent()).tournaments, 0);
  assert.ok((await fs.stat(reset.backupPath)).size > 0);
  const prepared = await manager.prepareRestore(exported);
  try { await manager.restore(prepared); }
  finally { await manager.discard(prepared); }
  const restored = connect();
  try
  {
    assert.deepEqual(await restored.match.findUnique({ where: { id: match.id } }), before);
    const modes = await restored.tournament.findMany({ select: { mode: true } });
    assert.deepEqual([...new Set(modes.map((row) => row.mode))].sort(), ["DIRECT_KO", "GROUP_KO", "ROUND_ROBIN"]);
    assert.deepEqual(await manager.inspectCurrent(), seeded.counts);
  }
  finally { await restored.$disconnect(); }
});

test("sample data refuses a nonempty catalog and restarts the host unchanged", async (t) =>
{
  let restarts = 0;
  const { manager, connect } = await fixture(t, { start: async () => { restarts++; } });
  const db = connect();
  const record = await db.schoolClass.create({ data: { name: "Behalten" } });
  await db.$disconnect();
  await assert.rejects(manager.seed(), /leeren Datenbestand/);
  assert.equal(restarts, 1);
  const check = connect();
  try { assert.equal((await check.schoolClass.findUnique({ where: { id: record.id } })).name, "Behalten"); }
  finally { await check.$disconnect(); }
});

test("invalid, tampered, incompatible and structurally forged backups change nothing", async (t) =>
{
  const { root, dbPath, manager } = await fixture(t);
  const file = path.join(root, "source.thbackup");
  await manager.export(file);
  const original = JSON.parse(await fs.readFile(file, "utf8"));
  const before = await fs.readFile(dbPath);
  for (const mutate of [
    (value) => { value.version = 2; },
    (value) => { value.schemaId = "different"; },
    (value) => { value.database.sha256 = "0".repeat(64); },
    (value) => { value.database.byteLength++; },
    (value) => { value.database.data = "not sqlite"; },
  ])
  {
    const value = structuredClone(original);
    mutate(value);
    const bad = path.join(root, "invalid.thbackup");
    await fs.writeFile(bad, JSON.stringify(value));
    await assert.rejects(manager.prepareRestore(bad));
    assert.deepEqual(await fs.readFile(dbPath), before);
  }
  const foreign = path.join(root, "foreign.db");
  await fs.copyFile(path.join(runtimeDir, "empty.db"), foreign);
  const db = createDatabaseClient(`file:${foreign}`);
  await db.$executeRawUnsafe("CREATE TABLE Unexpected (id TEXT)");
  await db.$disconnect();
  const bytes = await fs.readFile(foreign);
  original.database = { encoding: "base64", byteLength: bytes.length, data: bytes.toString("base64"), sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
  await fs.writeFile(file, JSON.stringify(original));
  await assert.rejects(manager.prepareRestore(file), /schema/);
  assert.deepEqual(await fs.readFile(dbPath), before);
});

test("invalid foreign-key and cross-tournament references are refused", async (t) =>
{
  const { root, manager, connect } = await fixture(t);
  await manager.seed();
  const db = connect();
  const member = await db.tournamentTeamMember.findFirst();
  const different = await db.tournament.findFirst({ where: { id: { not: member.tournamentId } } });
  await db.tournamentTeamMember.update({ where: { id: member.id }, data: { tournamentId: different.id } });
  await db.$disconnect();
  await assert.rejects(manager.export(path.join(root, "bad.thbackup")), /falschen Turnier/);
  const corrupt = connect();
  await corrupt.$executeRawUnsafe("PRAGMA foreign_keys=OFF");
  await corrupt.$executeRawUnsafe("UPDATE TournamentTeamMember SET teamId='missing-' || id");
  await corrupt.$disconnect();
  await assert.rejects(manager.inspectCurrent(), /Datenverknüpfungen/);
});

test("failed restart rolls back and keeps a recoverable automatic backup", async (t) =>
{
  let attempts = 0;
  const { dataDir, manager } = await fixture(t, { start: async () => { if (++attempts === 1) throw new Error("restart failure"); } });
  await assert.rejects(manager.seed(), /restart failure/);
  assert.equal(attempts, 2);
  assert.equal((await manager.inspectCurrent()).players, 0);
  assert.equal((await fs.readdir(path.join(dataDir, "backups"))).length, 1);
  await assert.rejects(fs.access(path.join(dataDir, "maintenance-pending.json")), { code: "ENOENT" });
});

test("interrupted replacement rolls back at the next startup", async (t) =>
{
  const { dataDir, dbPath, manager } = await fixture(t);
  await manager.seed();
  const snapshot = path.join(dataDir, "maintenance-previous.db");
  await database.snapshotDesktopDatabase(dbPath, snapshot);
  await fs.writeFile(path.join(dataDir, "maintenance-pending.json"), '{"version":1}');
  await fs.copyFile(path.join(runtimeDir, "empty.db"), dbPath);
  await fs.writeFile(`${dbPath}-wal`, "stale-wal");
  const restarted = await initializePrototypeData(dataDir, runtimeDir);
  assert.equal(restarted.created, false);
  assert.equal((await manager.inspectCurrent()).players, 12);
  await assert.rejects(fs.access(`${dbPath}-wal`), { code: "ENOENT" });
  assert.equal(await recoverReplacement(dataDir), false);
});

test("exports include committed WAL data and never overwrite an existing file", async (t) =>
{
  const { root, manager, connect } = await fixture(t);
  const db = connect();
  await db.$queryRawUnsafe("PRAGMA journal_mode=WAL");
  await db.schoolClass.create({ data: { name: "WAL-Test" } });
  // Deliberately keep a second reader open to exercise a WAL-backed database.
  const file = path.join(root, "wal.thbackup");
  await manager.export(file);
  await db.$disconnect();
  const bytes = await fs.readFile(file);
  await assert.rejects(manager.export(file), /existiert bereits/);
  assert.deepEqual(await fs.readFile(file), bytes);
  const prepared = await manager.prepareRestore(file);
  assert.equal(prepared.counts.classes, 1);
  await manager.discard(prepared);
});

test("failed export location preserves data and concurrent operations are refused", async (t) =>
{
  let release;
  let stopped;
  const reachedStop = new Promise((resolve) => { stopped = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  const { root, manager } = await fixture(t, { stop: async () => { stopped(); await gate; } });
  const first = manager.export(path.join(root, "missing-folder", "backup.thbackup"));
  await reachedStop;
  await assert.rejects(manager.reset(), /läuft bereits/);
  release();
  await assert.rejects(first, { code: "ENOENT" });
  assert.equal((await manager.inspectCurrent()).classes, 0);
});
