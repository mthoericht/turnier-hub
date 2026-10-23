import { _electron as electron } from "playwright";
import executable from "electron";
import { mkdtemp, readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = fileURLToPath(new URL("../", import.meta.url));
const dataDir = await mkdtemp(path.join(os.tmpdir(), "turnier-hub-host-ui-"));
const backup = path.join(dataDir, "..", `${path.basename(dataDir)}.thbackup`);
const invalid = path.join(dataDir, "..", `${path.basename(dataDir)}-invalid.thbackup`);
const base = "http://127.0.0.1:3213";
const env = { ...process.env, TURNIER_HUB_PROTOTYPE_DATA_DIR: dataDir, TURNIER_HUB_PROTOTYPE_PORT: "3213" };
delete env.ELECTRON_RUN_AS_NODE;
const executablePath = process.argv[2] ? path.resolve(process.argv[2]) : executable;
let desktop;
const checks = [];

async function api(resource)
{
  const response = await fetch(`${base}/api/${resource}`);
  assert.equal(response.status, 200);
  return response.json();
}

async function launch()
{
  desktop = await electron.launch({ executablePath, args: process.argv[2] ? [] : [path.join(root, "desktop/app")], cwd: root, env });
  await desktop.waitForEvent("console", { predicate: (message) => message.text().includes('"desktop-ready"') });
  const host = await desktop.firstWindow();
  await host.getByRole("button", { name: "Host-Verwaltung", exact: true }).waitFor();
  assert.equal(await host.locator("#addresses").count(), 0);
  const content = desktop.windows().find((page) => page.url().startsWith(base));
  await content.getByRole("heading", { name: "Dashboard", exact: true }).waitFor();
  assert.equal(await content.getByRole("link", { name: "Login", exact: true }).count(), 0);
  assert.equal(await content.evaluate(() => typeof window.turnierHost), "undefined");
  return { host, content };
}

async function close()
{
  const closed = desktop.waitForEvent("close");
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((win) => win.webContents.getURL().includes("host.html")).close());
  await closed;
  desktop = undefined;
  await assert.rejects(fetch(base));
}

try
{
  const { host, content } = await launch();
  checks.push("desktop dashboard without login; host information banner removed; LAN renderer has no privileged bridge");
  const panelEvent = desktop.waitForEvent("window");
  await host.getByRole("button", { name: "Host-Verwaltung", exact: true }).click();
  const panel = await panelEvent;
  await panel.getByRole("heading", { name: "Host-Verwaltung", exact: true }).waitFor();
  await panel.getByText(base, { exact: true }).waitFor();
  await panel.getByText("Port", { exact: true }).waitFor();
  checks.push("host panel opens with actual local address, LAN addresses, port, version and data folder");

  await desktop.evaluate(({ dialog }) =>
  {
    globalThis.hostSmokeConfirm = 0;
    globalThis.hostSmokeCanceled = false;
    globalThis.hostSmokePicker = "";
    dialog.showMessageBox = async (_window, options) =>
    {
      if (options.defaultId !== 0 || options.cancelId !== 0) throw new Error("Unsafe confirmation defaults");
      return { response: globalThis.hostSmokeConfirm };
    };
    dialog.showSaveDialog = async () => ({ canceled: globalThis.hostSmokeCanceled, filePath: globalThis.hostSmokePicker });
    dialog.showOpenDialog = async () => ({ canceled: globalThis.hostSmokeCanceled, filePaths: [globalThis.hostSmokePicker] });
  });
  const click = async (name, text) =>
  {
    await panel.getByRole("button", { name, exact: true }).click();
    await panel.locator("#result").filter({ hasText: text }).waitFor();
    await panel.waitForFunction(() => !document.querySelector("button").disabled);
  };
  await click("Beispieldaten laden", "abgebrochen");
  assert.equal((await api("players")).length, 0);
  await desktop.evaluate(() => { globalThis.hostSmokeConfirm = 1; });
  await click("Beispieldaten laden", "Beispieldaten geladen");
  assert.equal((await api("players")).length, 12);
  assert.equal((await api("tournaments")).length, 4);
  await click("Beispieldaten laden", "leeren Bestand");
  assert.equal((await api("tournaments")).length, 4);
  checks.push("seed cancel preserves empty data; explicit seed loads all modes; repeated seed refuses existing data");

  await desktop.evaluate((_electron, destination) => { globalThis.hostSmokePicker = destination; globalThis.hostSmokeCanceled = true; }, backup);
  await click("Daten vollständig exportieren", "abgebrochen");
  await desktop.evaluate(() => { globalThis.hostSmokeCanceled = false; });
  await click("Daten vollständig exportieren", "Vollständige Sicherung gespeichert");
  assert.equal(JSON.parse(await readFile(backup, "utf8")).format, "turnier-hub-backup");
  await desktop.evaluate(() => { globalThis.hostSmokeConfirm = 0; });
  await click("Datenbestand zurücksetzen", "abgebrochen");
  assert.equal((await api("players")).length, 12);
  await desktop.evaluate(() => { globalThis.hostSmokeConfirm = 1; });
  await click("Datenbestand zurücksetzen", "jetzt leer");
  assert.equal((await api("players")).length, 0);
  assert.equal((await api("tournaments")).length, 0);
  assert.ok((await readdir(path.join(dataDir, "backups"))).some((file) => file.startsWith("vor-reset-")));
  checks.push("native backup picker export/cancel; reset cancel/confirm; automatic backup before reset");

  await writeFile(invalid, "{corrupted-backup");
  await desktop.evaluate((_electron, source) => { globalThis.hostSmokePicker = source; }, invalid);
  await click("Sicherung wiederherstellen", "keine lesbare");
  assert.equal((await api("players")).length, 0);
  await desktop.evaluate((_electron, source) => { globalThis.hostSmokePicker = source; globalThis.hostSmokeConfirm = 0; }, backup);
  await click("Sicherung wiederherstellen", "abgebrochen");
  assert.equal((await api("players")).length, 0);
  await desktop.evaluate(() => { globalThis.hostSmokeConfirm = 1; });
  await click("Sicherung wiederherstellen", "Sicherung wiederhergestellt");
  assert.equal((await api("players")).length, 12);
  assert.equal((await api("tournaments")).length, 4);
  await content.getByText("12", { exact: true }).waitFor();
  checks.push("invalid restore rejected; restore cancel preserves data; full restore refreshes desktop dashboard");
  for (const route of ["host/export", "host/run", "backup", "admin", "restore"])
  {
    assert.equal((await fetch(`${base}/api/${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 404);
  }
  assert.equal((await api("players")).length, 12);
  checks.push("constructed LAN administration requests return 404 and leave shared catalog accessible");
  assert.equal((await fetch(`${base}/api/players/import`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "reset_all", rows: [{ firstName: "Nicht", lastName: "Importieren", className: "Test" }] }),
  })).status, 400);
  assert.equal((await api("players")).length, 12);
  assert.equal((await api("tournaments")).length, 4);
  checks.push("legacy LAN reset_all import is rejected without changing data; full reset is host-only");
  const players = await api("players");
  const beforeTournaments = await api("tournaments");
  const rows = players.map((player) => ({ firstName: player.firstName, lastName: player.lastName, className: player.schoolClass?.name ?? "" }));
  const importResponse = await fetch(`${base}/api/players/import`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "replace_players", rows }),
  });
  assert.equal(importResponse.status, 201);
  assert.deepEqual(await api("players"), players);
  assert.deepEqual(await api("tournaments"), beforeTournaments);
  checks.push("player reconciliation still preserves matching IDs and tournament counts");
  await panel.screenshot({ path: path.join(dataDir, "host-management.png") });
  await close();
  await launch();
  assert.equal((await api("players")).length, 12);
  await close();
  checks.push("restart preserves restored data; closing the host releases HTTP");
  const report = { dataDir, packaged: Boolean(process.argv[2]), checks, limitations: ["Native picker selections and confirmation answers automated in isolated test", "No Windows or physical second-device run"] };
  await writeFile(path.join(dataDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
finally { await desktop?.close(); }
