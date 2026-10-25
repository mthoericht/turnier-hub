# Agent / contributor guide

## Current standalone architecture

The account-free application has a shared catalog of classes, players and
tournaments. Login, registration, users, roles, school tenants, creator attribution
and own/all filters have been removed. Do not reintroduce them. School classes
remain; class names are globally unique.

Run scripts from the repository root. npm workspaces are `client/` (Vue 3, Pinia,
Vite, Tailwind), `server/` (Express, Prisma, SQLite), and `shared/`. Import DTOs and
helpers from `@turnier-hub/shared`, not a client-only types barrel.

`npm run dev` and `npm run desktop:dev` use `desktop/dev.mjs`: build the current
source, then open the Electron host with a separate server on port 3220 and data
in ignored `.local/desktop-dev/`. This deliberately uses the real host runtime,
including host management, rather than a privileged API in a normal browser.
The prototype rebuilds instead of using renderer HMR.

Mac Apple Silicon is the current target. `desktop:pack:mac` builds the unpacked
app; `desktop:dist:mac` also produces a ZIP under ignored `release/desktop/`.
Build on the native target OS/architecture for the SQLite driver. Only the staged
`better-sqlite3` copy is rebuilt for Electron; root dependencies keep the build-Node
ABI. `desktop:test` runs under Electron as Node. Windows remains deferred.

## Host privileges and data safety

Read the [desktop guide](desktop/README.md) and
[validation record](doc/STANDALONE_VALIDATION.md) for current behavior and remaining
acceptance limits. See [development](doc/DEVELOPMENT.md) for commands and the
[local access boundary](desktop/README.md#local-access-and-safety).
Electron's `desktop/app/main.cjs` owns the server
lifecycle. Closing the host stops HTTP, WebSockets and Prisma, including on macOS.
The packaged default port is 3210. The main renderer has no Node or privileged
bridge. Only exact local host-management windows/main frames may invoke the
bounded IPC operations in `host-management.cjs` / `host-preload.cjs`.

No general filesystem, backup, seed or reset endpoints in the shared LAN API.
Host management holds all connection information and full data operations.
`maintenance.cjs` snapshots after stopping/draining server work, validates backups
and references, creates automatic backups before replacement, and journals an
exchange for rollback. `desktopData.ts` is imported only by the host runtime;
it is not an Express router. Full reset is also rejected through player import.

Desktop ignores server `.env`. Development and packaged data are isolated.
Account-free files are `standalone.db` and `standalone-settings.json`; legacy
`prototype.db` and `prototype-settings.json` must remain untouched. Do not reset,
seed, push schema to or smoke-test an existing real/development/prototype database.
Changed fingerprints and incomplete data pairs are refused. `schema-identity.mjs`
normalizes only Prisma 7’s relocated connection URL to retain the v1 identity; do
not normalize model changes to bypass this check. `dbClient.ts` uses the official
SQLite adapter with `unixepoch-ms` timestamps for Prisma 6 compatibility. No runtime Prisma CLI
or downloads; `desktop/prepare.mjs` makes a fresh empty template at build time.
Optional demo data may only be loaded explicitly into an empty catalog.

## Verification

- `npm run build` builds all workspaces.
- After substantive client edits run `npm run lint -w client`. When types change,
  run `npx vue-tsc --build --noEmit` from `client/`.
- `npm test` uses `scripts/test-isolated.mjs`, a fresh temporary database and the
  server/client/Storybook suites. `npm run test:client` uses that runner for the
  client suites; `npm run test:integration` is the focused API variant.
  Test reset helpers require the isolated runner. Never substitute an old test DB.
- `npm run desktop:prepare`, then `npm run desktop:test` tests storage and full
  backup/restore. `desktop:smoke`, `desktop:smoke:host` and `desktop:smoke:errors`
  use isolated data. Smoke scripts can accept a packaged executable path.
- Same-host LAN verification does not replace a physical second-device test.
- Do not commit `.env`, SQLite files, node_modules, dist, runtime or release output.

## Server and domain

REST is `/api/classes`, `/api/players` and `/api/tournaments`. WebSocket `/api/ws`
needs no token. Clients subscribe to tournament IDs. `tournamentChanged` goes to
subscribers; `catalogChanged` and `tournamentsChanged` are broadcast. The browser
origin allowlist and local desktop Host checks remain required.

Keep route handlers thin: validate, call a service, notify, respond. Use
`asyncHandler` and global error middleware. Tournament routes are modular under
`server/src/routes/tournaments/`; roster/match services and pure scheduling logic
live under `server/src/services/`. Preserve all three modes, byes, round-robin
parallel rounds, persisted-score advancement and timer semantics.

Prisma schema is `server/prisma/schema.prisma`. Generating the client makes no DB
writes; `db:push` is retained only for deliberately fresh API sandboxes. Manual
seed/clear and test-profile schema shortcuts have been removed. Host management
and isolated tests share `server/src/seed/demoSeed.ts`; never remove that module
as unused CLI code. Seeds use an empty catalog and no accounts.
Player import append/reconcile preserves matching IDs and memberships. Player
names have firstName/lastName and optional schoolClass.

## Client and UI

Pinia domain stores: `dashboard`, `classesManagement`, `playersManagement`,
`tournamentsList`, `tournamentLayout`. Shared global confirmation/text-prompt hosts
are in App.vue. Use toast messages for action errors. Vue Router opens dashboard
directly; old unknown routes redirect home. Realtime reconnect refetches active
catalog/tournament state. Preserve unsaved score draft merging on ordinary refetch.

Reuse `CatalogPageHeader`, `EmptyStateCard`, shared buttons/inputs and semantic
colors in `client/src/style.css`. Fonts/tokens are centralized under theme/.
Keep UI German; README and this guide English. Match ESLint style (semicolons,
Allman braces, two spaces). Keep responsive navigation and existing breakpoints.

Preserve skip link and landmarks, active route aria-current, labels and errors,
keyboard focus visibility, table captions and column scopes. Use EntityDialog or
useDialogFocusTrap for modal focus, Escape and return-focus behavior. Backdrop
drags originating inside a dialog must not accidentally close it.

Storybook config/mocks/fixtures are under tests/client/storybook. Name the primary
CSF export Default when reasonable. Read its README for router canvas and mocks.
Keep stories and fixtures in sync with account-free DTOs; no obsolete auth/scope
imports. Preserve focused diffs and existing unrelated work; no automatic data
migration or reset as a shortcut to fixing a build.
