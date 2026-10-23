import { _electron as electron } from "playwright";
import electronExecutable from "electron";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import WebSocket from "ws";

const root = fileURLToPath(new URL("../", import.meta.url));
const dataDir = await mkdtemp(path.join(os.tmpdir(), "turnier-hub-desktop-smoke-"));
const executablePath = process.argv[2] ? path.resolve(process.argv[2]) : electronExecutable;
const packaged = Boolean(process.argv[2]);
const port = Number(process.env.TURNIER_HUB_PROTOTYPE_PORT || 3210);
const base = `http://127.0.0.1:${port}`;
const env = { ...process.env, TURNIER_HUB_PROTOTYPE_DATA_DIR: dataDir };
delete env.ELECTRON_RUN_AS_NODE;
let desktop;

async function launch()
{
  const instance = await electron.launch({ executablePath, args: packaged ? [] : [path.join(root, "desktop/app")], cwd: root, env, timeout: 30000 });
  instance.process().stderr.on("data", (data) => process.stderr.write(data));
  await instance.waitForEvent("console", { predicate: (message) => message.text().includes('"desktop-ready"'), timeout: 30000 });
  return instance;
}

async function api(resource, init = {})
{
  const response = await fetch(`${base}/api${resource}`, init);
  assert.ok(response.ok, `${resource}: HTTP ${response.status} ${await response.clone().text()}`);
  return response.json();
}

async function closeWindow()
{
  const closed = desktop.waitForEvent("close");
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await closed;
  desktop = null;
  await assert.rejects(fetch(base), "Window close must release the server port");
}

try
{
  desktop = await launch();
  const second = spawn(executablePath, packaged ? [] : [path.join(root, "desktop/app")], { cwd: root, env, stdio: "ignore" });
  const secondTimeout = setTimeout(() => second.kill(), 10000);
  try
  {
    const [code] = await once(second, "exit");
    assert.equal(code, 0, "Second launch must hand over to the first instance");
  }
  finally { clearTimeout(secondTimeout); }
  assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
  const blockedExternalRequests = [];
  // Block external renderer requests throughout verification: no successful
  // internet request may be needed for navigation or local fonts.
  await desktop.context().route("**/*", (route) =>
  {
    const url = new URL(route.request().url());
    if (url.protocol === "file:" || ["127.0.0.1", "localhost"].includes(url.hostname)) return route.continue();
    blockedExternalRequests.push(url.href);
    return route.abort();
  });
  const settings = JSON.parse(await readFile(path.join(dataDir, "standalone-settings.json"), "utf8"));
  const headers = { "Content-Type": "application/json" };
  assert.deepEqual(await api("/classes", { headers }), [], "Fresh prototype must have no sample classes");
  const lanIp = Object.values(os.networkInterfaces()).flat().find((entry) => entry && entry.family === "IPv4" && !entry.internal)?.address;
  assert.ok(lanIp, "LAN interface needed for this smoke test");
  const lanUrl = `http://${lanIp}:${port}`;
  const lanResponse = await fetch(`${lanUrl}/api/classes`, { headers: { ...headers, Origin: lanUrl } });
  assert.equal(lanResponse.status, 200);
  assert.equal(lanResponse.headers.get("access-control-allow-origin"), lanUrl);
  const lanSocket = new WebSocket(`ws://${lanIp}:${port}/api/ws`, { origin: lanUrl });
  await once(lanSocket, "open");
  const socket = new WebSocket(`ws://127.0.0.1:${port}/api/ws`, { origin: base });
  await once(socket, "open");
  const changed = once(socket, "message");
  const lanChanged = once(lanSocket, "message");
  await api("/classes", { method: "POST", headers, body: JSON.stringify({ name: "Persistenztest" }) });
  assert.equal(JSON.parse(String((await changed)[0])).type, "catalogChanged");
  assert.equal(JSON.parse(String((await lanChanged)[0])).type, "catalogChanged");
  const windows = await desktop.windows();
  const content = windows.find((page) => page.url().startsWith(base));
  assert.ok(content, "Vue content view must be attached");
  await content.goto(`${base}/login`);
  await content.waitForURL(`${base}/`);
  await content.goto(`${base}/classes`);
  await content.getByText("Persistenztest", { exact: true }).waitFor();
  const responsive = [];
  for (const [width, height] of [[430, 740], [1200, 820]])
  {
    await desktop.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(...size), [width, height]);
    await content.waitForFunction(() => document.fonts.status === "loaded");
    const layout = await content.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth, fonts: document.fonts.check('400 14px "DM Sans"') }));
    assert.ok(layout.content <= layout.width, `Horizontal page overflow at ${width}px`);
    assert.ok(layout.fonts, "Local font must load");
    responsive.push(layout);
    await content.screenshot({ path: path.join(dataDir, `content-${width}.png`) });
    const screenshot = await desktop.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].capturePage()).toPNG().toString("base64"));
    await writeFile(path.join(dataDir, `window-${width}.png`), Buffer.from(screenshot, "base64"));
  }
  assert.deepEqual(blockedExternalRequests, [], "Application must not request external resources");
  const wsClosed = once(socket, "close");
  const lanWsClosed = once(lanSocket, "close");
  await closeWindow();
  await wsClosed;
  await lanWsClosed;
  desktop = await launch();
  assert.equal((await api("/classes", { headers }))[0].name, "Persistenztest");
  assert.equal(JSON.parse(await readFile(path.join(dataDir, "standalone-settings.json"), "utf8")).schemaId, settings.schemaId);
  await closeWindow();
  const report = { platform: process.platform, arch: process.arch, packaged, dataDir, lanUrl, responsive, checks: ["first start", "single instance", "isolated empty database", "legacy login route redirects to dashboard", "class create/read", "HTTP and WebSocket via loopback and LAN interface on this host", "local fonts", "responsive window", "window close stops HTTP and WS", "restart persistence"], externalRequests: blockedExternalRequests, limitations: ["Same-host verification only; no physical second LAN device", "No Windows execution", "Not a full feature acceptance test"] };
  await writeFile(path.join(dataDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
finally
{
  await desktop?.close();
}
