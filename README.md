# Turnier-Hub

A shared tournament catalog for school classes and players, available on a local
host and other devices in the same LAN. The standalone version opens directly
without login, registration, user accounts or school tenants.

## Start on macOS

From the project root, install dependencies with `npm ci`, then run `npm run dev`.
`npm run desktop:dev` is the equivalent explicit host-development start. Both open
Electron with its own server on port 3220 and an isolated persistent data folder
at `.local/desktop-dev/`. They rebuild before opening; Vite hot reload is not part
of this host-development workflow. Close the host window to stop the server.

The desktop toolbar's **Host-Verwaltung** opens connection information, full data
backup/restore, optional sample data and confirmed reset. Privileged actions are
local to Electron; LAN browsers have no filesystem bridge. IP addresses and LAN
URLs are shown in host management rather than permanently in a banner.

Build on macOS Apple Silicon:

- `npm run desktop:pack:mac`: builds an unpacked `.app` under `release/desktop/mac-arm64/`.
- `npm run desktop:dist:mac`: builds the same app plus a ZIP under `release/desktop/`.

These are build commands. Open the resulting **Turnier-Hub Prototyp.app** to run
it. The packaged app uses port 3210 by default and its own user-data folder.
See [desktop/README.md](desktop/README.md) for isolation, backup format, prototype
limits and validation. Existing legacy `prototype.db`, development databases and
`.env` files are not migrated or reset. The account-free app uses `standalone.db`.
A changed schema fingerprint is refused; versioned upgrades are not implemented.

## Features

- Shared classes, players and tournaments, editable from connected LAN devices.
- Group stage followed by knockout, direct knockout with byes, and round robin.
- Team rosters, player-as-team tournaments, roster transfer and group/team renaming.
- Manual scores, match timers, standings and mode-aware phase progression.
- Live catalog and tournament updates over WebSockets; automatic reconnect refresh.
- Player XLSX import/export with `Vorname`, `Name`, `Klasse`: append or reconcile.
  Full reset is available only through host management, with an automatic backup.
- Optional demo data covering all three modes, loaded only into an empty catalog.

## Workspace and checks

npm workspaces: `client/` (Vue 3, Pinia, Vite, Tailwind), `server/` (Express,
Prisma, SQLite), and `shared/` (DTOs and formatting helpers). Run commands at the
repository root.

- `npm run build`: shared, server and renderer production build.
- `npm run lint`: client ESLint; typecheck with `npx vue-tsc --build --noEmit` in `client/`.
- `npm test`: server, client, integration and Storybook tests with a fresh temporary
  SQLite database. It does not use an existing `.env.test` database.
- `npm run test:integration`: just the isolated client/API integration tests.
- `npm run desktop:prepare`, then `npm run desktop:test`: desktop storage and
  backup/restore tests with separate temporary data.
- `npm run desktop:smoke:host` / `npm run desktop:smoke:errors`: Electron host
  workflow and startup-failure tests. A packaged executable can also be tested.
- `npm run storybook` / `npm run build-storybook`: component examples.
- `npm run security:audit`: the repository's dependency audit policy wrapper.

`db:push`, `db:seed`, `db:clear` and related development commands are manual tools;
never point them at a real database or a previous prototype database. The packaged
runtime uses its build-time template and never runs Prisma CLI commands.

The ordinary shared LAN API intentionally has no accounts. An internet deployment
requires its own access/network design. Legacy deployment/audit documents may
refer to the earlier account-based application and are not standalone guidance.
