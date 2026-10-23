# macOS standalone prototype

The current 0.2.0 source is account-free: the dashboard opens directly. Classes,
players and tournaments are shared by connected devices. There is no sign-up,
invite code, role or user management.

## Start the correct checkout

Run `npm run dev` or `npm run desktop:dev` from the main project folder.
Both commands build and open the same account-free Electron host, including host
management. Development uses its own server on port 3220 and its own persistent
ignored `.local/desktop-dev/` data folder; it never uses the old `.env` database.
This prototype development start rebuilds the renderer instead of using Vite HMR.
A regular LAN browser cannot host privileged backup operations; Electron supplies
the local trusted window for them.

`npm run desktop:dist:mac` builds an unsigned Apple Silicon app and ZIP under
`release/desktop/`. Direct app launches use port 3210 and the prototype user-data
folder by default. An occupied port is reported rather than taking over another
process. Closing the host window stops HTTP, WebSockets and Prisma.

## Host management

Use **Host-Verwaltung** in the desktop toolbar or the Turnier-Hub application
menu. Connection addresses, port, app version and the actual data folder are
shown here, rather than permanently in a banner. Addresses reflect the interfaces
available when the server started; restart after changing networks.

- **Daten vollständig exportieren** saves the complete database and required
  schema settings in one `.thbackup` file using a native save dialog. Existing
  files are never overwritten; choose a new name. Save outside the app data folder.
- **Sicherung wiederherstellen** validates format version, schema fingerprint,
  checksum, SQLite integrity, exact schema and catalog/tournament references before
  touching the active database. A native confirmation defaults to Cancel.
- **Beispieldaten laden** explicitly loads 4 classes, 12 players and 4 tournaments
  covering all three tournament modes. A nonempty catalog is refused. Startup
  never automatically seeds data.
- **Datenbestand zurücksetzen** requires confirmation and replaces all catalog
  and tournament data with a verified empty database.
- Before restore, reset or seed, the current complete database is automatically
  backed up under `backups/`. **Automatische Sicherungen öffnen** opens that folder.

The server is stopped and active HTTP work drains before a snapshot or exchange.
A SQLite `VACUUM INTO` snapshot incorporates committed WAL pages. File handles
are closed before replacement. A replacement journal and previous snapshot allow
rollback if restarting fails or the app is interrupted before commit. On the next
startup, an unfinished exchange rolls back before opening the database. Copies in
`backups/` are retained; there is no automatic retention/deletion policy yet.

LAN browsers temporarily lose their server connection during a data action and
show a connection notice. They reconnect and refresh the catalog and tournament
lists afterward. Finish unsaved edits before replacing a dataset.

The privileged bridge is exposed only in local Electron host windows. Calls check
the exact web contents, main frame and local file. The LAN renderer has no bridge,
Node access or filesystem endpoints. Player XLSX import/export remains a separate
catalog feature.

The former `reset_all` player-import option is rejected by the LAN API and no
longer offered in the import dialog. Full reset now belongs to host management.
Appending and reconciling players and XLSX export remain catalog features.

Backups are unencrypted JSON containers containing base64 SQLite data, format
version 1, app version, schema fingerprint, byte length, SHA-256 checksum and
required settings. Database size is limited to 128 MiB, backup files to 180 MiB.
Checksums detect corruption; they do not authenticate the file's author. Only the
exact current schema is accepted. No legacy-auth migration or versioned schema
upgrade is implemented.

## Data isolation

The account-free version uses `standalone.db` and `standalone-settings.json`.
Legacy `prototype.db` and `prototype-settings.json` are not migrated, overwritten
or reset. Development `.env` is ignored by the desktop runtime. Missing halves of
an existing data pair, corrupt settings and changed schema fingerprints stop
startup instead of silently replacing data.

No Prisma CLI commands or downloads run in the packaged application. The build
creates an empty SQLite template, bundles server/seed code, native Prisma resources
and local fonts. Build on the native target OS and architecture.

## Verification

Run `npm run desktop:prepare` before the database tests, then:

- `npm run desktop:test`: isolated storage, backup/restore, corruption, WAL,
  concurrency, rollback/restart and privileged-context checks.
- `npm run desktop:smoke:host`: isolated real Electron UI and API verification,
  including cancel/confirm flows and constructed LAN admin requests. Native file
  picker results are automated in this test. A packaged executable path can be
  passed directly to `desktop/maintenance-smoke.mjs`.
- `npm run desktop:smoke:errors`: occupied port, missing database and corrupt
  settings/database checks; optionally accepts a packaged executable path.
- Client lint, typecheck and reconnect unit tests cover the connection notice and
  data refresh after a host operation.

The earlier physical second-device LAN test was confirmed by the user for the
old prototype. It does not constitute acceptance of the new host-management flow.
Windows, signing/notarization, cross-platform restore, power-loss/filesystem fault
injection and full feature acceptance remain outstanding. The account-free
server/client/integration/Storybook tests now pass with an isolated database.

## Verified checkpoint: 23 October 2026

- `npm run desktop:test`: 19/19 tests passed.
- Reconnect adapter: 6/6 client unit tests passed; server lifecycle: 2/2 passed.
- Client lint, Vue typecheck and full workspace production build passed.
- The packaged macOS arm64 0.2.0 app passed the complete host UI smoke flow,
  including the rejected legacy LAN reset and preserved player reconciliation.
- The same package passed all four startup-error scenarios: occupied port,
  missing database, corrupt settings and corrupt database.
- The packaged app was started with an isolated preview data folder; the dashboard
  and host-management window were visibly verified on port 3211 with separate
  persistent preview data. No old project or prototype databases were used.
- The subsequent account-free test adaptation passed 51 server and 91 client,
  integration and Storybook tests with a fresh temporary database. This remains
  a prototype checkpoint rather than full cross-platform acceptance.

Restore currently requires a running compatible host. If startup is blocked by
corrupt data/settings or a schema mismatch, preserve the complete data folder
and seek recovery assistance rather than deleting individual database files.

## Main-project integration verified

The main checkout at `/Users/marcus/gitRoot/turnier-hub` now contains the same
account-free source. Its previous changed files were preserved under ignored
`.local/integration-backup-20261023-160308/`; unrelated tsconfig changes remain.

The actual root `npm run dev` (which calls `desktop:dev`) opened the native
Electron dashboard and host management on port 3220, using `.local/desktop-dev/`.
The root `desktop:pack:mac` and `desktop:dist:mac` commands rebuilt successfully.
The rebuilt main-checkout app was visibly opened with its ordinary port 3210 and
showed the dashboard and host management without login. The former separate
starter is no longer needed or provided.

From the main checkout, 51 server tests, 91 client/integration/Storybook tests,
19 desktop tests, client lint and Vue typecheck passed. The rebuilt package passed
full host-management smoke, four startup-failure cases, same-host LAN HTTP/WS,
responsive layouts/local fonts, single-instance handoff and restart persistence.
Existing development/test databases and old prototype database/settings were
hashed before integration and checked afterward. No schema push or reset was
performed on those files. New development and standalone data start empty.
