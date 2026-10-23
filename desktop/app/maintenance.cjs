const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const MAX_DATABASE_BYTES = 128 * 1024 * 1024;
const MAX_BACKUP_BYTES = 180 * 1024 * 1024;
const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
async function exists(file)
{
  try { await fs.access(file); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

async function writeNew(file, bytes)
{
  const handle = await fs.open(file, "wx", 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); }
  catch (error) { await handle.close(); await fs.rm(file, { force: true }); throw error; }
  await handle.close();
}

async function syncFile(file)
{
  const handle = await fs.open(file, "r+");
  try { await handle.sync(); }
  finally { await handle.close(); }
}

const files = (dir) => ({
  db: path.join(dir, "standalone.db"),
  next: path.join(dir, "maintenance-next.db"),
  previous: path.join(dir, "maintenance-previous.db"),
  journal: path.join(dir, "maintenance-pending.json"),
});

async function removeSidecars(db)
{
  for (const suffix of ["-wal", "-shm", "-journal"]) await fs.rm(`${db}${suffix}`, { force: true });
}

// Fixed local paths only. An interrupted replacement always rolls back before
// the application opens SQLite. No paths are read from the journal or backup.
async function recoverReplacement(dataDir)
{
  const f = files(dataDir);
  if (await exists(f.journal))
  {
    if (await exists(f.previous))
    {
      await removeSidecars(f.db);
      await fs.rm(f.db, { force: true });
      await fs.rename(f.previous, f.db);
    }
    await fs.rm(f.next, { force: true });
    await fs.rm(f.journal);
    return true;
  }
  // The journal is removed only after the new database has started successfully.
  if (await exists(f.db)) await fs.rm(f.previous, { force: true });
  await fs.rm(f.next, { force: true });
  return false;
}

function createHostMaintenance({ dataDir, runtimeDir, schemaId, appVersion, database, stop, start })
{
  const f = files(dataDir);
  const template = path.join(runtimeDir, "empty.db");
  let busy = false;

  async function inspect(file)
  {
    return database.inspectDesktopDatabase(file, template);
  }

  async function backupFile(snapshot, destination)
  {
    const stat = await fs.stat(snapshot);
    if (stat.size > MAX_DATABASE_BYTES) throw new Error("Die Datenbank überschreitet die Sicherungsgrenze von 128 MB.");
    const bytes = await fs.readFile(snapshot);
    const backup = {
      format: "turnier-hub-backup", version: 1, schemaId, appVersion,
      createdAt: new Date().toISOString(), settings: { schemaId },
      database: { encoding: "base64", byteLength: bytes.length, sha256: digest(bytes), data: bytes.toString("base64") },
    };
    await writeNew(destination, JSON.stringify(backup));
  }

  async function prepareRestore(source)
  {
    if ((await fs.stat(source)).size > MAX_BACKUP_BYTES) throw new Error("Die Sicherungsdatei ist zu groß (maximal 180 MB).");
    let backup;
    try { backup = JSON.parse(await fs.readFile(source, "utf8")); }
    catch { throw new Error("Die Datei ist keine lesbare Turnier-Hub-Sicherung."); }
    if (backup?.format !== "turnier-hub-backup" || backup.version !== 1) throw new Error("Das Sicherungsformat wird von dieser App nicht unterstützt.");
    if (backup.schemaId !== schemaId || backup.settings?.schemaId !== schemaId) throw new Error("Die Sicherung gehört zu einem anderen Datenbankschema. Sie wird nicht eingespielt.");
    const entry = backup.database;
    if (entry?.encoding !== "base64" || typeof entry.data !== "string"
      || !Number.isInteger(entry.byteLength) || entry.byteLength <= 0 || entry.byteLength > MAX_DATABASE_BYTES)
      throw new Error("Die Sicherung ist unvollständig oder zu groß.");
    const bytes = Buffer.from(entry.data, "base64");
    if (bytes.length !== entry.byteLength || bytes.toString("base64") !== entry.data || digest(bytes) !== entry.sha256
      || bytes.subarray(0, 16).toString() !== "SQLite format 3\u0000")
      throw new Error("Die Prüfsumme der Sicherung stimmt nicht oder die Datenbank ist beschädigt.");
    const dir = await fs.mkdtemp(path.join(dataDir, "restore-check-"));
    const candidate = path.join(dir, "candidate.db");
    try
    {
      await writeNew(candidate, bytes);
      return { dir, candidate, counts: await inspect(candidate), createdAt: backup.createdAt };
    }
    catch (error) { await fs.rm(dir, { recursive: true, force: true }); throw error; }
  }

  async function discard(prepared)
  {
    await fs.rm(prepared.dir, { recursive: true, force: true });
  }

  async function run(action, prepared, destination)
  {
    if (busy) throw new Error("Eine Datenaktion läuft bereits. Bitte warten.");
    busy = true;
    let dir;
    let stopped = false;
    let started = false;
    let backupPath;
    try
    {
      if (action === "export")
      {
        const relative = path.relative(dataDir, path.resolve(destination));
        if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)))
          throw new Error("Bitte die Sicherung außerhalb des App-Datenordners speichern.");
        if (await exists(destination)) throw new Error("Die Datei existiert bereits. Bitte einen neuen Dateinamen wählen.");
      }
      dir = await fs.mkdtemp(path.join(dataDir, "maintenance-"));
      await stop();
      stopped = true;
      const snapshot = path.join(dir, "snapshot.db");
      await database.snapshotDesktopDatabase(f.db, snapshot);
      const counts = await inspect(snapshot);
      if (action === "seed" && Object.values(counts).some((count) => count > 0))
        throw new Error("Beispieldaten können nur in einen leeren Datenbestand geladen werden. Vorhandene Daten wurden nicht verändert.");
      if (action === "export")
      {
        await backupFile(snapshot, destination);
        await start();
        started = true;
        return { backupPath: destination, counts };
      }
      const candidate = path.join(dir, "candidate.db");
      await fs.copyFile(action === "restore" ? prepared.candidate : template, candidate, fs.constants.COPYFILE_EXCL);
      if (action === "seed") await database.seedDesktopDatabase(candidate);
      const nextCounts = await inspect(candidate);
      await fs.mkdir(path.join(dataDir, "backups"), { recursive: true });
      backupPath = path.join(dataDir, "backups", `vor-${action}-${Date.now()}-${crypto.randomUUID()}.thbackup`);
      await backupFile(snapshot, backupPath);
      // Use the verified self-contained snapshot as rollback too, so WAL state
      // from the original connection cannot attach to the replacement database.
      await fs.copyFile(snapshot, f.previous, fs.constants.COPYFILE_EXCL);
      await fs.copyFile(candidate, f.next, fs.constants.COPYFILE_EXCL);
      await syncFile(f.previous);
      await syncFile(f.next);
      await writeNew(f.journal, JSON.stringify({ version: 1, action }));
      await removeSidecars(f.db);
      await fs.rename(f.next, f.db);
      await start();
      started = true;
      await fs.rm(f.journal); // commit point; startup recovers before this point
      await fs.rm(f.previous, { force: true });
      return { backupPath, counts: nextCounts };
    }
    catch (error)
    {
      if (stopped && !started)
      {
        await stop();
        await recoverReplacement(dataDir);
        try { await start(); started = true; }
        catch { throw new Error(`Die Datenaktion wurde abgebrochen. Der Host konnte nicht neu starten. Die bisherigen Daten und Sicherungen bleiben im Datenordner erhalten. ${error.message}`); }
      }
      throw error;
    }
    finally
    {
      try { if (dir) await fs.rm(dir, { recursive: true, force: true }); }
      finally { busy = false; }
    }
  }

  return {
    inspectCurrent: () => inspect(f.db), prepareRestore, discard,
    export: (destination) => run("export", undefined, destination),
    restore: (prepared) => run("restore", prepared),
    seed: () => run("seed"), reset: () => run("reset"),
  };
}

module.exports = { createHostMaintenance, recoverReplacement };
