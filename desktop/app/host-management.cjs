const { BrowserWindow, ipcMain, dialog, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { fileURLToPath } = require("node:url");

function trustedSender(event, contents, file)
{
  if (!contents || contents.isDestroyed() || event.sender !== contents || event.senderFrame !== contents.mainFrame) return false;
  try { return fileURLToPath(new URL(event.senderFrame.url)) === file; }
  catch { return false; }
}

function installHostManagement({ owner, maintenance, info, dataDir, diagnostics, changed })
{
  let panel;
  let active = false;
  const hostFile = path.join(__dirname, "host.html");
  const panelFile = path.join(__dirname, "management.html");

  async function open()
  {
    if (panel && !panel.isDestroyed()) { panel.show(); panel.focus(); return; }
    panel = new BrowserWindow({
      title: "Host-Verwaltung", width: 680, height: 780, minWidth: 440, minHeight: 500,
      parent: owner,
      webPreferences: { preload: path.join(__dirname, "host-preload.cjs"), sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    panel.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    panel.webContents.on("will-navigate", (event) => event.preventDefault());
    panel.on("close", (event) => { if (active) { event.preventDefault(); panel.focus(); } });
    panel.on("closed", () => { panel = undefined; });
    await panel.loadFile(panelFile);
  }

  ipcMain.handle("host:open", (event) =>
  {
    if (!trustedSender(event, owner.webContents, hostFile)) throw new Error("Nur direkt am Host verfügbar.");
    return open();
  });
  ipcMain.handle("host:info", async (event) =>
  {
    if (!trustedSender(event, panel?.webContents, panelFile)) throw new Error("Nur direkt am Host verfügbar.");
    return { ...info(), busy: active, counts: active ? null : await maintenance.inspectCurrent() };
  });
  ipcMain.handle("host:run", async (event, action) =>
  {
    if (!trustedSender(event, panel?.webContents, panelFile)) throw new Error("Nur direkt am Host verfügbar.");
    if (!["export", "restore", "seed", "reset", "backups"].includes(action)) throw new Error("Unbekannte Datenaktion.");
    if (active) return { error: "Eine Datenaktion läuft bereits. Bitte warten." };
    active = true;
    let prepared;
    try
    {
      if (action === "backups")
      {
        const folder = path.join(dataDir, "backups");
        await fs.mkdir(folder, { recursive: true });
        const error = await shell.openPath(folder);
        if (error) throw new Error(error);
        return { message: "Der Ordner mit automatischen Sicherungen wurde geöffnet." };
      }
      let destination;
      if (action === "export")
      {
        const result = await dialog.showSaveDialog(panel, {
          title: "Vollständige Datensicherung speichern", buttonLabel: "Sicherung speichern",
          defaultPath: `Turnier-Hub-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.thbackup`,
          filters: [{ name: "Turnier-Hub-Sicherung", extensions: ["thbackup"] }],
        });
        if (result.canceled || !result.filePath) return { message: "Sicherung abgebrochen." };
        destination = result.filePath;
      }
      if (action === "restore")
      {
        const result = await dialog.showOpenDialog(panel, {
          title: "Turnier-Hub-Sicherung auswählen", properties: ["openFile"],
          filters: [{ name: "Turnier-Hub-Sicherung", extensions: ["thbackup"] }],
        });
        if (result.canceled || !result.filePaths[0]) return { message: "Wiederherstellung abgebrochen." };
        prepared = await maintenance.prepareRestore(result.filePaths[0]);
      }
      if (action !== "export")
      {
        const counts = action === "restore" ? prepared.counts : await maintenance.inspectCurrent();
        if (action === "seed" && Object.values(counts).some((count) => count > 0))
          return { error: "Beispieldaten benötigen einen leeren Bestand. Vorhandene Daten bleiben erhalten. Sichere sie und setze den Bestand nur dann bewusst zurück, wenn du sie ersetzen möchtest." };
        const confirmation = await dialog.showMessageBox(panel, {
          type: action === "seed" ? "question" : "warning",
          title: action === "restore" ? "Sicherung wiederherstellen" : action === "reset" ? "Datenbestand zurücksetzen" : "Beispieldaten laden",
          message: action === "restore" ? "Den aktuellen Bestand durch diese Sicherung ersetzen?"
            : action === "reset" ? "Alle Klassen, Spieler und Turniere einschließlich Ergebnisse zurücksetzen?"
              : "Beispieldaten in den leeren Bestand laden?",
          detail: action === "seed" ? "Es werden 4 Klassen, 12 Spieler und 4 Beispielturniere mit allen drei Turniermodi angelegt. Es werden keine Konten angelegt."
            : `${action === "restore" ? "In der Sicherung" : "Im aktuellen Bestand"}: ${counts.classes} Klassen, ${counts.players} Spieler, ${counts.tournaments} Turniere, ${counts.matches} Spiele.\n\nVor dem Austausch wird der aktuelle Bestand automatisch gesichert. Während der Datenaktion wird der Netzwerkbetrieb kurz unterbrochen. Verbundene Geräte verbinden sich anschließend neu.`,
          buttons: ["Abbrechen", action === "restore" ? "Bestand ersetzen" : action === "reset" ? "Alles zurücksetzen" : "Beispieldaten laden"],
          defaultId: 0, cancelId: 0, noLink: true,
        });
        if (confirmation.response !== 1) return { message: "Datenaktion abgebrochen. Es wurde nichts verändert." };
      }
      const result = action === "export" ? await maintenance.export(destination)
        : action === "restore" ? await maintenance.restore(prepared) : await maintenance[action]();
      if (action !== "export") await changed();
      await diagnostics.write(`host-${action}`);
      return { message: `${{ export: "Vollständige Sicherung gespeichert.", restore: "Sicherung wiederhergestellt.", seed: "Beispieldaten geladen.", reset: "Der Datenbestand ist jetzt leer." }[action]}\nSicherung: ${result.backupPath}` };
    }
    catch (error)
    {
      await diagnostics.write("host-action-error", { code: error.code ?? error.name });
      return { error: `Die Datenaktion konnte nicht abgeschlossen werden: ${error.message}` };
    }
    finally
    {
      try { if (prepared) await maintenance.discard(prepared); }
      finally { active = false; }
    }
  });
  return { open, busy: () => active };
}

module.exports = { installHostManagement, trustedSender };
