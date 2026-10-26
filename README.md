# Turnier-Hub

An Electron app for school tournaments with a shared catalog of classes, players
and tournaments. The host stores the data and serves the same interface to other
devices in the LAN. No login or user management is required.

Supports group stage + knockout, direct knockout with byes, round robin, team
rosters, match timers, manual scores, live updates and player XLSX import/export.

## Start and use

**Built app:** open **Turnier-Hub.app**. It needs no separate Node.js or development
server. macOS 13+ on Apple Silicon (arm64) is the current target; Windows and signed/
notarized releases are not yet verified.

**From source:** use Node.js 22.13+ within the 22 line or Node.js 24 LTS,
then run from the project root:

```sh
npm ci
npm run dev
```

`dev` and `desktop:dev` build and open the same Electron host, including
**Host-Verwaltung**. Development has its own server on port 3220 and persistent
`.local/desktop-dev/` data. It rebuilds at startup; this workflow has no renderer HMR.

In **Host-Verwaltung**, copy the displayed LAN address and open it on another
device in the same network. Connected devices can edit the shared catalog; changes
update live. Closing the main host window also stops the server and connections.
Use a trusted network: the account-free LAN service uses unencrypted HTTP.

Host management also provides full backup/restore, explicit demo data and confirmed
full reset with automatic backup. These are local host operations. Player XLSX
import/export remains a separate catalog feature.

To build a Mac app, run `npm run desktop:pack:mac` or `npm run desktop:dist:mac`.
`pack` creates `release/desktop/mac-arm64/Turnier-Hub.app`; `dist` also creates a
ZIP under `release/desktop/`. These commands build; open the resulting app to run
it. Build on the native target OS/architecture for the native SQLite driver.

The packaged app defaults to port 3210 and a separate data folder. Its existing
`Turnier-Hub` folder name is retained; it does not follow the app filename.
Old development/prototype data are preserved. Backups require the exact same
schema; there is no automatic schema migration.

## Project structure and package files

The root [package.json](package.json) is the private npm-workspace coordinator:
install dependencies once at the root, run cross-workspace checks/builds here and
use the single `package-lock.json`. It also owns Electron and packaging tools.

- `client/` — Vue, Pinia, router, catalog/tournament UI and HTTP/WS adapters.
  [client/package.json](client/package.json) owns renderer dependencies, Vite,
  client lint/tests and Storybook commands.
- `server/` — Express routes, tournament services, Prisma/SQLite and server lifecycle.
  [server/package.json](server/package.json) owns API dependencies, server compilation,
  focused server tests and manual database tools.
- `shared/` — `@turnier-hub/shared` DTOs and small helpers imported by both apps.
  [shared/package.json](shared/package.json) exports generated JS/types from `dist/`;
  `build` compiles its canonical TypeScript config and npm `prepare` runs that build.
- `desktop/` — dev launcher, resource preparation, packaging config and smoke tools.
  `desktop/app/` contains the local host shell, bounded IPC and maintenance UI.
  [desktop/app/package.json](desktop/app/package.json) supplies the packaged app's
  name, version and main entry. It is not an npm workspace and has no scripts;
  root commands prepare and package its runtime resources.
- `tests/` — server/client tests, Storybook stories/mocks and desktop storage tests.
- `scripts/` — isolated test runner and dependency-audit policy.
- `doc/` — developer guidance, tournament logic and recorded validation limits.
- `examples/` — sample player-import spreadsheets, kept as user-facing examples.
- `.github/`, `.vscode/`, `.cursor/` — CI, editor and contributor-entry settings.

`node_modules/`, workspace `dist/`, `desktop/runtime/` and `release/` are generated.
`.local/` contains development data and local backups. `data/` can contain manual
server databases. Ignored data/builds/backups are not obsolete source to delete.

Electron remains the desktop architecture. The coordinated dependency update
and its remaining audit limits are recorded in the development guide.

## Root scripts

Use `npm run <name>`; `npm test` is the shorthand for `test`. Workspace scripts
with the same name may have a narrower purpose; the root commands below are the
intended entry points.

### Host and packaging

- `dev`, `desktop:dev` — build and open the isolated Electron development host.
- `desktop:runtime` — ensure the Electron development binary is installed; it may
  need a cached download or network access. This is not packaged-app startup.
- `desktop:prepare` — ensure Electron, generate Prisma client, build all workspaces
  and stage server/native resources plus a fresh empty database template. The
  staged SQLite driver is rebuilt for Electron; build-Node dependencies stay separate.
  Schema application happens only to a new temporary build database.
- `desktop:start` — launch already-prepared source resources. It does not supply
  the isolated dev profile itself; normally use `dev`/`desktop:dev` instead.
- `desktop:pack:mac` — prepare resources and build an unpacked macOS arm64 app.
- `desktop:dist:mac` — prepare/build the app and its distributable ZIP.
- `desktop:pack:win`, `desktop:dist:win` — retained native Windows x64/NSIS scaffolding.
  Run only on Windows; Windows operation/portability remains unverified.

### Build, lint, tests and examples

- `build` — build shared, server and client workspaces, in that order; no app launch.
- `lint`, `lint:fix` — check client ESLint or apply its automatic fixes.
- `test` — full server/client/API/Storybook suite using a fresh temporary database.
- `test:client` — client/API/Storybook suite using the same isolated runner.
- `test:integration` — focused client/API integration flows with a fresh temporary DB.
- `test:unit` — focused server unit tests; does not run client or desktop tests.
- `desktop:test` — desktop storage/backup tests against isolated temporary data;
  prepare resources first with `desktop:prepare`. Tests use Electron’s Node/native
  ABI and temporary data.
- `desktop:smoke` — isolated real Electron startup, LAN, responsive UI and persistence checks.
- `desktop:smoke:host` — isolated management/backup/restore/seed/reset UI checks.
- `desktop:smoke:errors` — isolated occupied-port and missing/corrupt-data error checks.
  Smoke scripts can receive a packaged executable; see the desktop guide for ports.
- `storybook`, `build-storybook` — start component examples or build their static site.
- `security:audit` — registry dependency audit using the existing high/critical policy
  with no package exceptions; it is not a guarantee of no advisories.

### Manual API-only server tools

These do not open Electron or provide host management. They use the selected
server environment; they are not required for ordinary desktop operation.

- `prod:prepare` — generate Prisma client and build the whole app; no schema push.
- `prod:start` — start the compiled API/static server in production mode.
- `prod` — run those preparation and start steps together.
- `dev:test` — API-only watch server using the manual `.env.test` profile (port 3002
  in the supplied profile); it does not create an isolated database for you.

### Manual database tools and their effects

Do not run these against existing real, development or legacy prototype data for
experiments. Use a new deliberately isolated database. The automatic test runners
above create their own temporary database and never select an old test file.

- `db:generate` — regenerate Prisma client code only; no database writes.
- `db:push` — advanced API-sandbox tool: apply the schema to a deliberately new
  selected database. It is not a versioned migration or an app-update step.
- `db:studio` — open Prisma Studio for inspecting/editing the selected database.

For ordinary app use, load demo data and reset through **Host-Verwaltung**.
Manual seed/clear/test-profile DB commands and the duplicate deployment alias
have been removed. Prisma generation, shared demo fixtures and internal fresh
template/test database creation remain. See the
[database command review](doc/DEVELOPMENT.md#database-command-review).

### Dependency/output cleanup

- `clean` — remove root/workspace dependencies, client/server/shared build output
  and known client/shared TypeScript caches. It leaves `.local/`, `data/`,
  `release/` and `desktop/runtime/` alone.
- `clean:install` — run `clean`, then `npm install`; this changes dependencies/output,
  so it is not a routine app-start command.

## Workspace-only commands

Use `npm run <name> -w client`, `-w server` or `-w @turnier-hub/shared` when you
specifically need a lower-level tool:

- Client `dev` / `preview` run Vite or preview its built renderer; they do not supply
  Electron host controls. Client `build`, `lint`, `lint:fix`, `storybook` and
  `build-storybook` are the narrower counterparts used by the root commands.
- Client `test`, `test:integration`, `test:unit`, `test:watch` run the client suites
  or unit-only/watch variants. For API flows use root `test`, `test:client` or
  `test:integration`, which provide the isolated database and reset guard.
- Server `dev` / `dev:test` are API-only watchers; `start` / `start:prod` run compiled
  server output. Server `build` compiles only the server; `prod:prepare` generates
  Prisma and builds only that workspace, unlike the root version.
- Server `test`, `test:unit`, `test:watch` run server tests. The actual API integration
  tests live under `tests/client/integration/` and are owned by the root isolated runner.
- Server `db:generate`, `db:push` and `db:studio` implement the root database
  wrappers. The latter two remain optional API-only developer tools. They are
  never called by packaged startup or required for host management.
- Shared `build` compiles JS/declarations; `prepare` is npm's install-time build hook.

The dated [dependency review](doc/DEVELOPMENT.md#implemented-dependency-update-25-october-2026)
records the original inventory, implemented coordinated updates, validation and
remaining migration/security findings.

## Further information

- [Desktop guide](desktop/README.md): LAN, data folders, host controls and access boundaries.
- [Development guide](doc/DEVELOPMENT.md): deeper check/configuration notes.
- [Validation record](doc/STANDALONE_VALIDATION.md): prior checks and remaining acceptance limits.
- [Tournament logic](doc/TURNIERLOGIK.md), [Prisma schema notes](server/prisma/README.md),
  [Storybook guide](tests/client/storybook/README.md) and [contributor guide](AGENTS.md).
