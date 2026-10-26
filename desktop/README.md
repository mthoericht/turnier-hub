# Electron desktop guide

The account-free 0.2.0 prototype runs one local Express/WebSocket server and one
SQLite database on the host computer. Electron provides the local host controls;
other devices use the same tournament interface in their browsers.

## Run and build

From the repository root:

- `npm run dev` or `npm run desktop:dev`: build and open the development host.
- `npm run desktop:pack:mac`: build an unpacked `.app` under `release/desktop/mac-arm64/`.
- `npm run desktop:dist:mac`: build the same app and a ZIP under `release/desktop/`.

The build commands do not open the app. Open **Turnier-Hub.app** afterward.
macOS 13+ on Apple Silicon is the current target; build natively so the bundled Prisma
SQLite driver matches Electron’s ABI. The packaged app needs no separate Node.js or Prisma installation.
Build preparation may need dependencies/downloads; packaged startup runs no Prisma
CLI, downloads or automatic demo seed. Renderer fonts are bundled locally.

Development uses the same Electron host and management controls, with a separate
server/data folder. It rebuilds before opening instead of using renderer HMR.
`desktop:start` is a low-level launch of already-prepared source resources; use
`dev`/`desktop:dev` for the supported isolated development workflow.

## Use another device

1. Start the host app and open **Host-Verwaltung** in the toolbar or app menu.
2. Open the displayed LAN URL on another device connected to the same network.
3. Edit classes, players and tournaments there; changes are shared live.

The packaged default port is 3210; development uses 3220. A port conflict shows an
error rather than stopping the process that owns the port. The displayed addresses
come from the network interfaces available at startup. Restart after changing
networks. An address being listed does not guarantee it is reachable through a
firewall, guest Wi-Fi isolation or VPN. Keep the host awake and connected.

Closing the main host window stops HTTP, WebSockets and Prisma, including on
macOS. Closing only the management window leaves the host running. Browser
clients reconnect automatically after a temporary host interruption and refresh
their catalog/tournament state.

## Host management

**Host-Verwaltung** shows LAN and local addresses, port, version and the actual
data folder. There is no permanent IP-information banner.

- **Daten vollständig exportieren** saves classes, players, tournaments, teams,
  rosters, matches, scores, timer fields and required schema settings together.
  Choose a new filename outside the app data folder; existing files are refused.
- **Sicherung wiederherstellen** checks the file and asks before replacing the
  complete current dataset. The confirmation defaults to Cancel.
- **Beispieldaten laden** explicitly loads 4 classes, 12 players and 4 tournaments
  covering all three modes. A nonempty dataset is refused; startup never seeds it.
- **Datenbestand zurücksetzen** asks before replacing all catalog/tournament data
  with a verified empty database.
- Before restore, reset or seed, the current dataset is saved under `backups/`.
  **Automatische Sicherungen öffnen** opens that folder. Backups are retained;
  there is no automatic cleanup policy.

Complete data operations briefly stop the server and drain active HTTP work.
A SQLite snapshot includes committed WAL data. Restore/reset use a replacement
journal and previous snapshot for rollback if restart fails or an exchange is
interrupted before commit. Browser clients show a connection notice and reconnect.
Finish unsaved edits before replacing data. Player XLSX append/reconcile/export
is separate; the former whole-dataset `reset_all` import is rejected.

## Data folders and compatibility

- Development: `.local/desktop-dev/` inside the checkout, ignored by Git.
- Packaged macOS default: `~/Library/Application Support/Turnier-Hub/`.
- Each uses `standalone.db`, `standalone-settings.json`, `logs/` and optional `backups/`.
- Legacy `prototype.db` / `prototype-settings.json` are left untouched. They are
  not automatically imported into the account-free schema. New datasets start empty.

The app filename is `Turnier-Hub.app`; the existing `Turnier-Hub` data
folder and `TURNIER_HUB_PROTOTYPE_*` configuration names remain for compatibility.
Renaming the app must not silently select a different dataset.

Desktop supplies its database configuration before loading the server and ignores
`server/.env`. Missing halves of a data pair, corrupt settings and changed schema
fingerprints stop startup instead of silently recreating or resetting data.
The diagnostic log is available from the app menu.

`.thbackup` is an unencrypted JSON container holding base64 SQLite data, format
version 1, app/schema versions, byte length and SHA-256 checksum. Limits are
128 MiB for the database and 180 MiB for the file. Validation also checks SQLite
integrity, the exact database schema and data references. A checksum detects
corruption; it does not authenticate the file's author. Store backups appropriately
and keep important copies off the host computer.

Prisma 7 uses the official SQLite adapter with the existing integer-millisecond
timestamp format. The relocated connection URL is normalized for fingerprinting;
models, stored data and version-1 backup identity remain compatible. The native
driver is rebuilt at build time; startup downloads nothing.

Only the exact current schema is accepted. Versioned schema updates and legacy
migration are not implemented. Restore currently requires a running compatible
host. If startup is blocked, preserve the whole data folder and get recovery help;
do not delete individual database/settings files to bypass the error.

## Local access and safety

Use a trusted network and do not forward the app port to the public internet.
The server listens on all IPv4 interfaces and uses unencrypted HTTP. Anyone who
can reach its permitted address can edit the shared catalog. Origin/Host checks
are not user authentication, subnet isolation or a firewall; clients without an
Origin header are allowed.

Browser-origin/desktop-Host checks, input validation, JSON size limits, baseline
headers and WebSocket connection/message/payload/subscription limits remain
active. Desktop does not trust forwarded client-IP headers. Local HTTP deliberately
disables HTTPS-upgrade/HSTS behavior.

The browser renderer has no Node or privileged filesystem bridge. Host operations
check the exact local Electron window, main frame, file URL and allowed action;
native dialogs choose paths. No general LAN filesystem/backup endpoints exist.
Operating-system access to host data files is outside this boundary. Protect the
host and unencrypted backups. For unexpected changes, stop the host and preserve
the complete data folder and diagnostics before recovery.

## Scope of verification

The Mac app, normal development start, packaging, backup/restore, startup failures
and isolated automated suites have been checked. The [validation record](../doc/STANDALONE_VALIDATION.md)
distinguishes that evidence from outstanding acceptance: fresh physical second-
device use, clean-machine offline installation, Windows, signing/notarization,
filesystem/power-loss testing and future schema upgrades. Dependency checks and
the exception-free audit policy are described in the [development guide](../doc/DEVELOPMENT.md#audit-policy).
