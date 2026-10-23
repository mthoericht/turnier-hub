const fs = require("node:fs/promises");
const path = require("node:path");

/** A bounded local event log; credentials and request bodies are never logged. */
function createDiagnostics(dataDir)
{
  const logDir = path.join(dataDir, "logs");
  const logPath = path.join(logDir, "desktop.log");
  let queue = Promise.resolve();
  return {
    logPath,
    write(event, fields = {})
    {
      queue = queue.then(async () =>
      {
        await fs.mkdir(logDir, { recursive: true });
        try
        {
          if ((await fs.stat(logPath)).size > 1024 * 1024)
          {
            await fs.rm(`${logPath}.previous`, { force: true });
            await fs.rename(logPath, `${logPath}.previous`);
          }
        }
        catch (error) { if (error.code !== "ENOENT") throw error; }
        const safeFields = Object.fromEntries(["stage", "code", "port", "created"].filter((key) => fields[key] !== undefined).map((key) => [key, fields[key]]));
        await fs.appendFile(logPath, `${JSON.stringify({ time: new Date().toISOString(), event, ...safeFields })}\n`, { mode: 0o600 });
      }).catch(() => console.error("Desktop diagnostic log could not be written."));
      return queue;
    },
    flush() { return queue; },
  };
}

function describeStartupError(error, stage, port)
{
  if (error.code === "EADDRINUSE") return `Port ${port} ist bereits belegt. Bitte eine andere laufende Turnier-Hub-App beenden oder das Programm schließen, das diesen Port verwendet, und die App neu starten.`;
  if (["EACCES", "EPERM", "EROFS"].includes(error.code)) return "Die App kann auf benötigte Dateien oder den Datenordner nicht zugreifen. Bitte Schreibrechte und Zugriffsfreigaben prüfen. Vorhandene Daten bleiben erhalten.";
  if (["INCOMPLETE_DATA", "INVALID_SETTINGS", "SCHEMA_MISMATCH"].includes(error.code)) return error.message;
  if (stage === "resources") return "Benötigte App-Dateien fehlen oder sind nicht lesbar. Bitte ein vollständiges App-Paket verwenden. Der vorhandene Datenbestand wird nicht ersetzt.";
  if (stage === "server") return "Der lokale Server oder die Datenbank konnte nicht gestartet werden. Bitte das Diagnoseprotokoll prüfen. Eine vorhandene oder beschädigte Datenbank wird nicht durch eine leere ersetzt.";
  if (stage === "interface") return "Die Oberfläche konnte nicht geladen werden. Der Server wird angehalten. Bitte die App schließen und neu starten oder das vollständige App-Paket erneut entpacken.";
  return "Die App konnte nicht gestartet werden. Bitte Datenordner und Diagnoseprotokoll prüfen; vorhandene Daten werden nicht zurückgesetzt.";
}

module.exports = { createDiagnostics, describeStartupError };
