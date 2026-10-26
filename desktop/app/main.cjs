const { app, BrowserWindow, WebContentsView, Menu, dialog, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { initializePrototypeData } = require("./storage.cjs");
const { createDiagnostics, describeStartupError } = require("./diagnostics.cjs");
const { createHostMaintenance } = require("./maintenance.cjs");
const { installHostManagement } = require("./host-management.cjs");

// Deliberately separate from any future production app and all checkout databases.
app.setName("Turnier-Hub");
const dataDir = process.env.TURNIER_HUB_PROTOTYPE_DATA_DIR
  ? path.resolve(process.env.TURNIER_HUB_PROTOTYPE_DATA_DIR)
  : path.join(app.getPath("appData"), "Turnier-Hub");
app.setPath("userData", dataDir);
let window;
let runtime;
let hostManagement;
let startup;
let quitting = false;
let shutdown;
let shutdownRequested = false;
let stage = "window";
const diagnostics = createDiagnostics(dataDir);
const port = process.env.TURNIER_HUB_PROTOTYPE_PORT === undefined ? 3210 : Number(process.env.TURNIER_HUB_PROTOTYPE_PORT);

function lanAddresses(port)
{
  return [...new Set(Object.values(os.networkInterfaces()).flat()
    .filter((entry) => entry && !entry.internal && entry.family === "IPv4")
    .map((entry) => `http://${entry.address}:${port}`))];
}

async function showHost(status, addresses = [], detail = "")
{
  if (!window || window.isDestroyed()) throw new Error("Host window unavailable");
  await window.loadFile(path.join(__dirname, "host.html"), { query: { status, detail, version: app.getVersion(), development: process.env.TURNIER_HUB_DESKTOP_DEV === "1" ? "1" : "0" } });
}

async function start()
{
  window = new BrowserWindow({
    width: 1100,
    height: 760,
    resizable: true,
    fullscreen: false,
    fullscreenable: false,
    title: `Turnier-Hub ${app.getVersion()} · Host`,
    webPreferences: { preload: path.join(__dirname, "host-preload.cjs"), nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.on("close", (event) =>
  {
    if (!quitting) { event.preventDefault(); app.quit(); }
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: "Turnier-Hub", submenu: [
    { label: "Diagnoseprotokoll anzeigen", click: () => shell.showItemInFolder(diagnostics.logPath) },
    { label: "Vollständig beenden", click: () => app.quit() },
  ] }]));
  await showHost("starting");
  await diagnostics.write("startup", { stage });
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid prototype test port");
  stage = "resources";
  const resourceRoot = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, "..");
  const runtimeDir = path.join(resourceRoot, "runtime");
  const clientDist = app.isPackaged ? path.join(resourceRoot, "client") : path.resolve(__dirname, "../../client/dist");
  await fs.access(path.join(runtimeDir, "server.cjs"));
  await fs.access(path.join(clientDist, "index.html"));
  stage = "data";
  const { dbPath, settings, created } = await initializePrototypeData(dataDir, runtimeDir);
  await diagnostics.write("data-ready", { created });
  if (shutdownRequested) return;
  const localUrl = `http://127.0.0.1:${port}`;
  const urls = lanAddresses(port);
  Object.assign(process.env, {
    TURNIER_HUB_DESKTOP: "1",
    NODE_ENV: "production",
    DATABASE_URL: `file:${dbPath.replaceAll("\\", "/")}`,
    PORT: String(port),
    CORS_ALLOWED_ORIGINS: [localUrl, `http://localhost:${port}`, ...urls].join(","),
    TRUST_PROXY: "false",
  });
  const database = require(path.join(runtimeDir, "server.cjs"));
  const { startServer } = database;
  stage = "server";
  runtime = await startServer({ port, host: "0.0.0.0", clientDist, localDesktop: true });
  if (shutdownRequested) return;
  runtime.server.on("error", (error) =>
  {
    void diagnostics.write("server-error", { stage, code: error.code ?? error.name });
    dialog.showErrorBox("Serverfehler", "Der lokale Server ist ausgefallen. Die App wird vollständig beendet. Details stehen im lokalen Diagnoseprotokoll.");
    app.quit();
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: "Turnier-Hub", submenu: [
      { label: "Host-Verwaltung …", click: () => hostManagement.open() },
      { label: "Diagnoseprotokoll anzeigen", click: () => shell.showItemInFolder(diagnostics.logPath) },
      { type: "separator" },
      { label: "Vollständig beenden", click: () => app.quit() },
    ] },
    { label: "Bearbeiten", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
    { label: "Ansicht", submenu: [{ role: "reload" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }] },
  ]));
  stage = "interface";
  const content = new WebContentsView({ webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
  window.on("closed", () => content.webContents.close());
  const resizeContent = () =>
  {
    const [width, height] = window.getContentSize();
    content.setBounds({ x: 0, y: 44, width, height: Math.max(0, height - 44) });
  };
  resizeContent();
  window.on("resize", resizeContent);
  for (const contents of [window.webContents, content.webContents])
  {
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    contents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  }
  content.webContents.on("will-navigate", (event, url) =>
  {
    if (new URL(url).origin !== localUrl) event.preventDefault();
  });
  await content.webContents.loadURL(localUrl);
  if (shutdownRequested) return;
  const maintenance = createHostMaintenance({
    dataDir, runtimeDir, schemaId: settings.schemaId, appVersion: app.getVersion(), database,
    stop: async () =>
    {
      window.contentView.removeChildView(content);
      await showHost("maintenance");
      await runtime?.stop();
      runtime = undefined;
    },
    start: async () =>
    {
      runtime = await startServer({ port, host: "0.0.0.0", clientDist, localDesktop: true });
      runtime.server.on("error", () => app.quit());
      await showHost("ready");
      window.contentView.addChildView(content);
    },
  });
  hostManagement = installHostManagement({
    owner: window, maintenance, dataDir, diagnostics,
    info: () => ({ localUrl, lanUrls: urls, port, version: app.getVersion(), dataDir }),
    changed: () => content.webContents.loadURL(localUrl),
  });
  await showHost("ready", urls);
  window.contentView.addChildView(content);
  stage = "ready";
  await diagnostics.write("ready", { port });
  // A machine-readable startup record, with no credentials, aids smoke verification.
  console.log(JSON.stringify({ type: "desktop-ready", localUrl, lanUrls: urls, dataDir }));
}

if (!app.requestSingleInstanceLock())
{
  app.quit();
}
else
{
  app.on("second-instance", () =>
  {
    if (window) { if (window.isMinimized()) window.restore(); window.focus(); }
  });
  app.on("before-quit", (event) =>
  {
    if (quitting) return;
    event.preventDefault();
    if (hostManagement?.busy())
    {
      dialog.showErrorBox("Datenaktion läuft", "Bitte die laufende Datenaktion abschließen oder den offenen Dialog abbrechen, bevor du die App beendest.");
      return;
    }
    shutdownRequested = true;
    shutdown ??= (async () =>
    {
      await startup?.catch(() => {});
      await showHost("stopping").catch(() => {});
      await diagnostics.write("stopping");
      await runtime?.stop();
      await diagnostics.write("stopped");
    })().catch(async (error) =>
    {
      await diagnostics.write("shutdown-error", { code: error.code ?? error.name });
      dialog.showErrorBox("Fehler beim Beenden", "Beim Beenden ist ein Fehler aufgetreten. Details stehen im lokalen Diagnoseprotokoll.");
    })
      .finally(() => { quitting = true; app.quit(); });
  });
  app.on("window-all-closed", () => app.quit());
  startup = app.whenReady().then(start);
  startup.catch(async (error) =>
  {
    await runtime?.stop().catch(() => {});
    await diagnostics.write("startup-error", { stage, code: error.code ?? error.name });
    if (shutdownRequested) return;
    const detail = `${describeStartupError(error, stage, port)}\n\nDatenordner: ${dataDir}\nDiagnoseprotokoll: ${diagnostics.logPath}\n\nZum erneuten Versuch die App schließen und wieder öffnen.`;
    try
    {
      await showHost("error", [], detail);
      console.log(JSON.stringify({ type: "desktop-error", stage, code: error.code ?? error.name }));
    }
    catch
    {
      dialog.showErrorBox("Turnier-Hub konnte nicht starten", detail);
      app.quit();
    }
  });
}
