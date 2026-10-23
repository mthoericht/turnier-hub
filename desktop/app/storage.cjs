const fs = require("node:fs/promises");
const { constants } = require("node:fs");
const path = require("node:path");
const { recoverReplacement } = require("./maintenance.cjs");

function dataError(code, message)
{
  return Object.assign(new Error(message), { code });
}

async function exists(file)
{
  try { await fs.access(file); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

/** Creates only a new, isolated prototype; never repairs by resetting data. */
async function initializePrototypeData(dataDir, runtimeDir)
{
  const schemaId = (await fs.readFile(path.join(runtimeDir, "schema.sha256"), "utf8")).trim();
  const dbPath = path.join(dataDir, "standalone.db");
  const settingsPath = path.join(dataDir, "standalone-settings.json");
  await fs.mkdir(dataDir, { recursive: true });
  await recoverReplacement(dataDir);
  const hasDb = await exists(dbPath);
  const hasSettings = await exists(settingsPath);
  if (hasDb !== hasSettings)
  {
    throw dataError("INCOMPLETE_DATA", "Datenbank und Prototyp-Einstellungen sind nicht vollständig vorhanden. Vorhandene Dateien werden nicht ersetzt. Bitte den Datenordner sichern und die fehlende Datei wiederherstellen.");
  }
  if (hasSettings)
  {
    let settings;
    try { settings = JSON.parse(await fs.readFile(settingsPath, "utf8")); }
    catch (error)
    {
      if (!(error instanceof SyntaxError)) throw error;
      throw dataError("INVALID_SETTINGS", "Die Prototyp-Einstellungen sind beschädigt. Vorhandene Dateien werden nicht überschrieben.");
    }
    if (!settings || typeof settings !== "object" || typeof settings.schemaId !== "string")
    {
      throw dataError("INVALID_SETTINGS", "Ungültige App-Einstellungen. Vorhandene Dateien werden nicht überschrieben.");
    }
    if (settings.schemaId !== schemaId)
    {
      throw dataError("SCHEMA_MISMATCH", "Die vorhandene Prototyp-Datenbank hat einen anderen Schemastand. Sie wird nicht zurückgesetzt. Bitte zuerst sichern; sichere Schema-Updates folgen in einer späteren Etappe.");
    }
    return { dbPath, settings, created: false };
  }

  const settings = { schemaId };
  // Validate the resource before creating any user data. Exclusive writes never
  // replace an existing destination, even if a file appears concurrently.
  await fs.access(path.join(runtimeDir, "empty.db"));
  await fs.copyFile(path.join(runtimeDir, "empty.db"), dbPath, constants.COPYFILE_EXCL);
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), { flag: "wx", mode: 0o600 });
  return { dbPath, settings, created: true };
}

module.exports = { initializePrototypeData };
