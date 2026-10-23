const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { initializePrototypeData } = require("../../desktop/app/storage.cjs");
const { createDiagnostics, describeStartupError } = require("../../desktop/app/diagnostics.cjs");

async function fixture(t)
{
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "turnier-hub-storage-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const runtime = path.join(root, "runtime");
  const data = path.join(root, "Daten mit Leerzeichen äö");
  await fs.mkdir(runtime);
  await fs.writeFile(path.join(runtime, "schema.sha256"), "schema-v1");
  await fs.writeFile(path.join(runtime, "empty.db"), "empty-template");
  return { root, runtime, data };
}

test("first start creates isolated data; restart preserves bytes and credentials", async (t) =>
{
  const { runtime, data } = await fixture(t);
  const first = await initializePrototypeData(data, runtime);
  assert.equal(first.created, true);
  await fs.writeFile(first.dbPath, "persisted-tournament-data");
  const settingsBefore = await fs.readFile(path.join(data, "standalone-settings.json"));
  const second = await initializePrototypeData(data, runtime);
  assert.equal(second.created, false);
  assert.equal(second.settings.schemaId, first.settings.schemaId);
  assert.equal(await fs.readFile(second.dbPath, "utf8"), "persisted-tournament-data");
  assert.deepEqual(await fs.readFile(path.join(data, "standalone-settings.json")), settingsBefore);
});

test("existing database without settings is never overwritten", async (t) =>
{
  const { runtime, data } = await fixture(t);
  await fs.mkdir(data);
  const db = path.join(data, "standalone.db");
  await fs.writeFile(db, "real-existing-data");
  await assert.rejects(initializePrototypeData(data, runtime), { code: "INCOMPLETE_DATA" });
  assert.equal(await fs.readFile(db, "utf8"), "real-existing-data");
});

test("missing database on a later start is not silently recreated", async (t) =>
{
  const { runtime, data } = await fixture(t);
  const first = await initializePrototypeData(data, runtime);
  const settingsBefore = await fs.readFile(path.join(data, "standalone-settings.json"));
  await fs.rm(first.dbPath);
  await assert.rejects(initializePrototypeData(data, runtime), { code: "INCOMPLETE_DATA" });
  await assert.rejects(fs.access(first.dbPath), { code: "ENOENT" });
  assert.deepEqual(await fs.readFile(path.join(data, "standalone-settings.json")), settingsBefore);
});

test("changed schema refuses startup without changing user files", async (t) =>
{
  const { runtime, data } = await fixture(t);
  const first = await initializePrototypeData(data, runtime);
  await fs.writeFile(first.dbPath, "saved-results");
  const settingsBefore = await fs.readFile(path.join(data, "standalone-settings.json"));
  await fs.writeFile(path.join(runtime, "schema.sha256"), "schema-v2");
  await assert.rejects(initializePrototypeData(data, runtime), { code: "SCHEMA_MISMATCH" });
  assert.equal(await fs.readFile(first.dbPath, "utf8"), "saved-results");
  assert.deepEqual(await fs.readFile(path.join(data, "standalone-settings.json")), settingsBefore);
});

for (const invalid of ["{bad-json", "null", JSON.stringify({ wrongField: true })])
{
  test(`invalid settings are preserved (${invalid.slice(0, 12)})`, async (t) =>
  {
    const { runtime, data } = await fixture(t);
    const first = await initializePrototypeData(data, runtime);
    const settingsPath = path.join(data, "standalone-settings.json");
    await fs.writeFile(settingsPath, invalid);
    await assert.rejects(initializePrototypeData(data, runtime), { code: "INVALID_SETTINGS" });
    assert.equal(await fs.readFile(settingsPath, "utf8"), invalid);
    assert.equal(await fs.readFile(first.dbPath, "utf8"), "empty-template");
  });
}

test("missing packaged template creates no half initialized user database", async (t) =>
{
  const { runtime, data } = await fixture(t);
  await fs.rm(path.join(runtime, "empty.db"));
  await assert.rejects(initializePrototypeData(data, runtime), { code: "ENOENT" });
  await assert.rejects(fs.access(path.join(data, "standalone.db")), { code: "ENOENT" });
  await assert.rejects(fs.access(path.join(data, "standalone-settings.json")), { code: "ENOENT" });
});

test("diagnostics serialize events, rotate bounded logs and ignore credentials", async (t) =>
{
  const { data } = await fixture(t);
  const logger = createDiagnostics(data);
  await Promise.all([logger.write("startup"), logger.write("data-ready", { created: true, jwtSecret: "do-not-log", inviteCode: "private-code" }), logger.write("ready", { port: 3210 })]);
  const lines = (await fs.readFile(logger.logPath, "utf8")).trim().split("\n").map(JSON.parse);
  assert.deepEqual(lines.map((line) => line.event), ["startup", "data-ready", "ready"]);
  assert.equal(JSON.stringify(lines).includes("do-not-log"), false);
  assert.equal(JSON.stringify(lines).includes("private-code"), false);
  await fs.writeFile(logger.logPath, "x".repeat(1024 * 1024 + 1));
  await logger.write("stopped");
  assert.equal(JSON.parse((await fs.readFile(logger.logPath, "utf8")).trim()).event, "stopped");
  assert.equal((await fs.stat(`${logger.logPath}.previous`)).size, 1024 * 1024 + 1);
});

test("startup messages distinguish port, permission, resource and database failures", () =>
{
  assert.match(describeStartupError({ code: "EADDRINUSE" }, "server", 3210), /Port 3210/);
  assert.match(describeStartupError({ code: "EACCES" }, "data", 3210), /Schreibrechte/);
  assert.match(describeStartupError({}, "resources", 3210), /App-Dateien/);
  assert.match(describeStartupError({}, "server", 3210), /Datenbank/);
});
