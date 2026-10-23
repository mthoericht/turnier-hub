import { _electron as electron } from "playwright";
import executable from "electron";
import { mkdtemp, mkdir, readFile, writeFile, cp, access } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const { initializePrototypeData } = require("./app/storage.cjs");
const outputDir = await mkdtemp(path.join(os.tmpdir(), "turnier-hub-desktop-errors-"));
const executablePath = process.argv[2] ? path.resolve(process.argv[2]) : executable;
const args = process.argv[2] ? [] : [path.join(root, "desktop/app")];
const runtimeDir = process.argv[2]
  ? path.resolve(executablePath, "../../Resources/runtime")
  : path.join(root, "desktop/runtime");
const results = [];

async function scenario(name, prepare, expectedCode, visibleText)
{
  const dataDir = path.join(outputDir, name);
  await mkdir(dataDir);
  const cleanup = await prepare(dataDir);
  let instance;
  const env = { ...process.env, TURNIER_HUB_PROTOTYPE_DATA_DIR: dataDir, TURNIER_HUB_PROTOTYPE_PORT: "3212" };
  delete env.ELECTRON_RUN_AS_NODE;
  try
  {
    instance = await electron.launch({ executablePath, args, cwd: root, env, timeout: 30000 });
    const host = await instance.firstWindow();
    await host.waitForFunction(() => document.body.dataset.status === "error");
    await host.getByRole("alert").getByText(visibleText, { exact: false }).waitFor();
    await host.screenshot({ path: path.join(dataDir, "error.png") });
    const log = await readFile(path.join(dataDir, "logs/desktop.log"), "utf8");
    const events = log.trim().split("\n").map(JSON.parse);
    const failure = events.find((event) => event.event === "startup-error");
    assert.ok(failure);
    if (expectedCode) assert.equal(failure.code, expectedCode);
    else assert.equal(failure.stage, "server");
    const closed = instance.waitForEvent("close");
    await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await closed;
    instance = null;
    results.push({ name, code: failure.code, errorVisible: true, cleanExit: true });
  }
  finally
  {
    await instance?.close();
    await cleanup?.();
  }
}

await scenario("occupied-port", async () =>
{
  const occupied = http.createServer((_req, response) => response.end("test-port-owner"));
  await new Promise((resolve, reject) => { occupied.once("error", reject); occupied.listen(3212, "0.0.0.0", resolve); });
  return async () =>
  {
    assert.equal(await (await fetch("http://127.0.0.1:3212")).text(), "test-port-owner");
    await new Promise((resolve) => occupied.close(resolve));
  };
}, "EADDRINUSE", "Port 3212 ist bereits belegt");

await scenario("missing-database", async (dir) =>
{
  const source = path.join(outputDir, "settings-source");
  await initializePrototypeData(source, runtimeDir);
  await cp(path.join(source, "standalone-settings.json"), path.join(dir, "standalone-settings.json"));
  return () => assert.rejects(access(path.join(dir, "standalone.db")), { code: "ENOENT" });
}, "INCOMPLETE_DATA", "nicht vollständig vorhanden");

await scenario("corrupt-settings", async (dir) =>
{
  const { dbPath } = await initializePrototypeData(dir, runtimeDir);
  const before = await readFile(dbPath);
  await writeFile(path.join(dir, "standalone-settings.json"), "{broken");
  return async () =>
  {
    assert.deepEqual(await readFile(dbPath), before);
    assert.equal(await readFile(path.join(dir, "standalone-settings.json"), "utf8"), "{broken");
  };
}, "INVALID_SETTINGS", "Einstellungen sind beschädigt");

await scenario("corrupt-database", async (dir) =>
{
  const { dbPath } = await initializePrototypeData(dir, runtimeDir);
  await writeFile(dbPath, "not-a-sqlite-database");
  return async () => assert.equal(await readFile(dbPath, "utf8"), "not-a-sqlite-database");
}, null, "Datenbank konnte nicht gestartet werden");

await writeFile(path.join(outputDir, "report.json"), JSON.stringify({ platform: process.platform, arch: process.arch, results }, null, 2));
console.log(JSON.stringify({ outputDir, results }, null, 2));
