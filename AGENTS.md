# Agent / contributor guide

This document helps humans and coding agents work effectively in **turnier-hub**. For user-facing documentation, see [README.md](README.md).

## Repository shape

- **npm workspaces** at the repo root: `client/` (Vue 3 + Vite + Tailwind), `server/` (Express + Prisma + local **PostgreSQL** for dev/test), **`shared/`** (`@turnier-hub/shared` — TypeScript types and small helpers shared by client and server: catalog API shapes such as `Player`, `SchoolClass`, `CreatedBy`, `AuthUser`, `formatCreator`, `formatPlayerName` in `shared/src/catalog.ts`; tournament DTOs in `shared/src/tournament.ts`). Import from **`@turnier-hub/shared`** in app code (no client-only `types.ts` barrel).
- Run **install and most scripts from the repository root**, not only inside `client` or `server`, unless you have a reason.
- **Root `.npmrc`:** `legacy-peer-deps=true` so npm can install **Vite 8** together with **`vite-plugin-pwa@1.2.0`**, whose `peerDependencies.vite` still ends at `^7.0.0` (clean install otherwise fails with `ERESOLVE`). Revisit when upstream adds Vite 8 — track [vite-pwa/vite-plugin-pwa#923](https://github.com/vite-pwa/vite-plugin-pwa/issues/923).
- **Root `package.json` `overrides`:** `@rollup/plugin-terser@^1.0.0` and `serialize-javascript@^7.0.5` so the Workbox build chain does not pull vulnerable `serialize-javascript@6.x` (keeps **`npm run security:audit`** passing aside from the allowlisted **`xlsx`** advisory). With `legacy-peer-deps`, some ESLint peers are not auto-installed; **`client`** lists **`vue-eslint-parser`** explicitly for that reason.
- **AWS migration in flight:** the codebase is being moved to a fully serverless AWS stack (Lambda Function URLs + CloudFront + RDS PostgreSQL + DynamoDB). Status, decisions, and phase-by-phase plan live in [`MIGRATION_AWS.md`](MIGRATION_AWS.md). Phase 1 (Postgres) and Phase 2 (state adapters + WS→SSE) are merged; Phase 3+ is in progress.

## Commands (from repo root)

| Goal | Command |
| ---- | ------- |
| Init local Postgres cluster (no Docker) | `npm run db:init` |
| Start local Postgres cluster | `npm run db:start` |
| Check local Postgres status | `npm run db:status` |
| Stop local Postgres cluster | `npm run db:stop` |
| Restart local Postgres cluster | `npm run db:restart` |
| Check SAM + Docker tooling | `npm run dev:lambda:check` |
| Lambda local stack (SAM + local Postgres) | `npm run dev:lambda` |
| Lambda local API only | `npm run dev:lambda:sam` |
| Lambda one-shot invoke (sample event) | `npm run dev:lambda:invoke` |
| Dev (API + Vite) | `npm run dev` |
| CDK synth (all infra stacks) | `npm run cdk:synth` |
| CDK diff (all infra stacks) | `npm run cdk:diff` |
| CDK deploy (all infra stacks) | `npm run cdk:deploy` |
| Production build (server + client) | `npm run build` |
| Lint client (ESLint) | `npm run lint` / `npm run lint:fix` |
| Prod: generate Prisma client + build | `npm run prod:prepare` |
| Prod: start API + static SPA (`NODE_ENV=production`) | `npm run prod:start` |
| Prod: prepare + start in one step | `npm run prod` |
| Apply Prisma schema (dev `.env`) | `npm run db:push` (= `prisma db push`) |
| Apply schema (production naming; uses current `DATABASE_URL`) | `npm run db:deploy` (= `prisma db push`) |
| Prisma Studio | `npm run db:studio` |
| Regenerate Prisma client | `npm run db:generate` |
| Seed demo data (dev) | `npm run db:seed` |
| Clear DB (dev, keep `User`) | `npm run db:clear -- --yes` |
| Test DB schema + seed | `npm run db:push:test` / `npm run db:seed:test` |
| Clear DB (test, keep `User`) | `npm run db:clear:test -- --yes` |
| API only, test env (`PORT` 3002) | `npm run dev:test` |
| Vitest (all: server + client) | `npm run test` |
| Vitest (client tests: unit + integration) | `npm run test:client` |
| Vitest unit only (server) | `npm run test:unit` |
| Vitest integration (client-API flow + test DB push) | `npm run test:integration` |
| Security audit (policy wrapper) | `npm run security:audit` |
| Clean install | `npm run clean:install` |

- **Server** entry: `server/src/index.ts` creates an **HTTP** server from the Express app. The realtime push uses **Server-Sent Events** on **`GET /api/sse`** (JWT via query `token=`, optional `?tournaments=t1,t2` filter). The legacy `ws`-based hub was removed in the Phase-2 AWS migration step. Production (legacy single-VM): `node server/dist/index.js` (`start` / `start:prod` in server workspace). Production (AWS, in progress): the same Express app runs inside a Lambda via `serverless-http`; SSE has its own streaming Lambda handler.
- **Client** dev server proxies **`/api`** to the backend (default `http://localhost:3001`); SSE on `/api/sse` works through that proxy as a regular long-lived HTTP response (no `ws: true` needed since the legacy WebSocket hub was removed).
- **Client** ESLint: flat config in `client/eslint.config.js` (`typescript-eslint`, `eslint-plugin-vue`; stylistic rules include semicolons, Allman braces, 2-space indent).
- Tests live in the repository root under `tests/` (`tests/server/**`, `tests/client/**`), executed via each workspace's Vitest config.
- **Storybook** (`npm run storybook`): config under `tests/client/storybook/` — for **fixtures, mocks, router canvas, and Vitest integration** see [`tests/client/storybook/README.md`](tests/client/storybook/README.md). Name the primary CSF export **`Default`** when reasonable so URLs and tooling that expect `…--default` keep working; preview wraps the canvas with padding and uses **non-inline** docs stories for reliable Vue rendering. Example: `tests/client/storybook/stories/components/common/CatalogPageHeader.stories.ts`.
- **Playwright (client tests):** `npm run test` / `test:client` runs Storybook stories in headless Chromium via Vitest. Install browsers once after `npm install` or a Playwright version bump: **`npx playwright install chromium`** from the repo root (details in [`tests/client/storybook/README.md`](tests/client/storybook/README.md)).
- Realtime tests: `tests/server/unit/eventBus.test.ts` (in-memory bus, subscription filtering, listener isolation) + `tests/server/unit/sseEndpoint.test.ts` (SSE handler over a real HTTP server: auth, frame routing, listener cleanup on disconnect) and `tests/client/unit/realtimeClient.test.ts` (EventSource adapter behaviour).
- Client TypeScript config uses `tsconfig.base.json` + `tsconfig.app.json`/`tsconfig.node.json`; `*.tsbuildinfo` is cache-only and ignored.

## GitHub Actions

Workflow definitions live in [`.github/workflows/`](.github/workflows/). For triggers, inputs, environment secrets, and CI details (including the ephemeral Postgres service used by `test.yml`), see [`.github/workflows/README.md`](.github/workflows/README.md).

| Workflow | Role |
| -------- | ---- |
| `client-build.yml` | On push/PR to `main` or `master`: `npm ci`, then `npm run build -w client` (no AWS). |
| `test.yml` | On push/PR to `main` or `master`: `npm test` (server + client Vitest, including Playwright/Chromium; test DB in a job service container). |
| `security-audit.yml` | On push/PR to `main` or `master`, plus weekly cron: `npm run security:audit`. |
| `spa-deploy.yml` | Manual only: build client; optional S3 sync and CloudFront invalidation via inputs (`deploy_to_aws`, `invalidate_cloudfront`). |

Runs use **GitHub-hosted runners**, not your production AWS resources, except when `spa-deploy.yml` is executed with AWS deploy enabled.

## Environment and secrets

- Copy `server/.env.example` → `server/.env` for local development. Do **not** commit `.env`.
- `DATABASE_URL` in `.env` is a Postgres connection string; default points at `postgresql://turnier:turnier@localhost:5432/turnier_dev?schema=public`.
- **Test** profile: `server/.env.test` (separate Postgres database, default `postgresql://turnier:turnier@localhost:5432/turnier_test?schema=public`). Seed respects an already-set `DATABASE_URL` so `dotenv-cli` can target the test DB.
- Local Postgres can run from `data/postgres` via root scripts (`db:init` / `db:start` / `db:stop`). Logs go to `data/postgres.log`. The helper auto-detects Homebrew Postgres (`postgresql@16/bin`); if binaries are still not in PATH, use `PG_BIN=/path/to/postgres/bin`.
- SAM local (`sam local start-api`) is optional and still relies on Docker for Lambda runtime emulation, but uses the same local Postgres DB (`localhost:5432`).
- Typical keys: `JWT_SECRET`, `INVITE_CODE`, `PORT`, `DATABASE_URL`, `CORS_ALLOWED_ORIGINS`, `TRUST_PROXY`.

### Local Postgres quick setup (macOS, no Docker)

```bash
brew install postgresql@16
npm run db:init
npm run db:start
npm run db:push
npm run db:push:test
```

If Prisma reports `P1010: User was denied access`, the server logs **User was denied access** / database **`(not available)`** on first query, or Postgres reports **`FATAL: role "turnier" does not exist`**, fix local role/db ownership once:

```bash
PG_BIN="$(brew --prefix postgresql@16)/bin"

$PG_BIN/psql -d postgres -c "CREATE ROLE turnier WITH LOGIN PASSWORD 'turnier';" || true
$PG_BIN/psql -d postgres -c "ALTER ROLE turnier WITH LOGIN PASSWORD 'turnier';"

$PG_BIN/psql -d postgres -c "CREATE DATABASE turnier_dev OWNER turnier;" || true
$PG_BIN/psql -d postgres -c "CREATE DATABASE turnier_test OWNER turnier;" || true

$PG_BIN/psql -d postgres -c "ALTER DATABASE turnier_dev OWNER TO turnier;"
$PG_BIN/psql -d postgres -c "ALTER DATABASE turnier_test OWNER TO turnier;"
$PG_BIN/psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE turnier_dev TO turnier;"
$PG_BIN/psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE turnier_test TO turnier;"

$PG_BIN/psql -d turnier_dev -c "ALTER SCHEMA public OWNER TO turnier; GRANT ALL ON SCHEMA public TO turnier;"
$PG_BIN/psql -d turnier_test -c "ALTER SCHEMA public OWNER TO turnier; GRANT ALL ON SCHEMA public TO turnier;"
```

## Database and Prisma

- Schema: `server/prisma/schema.prisma` (`provider = "postgresql"`).
- **`db:push` / `db:deploy`** both run **`prisma db push`** (apply current schema). **`db:generate`** regenerates the Prisma Client only (no DB writes).
- **Dev DB**: uses `server/.env` and the root scripts:
  - Apply migrations: `npm run db:push`
  - Seed demo data: `npm run db:seed` (script: `server/scripts/seed.ts`)
    - Under the hood: `server/package.json` configures Prisma seed (`prisma.seed`) to run `tsx scripts/seed.ts`.
  - Clear DB (keep `User`): `npm run db:clear -- --yes` (script: `server/scripts/clearDbExceptUsers.ts`)
    - Under the hood: `server/package.json` runs `tsx scripts/clearDbExceptUsers.ts`.
- **Test DB**: uses `server/.env.test` and the root scripts:
  - Apply migrations: `npm run db:push:test`
  - Seed demo data: `npm run db:seed:test` (same script: `server/scripts/seed.ts`)
    - Under the hood: same `tsx scripts/seed.ts`, but executed with `dotenv -e .env.test`.
  - Clear DB (keep `User`): `npm run db:clear:test -- --yes` (same script: `server/scripts/clearDbExceptUsers.ts`)
    - Under the hood: same `tsx scripts/clearDbExceptUsers.ts`, but executed with `dotenv -e .env.test`.
- **Production (legacy single-VM)**: uses host environment variables (especially `DATABASE_URL`) and runs `npm run db:deploy` to apply schema.
- **Production (AWS, in progress)**: a dedicated `migrate`-Lambda runs `prisma migrate deploy` against RDS Postgres on deploy (CDK custom resource — Phase 4).
- **Schema iteration:** edit `schema.prisma`, run `npm run db:push` (and `npm run db:push:test` for test profile), then run tests.

## API surface (high level)

- REST under `/api`: `/api/auth`, `/api/admin`, `/api/classes`, `/api/players`, `/api/tournaments` (nested routes for teams, roster members, matches, timer, advance, standings, delete all matches, etc.).
- **Admin API (`/api/admin`, admin-only):**
  - Schools: `GET/POST /schools`, `PATCH/DELETE /schools/:id`
  - Users: `GET /users`, `PATCH /users/:id/role`, `PATCH /users/:id/school`
  - Safety constraints: school delete is blocked while users are assigned; demoting the last remaining admin is blocked.
- **Realtime** uses **Server-Sent Events** at **`GET /api/sse`** (same origin/port as the API in production; query `?token=<JWT>` and optional `?tournaments=t1,t2`). The handler authenticates the JWT, registers a listener with the in-process `RealtimeEventBus`, and writes typed SSE frames (`event: tournamentChanged|catalogChanged|tournamentsChanged`). After catalog or tournament-list mutations the server **broadcasts** `catalogChanged` (players/classes) and `tournamentsChanged` to every subscriber; `tournamentChanged` only goes to subscribers that opted into that tournament id (`server/src/realtime/eventBus.ts`, `sseEndpoint.ts`, `notify.ts`, route handlers).
- The realtime backend is bus-shaped on purpose: `MemoryEventBus` runs single-process (dev, tests, legacy VM), and the upcoming `DynamoEventBus` (Phase 5) will fan out events across REST-Lambda → SSE-Lambda via a DynamoDB event log.
- Auth: `Authorization: Bearer <JWT>`; client stores token in **localStorage** key `turnier_hub_token`.

## Front end

- **Pinia:** global **`auth`** and **`toast`**; domain stores in `client/src/stores/` — **`tournamentLayout`** (active tournament detail, standings, score draft, roster form state), **`playersManagement`**, **`classesManagement`**, **`tournamentsList`**, **`dashboard`**. **Global modal APIs (no local `EntityDialog` in views):** **`confirmDialog`** (`requestConfirm` → boolean) and **`textPromptDialog`** (`requestPrompt` → string or null); hosts in **`App.vue`** (`EntityDialog` + **`GlobalTextPromptDialog.vue`**). Feature composables mostly **delegate** to these stores (`storeToRefs` + `onMounted` loads); admin view state lives in `client/src/composables/admin/useAdminManagementState.ts`. **Vue Router**.
- **Auth roles:** `AuthUser` now includes `role` (`admin` | `user`). Prisma stores roles as `ADMIN` / `USER` (`User.role`, default `USER`). The top navigation shows the `/admin` entry only for admins.
- **Realtime client:** `client/src/realtime/realtimeClient.ts` — opens an `EventSource` on `/api/sse?token=…&tournaments=…` after login/hydrate, closes it on logout; **subscribe/unsubscribe** tournament IDs from `useTournamentLayoutState` mutate the URL set and trigger a debounced (`queueMicrotask`) reconnect of the SSE stream. Dynamic `import()` of stores in the message dispatcher avoids circular deps with `auth` (prefer **relative** paths in those imports for `vue-tsc`).
- **Realtime client tests:** `setRealtimeDispatchForTests(...)` exists only as a small test seam for unit tests; production code should keep using the default internal dispatch.
- Styling: keep style decisions centralized. Use `client/src/style.css` for semantic UI color variables and shared utility classes (`.ui-card`, `.ui-btn-*`, `.ui-input-*`, etc.). Keep font and Tailwind token sources in `client/src/theme/designTokens.js` and `client/src/theme/fonts.css`.
- **Catalog list / dashboard header:** `client/src/components/common/CatalogPageHeader.vue` — shared title row for **`DashboardView`** (signed-in dashboard), **`ClassesViewPreset`**, **`PlayersViewPreset`**, **`TournamentsView`**. Props: `title`; optional **`variant`**: `catalog` (default, includes `mb-6`) or **`hero`** (larger title, no bottom margin — parent supplies vertical spacing, e.g. `space-y-8`). Slots: **`description`** (optional intro copy; inner wrapper `max-w-3xl`), **`actions`** (e.g. `ScopeToggle`, filters, primary buttons).
- **Toasts:** `client/src/stores/toast.ts` (`showError` / `showSuccess` / `showInfo`); **`ToastHost.vue`** is mounted in `App.vue` (fixed overlay, no `Teleport` + `TransitionGroup` together — known Vue pitfall).
- **Tournaments:** parent layout `TournamentLayout.vue` syncs the route id to **`tournamentLayout`** Pinia store, `provide`s `tournamentLayoutKey` from `client/src/tournament/tournamentContext.ts`; child routes **Mannschaften** (`TournamentRosterView.vue`) and **Spiele** (`TournamentMatchesLayout.vue` with overview/setup views), top tabs **Mannschaften**, **Spiele**, and **Spielbetrieb** (any signed-in user may edit; `canUserEditTournament` in `tournamentDerive.ts` is true when a tournament is loaded and the user is logged in). Default redirect is **roster**. In `GROUP_KO`, `groupCount` is configured in Spielbetrieb next to "Gruppenspiele erzeugen"; `advancesPerGroup` is saved via "Einstellungen speichern". **Core tournament logic** lives under `client/src/tournament/` (API, pure derive/format helpers, UI class tokens, **`useTournamentLayoutState`** as a thin bridge to the store, `useTournamentPhaseStepper`). **Roster-specific behavior** (transfer from another tournament — source list uses **all** tournaments, add-member form state, grouped team display, rename prompts, add individual as team) lives in `client/src/composables/tournaments/useTournamentRoster*.ts` and is composed in `TournamentRosterView.vue`. Paths `roster`, `matches`, `matches/setup`.
- **Tournament modes** (`TournamentMode` enum): `GROUP_KO` (classic group stage → knockout), `DIRECT_KO` (direct knockout, supports arbitrary team counts with byes), `ROUND_ROBIN` (everyone vs everyone, no knockout). Mode is set at tournament creation. `teamsAreIndividuals` flag makes players into teams directly (e.g. Badminton). `groupCount` distributes teams into N groups for GROUP_KO mode.
- **Phase flow** is mode-aware and displays concrete rounds: GROUP_KO / DIRECT_KO show `Achtelfinale`, `Viertelfinale`, `Halbfinale`, `Finale` (as applicable), then `Ende`; ROUND_ROBIN shows `Spiele → Ende`.
- **Round-robin scheduling** uses the circle method with parallel rounds (`roundOrder` on Match); UI shows "Spielrunde N (X Spiele parallel)".
- **KO bracket** generation: `server/src/services/knockoutBracket.ts` centralizes randomization + pairings and handles byes (null `awayTeamId`). Bye matches are created as `FINISHED` and auto-resolved when advancing.
- **Tournament routes are modularized** under `server/src/routes/tournaments/` (`index.ts`, `core.ts`, `teams.ts`, `matches.ts`, `standings-advance.ts`, `shared.ts`). Route handlers are thin (validate → service → notify → respond); business logic lives in `server/src/services/tournamentRosterService.ts` and `tournamentMatchService.ts`.
- **Score draft:** `buildScoreDraftFromMatches` / `mergeScoreDraftFromMatches` in `tournamentDerive.ts` — merge on **`load()`** (including **SSE-driven** refetches) avoids overwriting in-progress edits; draft defaults missing DB scores to **`"0"`**; **`parseScoreDraftForPatch`** requires **both** goals when saving (no partial PATCH). Tournament action errors use **toasts** from the layout store / `useTournamentLayoutState` (initial load failure still uses layout `error`). **Regenerate group / advance** confirm dialogs when existing results would be lost (`groupRegenerateRisksDataLoss`, `advanceTargetRisksDataLoss` in `tournamentDerive.ts`). "Freilos" replaces `—` for null awayTeam in KO matches.
- **Delete all matches:** `DELETE /api/tournaments/:id/matches` removes every match and resets the phase to `GROUP`. In the Spielbetrieb view, a **"Danger zone"** section (visible when matches exist) offers a red **"Delete all matches and groups"** button with a `confirm()` dialog. Client: `deleteAllMatches` in `tournamentsApi.ts` / `useTournamentLayoutState`.
- **Group generation guard:** `POST /api/tournaments/:id/generate-group-matches` only includes teams with at least one member; empty teams are excluded and their `groupLabel` stays/gets `null`.
- **Group regeneration behavior:** `POST /api/tournaments/:id/generate-group-matches` removes existing KO matches before creating new group matches.
- **Renaming:** Team names can be changed via `PATCH /api/tournaments/:id/teams/:teamId`; group labels via `PATCH /api/tournaments/:id/groups/rename`.
- **Auto-complete on final:** If final match(es) are finished, tournament phase is set to `COMPLETED`.
- **K.O. randomness:** Direct-KO generation and qualifier-based KO creation both use randomized pairings.
- **Server KO advancement:** `requireKnockoutWinnerTeamId` in `server/src/services/standings.ts` (used by `advancePhase.ts`) — winners come from **persisted** `homeScore`/`awayScore` only; timer **end** alone does not set them.
- **Match stopwatch (UI):** `useMatchTimerDisplay` in `client/src/composables/tournaments/useMatchTimerDisplay.ts` drives `MatchTimer.vue` (used by `TournamentMatchCard.vue`); it calls `computeMatchElapsedMs` in `client/src/tournament/matchElapsed.ts` (same rules as `server/src/services/matchTimer.ts`) with ISO timer fields from the API. **LIVE** matches refresh the display on a **local** 1s interval; **no** per-second network polling. **PAUSED** / finished times need no ticking. Timer **state** still comes from REST + SSE-driven refetches when matches change.
- **Classes / players:** route `/classes`, `/players`; API `classesApi.ts`, `playersApi.ts` (query `scope=all|own` filters the list only). Player data uses `firstName` + `lastName` (no single `name` field). **Player** dialogs load **all** classes for the class dropdown (`schoolClassOptions` in `playersManagement` store). Players list UX: class filter + free-text search (`Vorname`, `Name`, combined full name, `Klasse`) and sortable columns (`Vorname`, `Name`, `Klasse`, asc/desc). On narrow layouts, creator attribution is shown as compact text below row action buttons instead of a dedicated table column. Players page has an **Import/Export** dialog: import via `POST /api/players/import` expects `Vorname`, `Name` (last name), `Klasse` and supports `append`, `replace_players` (diff by first/last/class; only missing rows deleted), and `reset_all` (clears tournaments, players, classes before import); export writes current players to XLSX with the same schema. Server: any authenticated user may PATCH/DELETE any class or player; tournament roster `POST …/members` accepts any catalog player id (`requireTournamentExists` replaces owner checks in `server/src/routes/tournaments/shared.ts`).
- Prefer **responsive** patterns already used: mobile nav in `App.vue`, `sm:` / `md:` breakpoints elsewhere.

## Conventions for changes

- Keep diffs **focused** on the requested task; match existing style, imports, and naming.
- Do **not** commit `.env`, generated `dist/` / `node_modules/`, or any local Postgres data dirs (Docker volumes already keep them outside the repo).
- **English** for `README.md` and this file; product UI strings may stay **German** unless the project moves to i18n.
- If you add new env vars, update `server/.env.example` and [README.md](README.md) when relevant.
- After substantive client edits, run **`npm run lint -w client`** (and `vue-tsc --build --noEmit` in `client/` if types are touched).
- For server routes, prefer `asyncHandler` (`server/src/middleware/asyncHandler.ts`) and let unknown errors bubble to the global `errorMiddleware` (`server/src/middleware/error.ts`) instead of repeating local `500` handlers.

## Accessibility (client)

- **Skip link:** `App.vue` — first focusable control skips to `#main-content` (`<main id="main-content" tabindex="-1">`).
- **Landmarks / navigation:** `<header>`, `<main>`, `<nav>` with `aria-label` where needed; tournament breadcrumb uses `<nav aria-label="Brotkrumen">` with an ordered list; main nav and tournament tabs use `aria-current="page"` on the active route.
- **Forms:** `AuthFormField` wires `label`/`for`, optional `aria-describedby` for help text, and `aria-invalid` when appropriate; destructive or global errors often use `role="alert"`.
- **Modal dialogs:** `EntityDialog.vue` sets `role="dialog"`, `aria-modal="true"`, `aria-labelledby` (title), optional `aria-describedby` (description), and uses **`useDialogFocusTrap`** (`client/src/composables/useDialogFocusTrap.ts`) — ref on the dialog root, Tab cycles inside the overlay, Escape closes, focus returns to the opener. New modal UIs that are not `EntityDialog` should call the same composable (or equivalent behavior) for keyboard users.
- **Dialog pointer behavior:** `EntityDialog` closes on explicit backdrop press/release. Text selection drags that start inside dialog content no longer accidentally close the modal.
- **Tables:** Prefer `scope="col"` on headers and a `caption` (visually hidden with `sr-only` if redundant on screen).
- **Focus visibility:** global `:focus-visible` outline rules live in `client/src/style.css`.

## Useful paths

| Area | Path |
| ---- | ---- |
| API routes | `server/src/routes/` |
| Realtime backend (bus + SSE) | `server/src/realtime/eventBus.ts` (`RealtimeEventBus` interface + `MemoryEventBus`), `server/src/realtime/sseEndpoint.ts` (`createSseHandler` for `GET /api/sse`), `server/src/realtime/notify.ts` (`notifyCatalogChanged` / `notifyTournamentsListChanged` = broadcast, `notifyTournamentChanged` = per-tournament subscribers) |
| State stores (Memory now, Dynamo in Phase 5) | `server/src/state/rateLimitStore.ts` (`RateLimitStore` + `MemoryRateLimitStore`), `server/src/state/lockoutStore.ts` (`LockoutStore` + `MemoryLockoutStore`); injection points `setRateLimitStore` (in `middleware/authRateLimit.ts`) and `setLockoutStore` (in `routes/auth.ts`) |
| Tournament route modules | `server/src/routes/tournaments/` |
| Auth middleware + token helpers | `server/src/middleware/auth.ts`, `server/src/auth/token.ts`, `server/src/types/express.d.ts` |
| Error handling middleware | `server/src/middleware/asyncHandler.ts`, `server/src/middleware/error.ts` |
| Tournament logic (pure) | `server/src/services/` (`advancePhase`, `standings`, `matchTimer`, `roundRobinSchedule`, `knockoutBracket`) |
| Tournament services (orchestration) | `server/src/services/tournamentRosterService.ts` (teams, members, team transfer), `server/src/services/tournamentMatchService.ts` (group/KO generation, scores, timer, delete-all); `ServiceError.ts` for typed errors |
| DB seed | `server/scripts/seed.ts` |
| DB clear (keep User) | `server/scripts/clearDbExceptUsers.ts` |
| Client views | `client/src/views/` |
| Match card + stopwatch | `client/src/components/tournament/TournamentMatchCard.vue`, `MatchTimer.vue`; `client/src/composables/tournaments/useMatchTimerDisplay.ts` |
| Shared types + helpers (client + server) | `shared/src/catalog.ts` (catalog DTOs, `formatCreator`, `formatPlayerName`, `AuthUser`), `shared/src/tournament.ts` — package **`@turnier-hub/shared`** |
| HTTP API (resource modules) | `client/src/api/authApi.ts`, `adminApi.ts`, `classesApi.ts`, `playersApi.ts`, `tournamentsApi.ts` (use `http.ts` for `getToken` / `setToken` / low-level `api`; types from `@turnier-hub/shared`) |
| Pinia domain stores | `client/src/stores/tournamentLayout/` (`index.ts` main store, `rosterActions.ts`, `matchActions.ts`, `phaseActions.ts`), `playersManagement.ts`, `classesManagement.ts`, `tournamentsList.ts`, `dashboard.ts` (+ `auth`, `theme`, `toast`, **`confirmDialog`**, **`textPromptDialog`**) |
| Realtime (client) | `client/src/realtime/realtimeClient.ts` |
| Tournament domain (pure helpers + UI tokens) | `client/src/tournament/tournamentFormat.ts`, `tournamentDerive.ts`, `tournamentPhaseFlow.ts`, `matchElapsed.ts` (client stopwatch math), `tournamentUi.ts` |
| Tournament composables (layout + phase UI) | `client/src/tournament/useTournamentLayoutState.ts` (route + SSE subscribe → **`tournamentLayout`** store), `useTournamentPhaseStepper.ts` (re-exported from `client/src/composables/tournaments/`) |
| Tournament composables (roster + lists) | `client/src/composables/tournaments/` — `useTournamentRosterTransfer`, `useTournamentRosterAddMemberForm`, `useTournamentRosterGroupsDisplay`, `useTournamentRosterRenamePrompts`, `useTournamentRosterAddIndividual`, `useTournamentsListState`, `useMatchTimerDisplay` |
| Feature composables (non-tournament) | `client/src/composables/dashboard/`, `admin/`, `classes/`, `players/` |
| Modal dialog + focus trap | `client/src/components/common/EntityDialog.vue`, `client/src/composables/useDialogFocusTrap.ts` |
| Global confirm + text prompt | `client/src/stores/confirmDialog.ts`, `textPromptDialog.ts`, `GlobalTextPromptDialog.vue`, mounted in `App.vue`; Storybook under `tests/client/storybook/stories/components/common/` (`GlobalTextPromptDialog.stories.ts`) |
| Catalog page header (lists + dashboard) | `client/src/components/common/CatalogPageHeader.vue`; Storybook `tests/client/storybook/stories/components/common/CatalogPageHeader.stories.ts` |
| Local DB (no Docker) | PostgreSQL on `localhost:5432` (`turnier_dev`, `turnier_test`), cluster files under `data/postgres` |
| AWS CDK app + stacks | `infra/bin/infra.ts`, `infra/lib/network-stack.ts`, `infra/lib/data-stack.ts`, `infra/lib/lambda-stack.ts`, `infra/lib/edge-stack.ts`, `infra/lib/config.ts` |
| AWS migration plan | [`MIGRATION_AWS.md`](MIGRATION_AWS.md) |
| GitHub Actions (CI/CD) | [`.github/workflows/README.md`](.github/workflows/README.md) |
| Tournament views | `client/src/views/tournament/` |
| Tournament types + inject key | `client/src/tournament/tournamentContext.ts` (re-exports tournament types from `@turnier-hub/shared`; Vue `inject` key) |
| Client API helper | `client/src/api/http.ts` |
| Client ESLint | `client/eslint.config.js` |
| Client theming | `client/src/style.css`, `client/src/theme/designTokens.js`, `client/src/theme/fonts.css` |
| Toasts (Pinia + host) | `client/src/stores/toast.ts`, `client/src/components/ToastHost.vue` |

## Product context (short)

School-style tournaments on a **shared catalog**: **school classes**, **players**, and **tournaments** are readable and fully editable by **any authenticated user**; Prisma `userId` on create records the **original creator** for `createdBy` in API responses (display only). Users also have a system role (`ADMIN`/`USER`, exposed as `admin`/`user`) used for admin-only management features (schools + user role/school assignment). **School class** names are unique per creator in the DB (`@@unique([userId, name])`). **Players** optionally link to any class; they are assigned to **team rosters** per tournament. **Matches are team vs. team** (or player vs. player with `teamsAreIndividuals`). Three **tournament modes**: `GROUP_KO` (group stage → knockout), `DIRECT_KO` (knockout only, 2+ teams), `ROUND_ROBIN` (everyone vs everyone). GROUP_KO supports multiple groups (`groupCount`); top **`advancesPerGroup`** per group feed knockout pairings. KO supports `ROUND_OF_16`/`QUARTER`/`SEMI`/`FINAL` with byes for non-power-of-2 counts. Round-robin matches are organized in parallel rounds. **Manual scores**; **match timer** (including **end** from scheduled state without starting the clock). Sign-up requires the configured **invite code** (shared gate; not multi-tenant isolation).
