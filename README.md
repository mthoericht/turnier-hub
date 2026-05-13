# Turnier-Hub

Turnier-Hub is a small full-stack web application for managing school sports tournaments (for example volleyball, football, or two-field ball). Identity is provided by a **reverse proxy** (for example **Authelia**) via the `Remote-User` header; the app exposes a **shared catalog** of **school classes**, **players**, and **tournaments** (any signed-in user can edit; creator is shown for attribution), player rosters, tournament setup with **teams** (or individuals), three **tournament modes** (group stage → knockout, direct knockout, round-robin), multiple **groups**, knockout phases (round of 16 / quarter / semi / final), manual score entry, and a per-match stopwatch.

## Table of Contents

- [Features](#features)
- [How To Use (Typical Workflow)](#how-to-use-typical-workflow)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [NPM Scripts (repository root)](#npm-scripts-repository-root)
- [Database Profiles (dev / test / production)](#database-profiles-dev--test--production)
- [Production](#production)
- [Security](#security)
- [Additional Documentation](#additional-documentation)
- [Project Layout](#project-layout)
- [Accessibility (front end)](#accessibility-front-end)
- [Test Environment](#test-environment)

## Features

### Authentication And Admin

- **Reverse-proxy authentication:** The API trusts `Remote-User` from the reverse proxy. The SPA uses `GET /api/session` with same-origin cookies and shows the current subject plus **Abmelden** when `AUTHELIA_LOGOUT_URL` is configured.
- **Local development fallback:** Set `DEV_REMOTE_USER` when no proxy injects `Remote-User`. Set `DEV_REMOTE_GROUPS="admins"` when no proxy injects `Remote-Groups`; both fallbacks are ignored in production.
- **Admin role:** Admin access is granted when `Remote-Groups` contains `admins`. There is no user table in the app database.
- **Admin area:** Admins can manage schools at `/admin`. School deletion is blocked while the school still has classes, players, or tournaments.

### Shared Catalog

- **Open collaboration model:** School classes, players, and tournaments are visible and fully editable by any authenticated subject.
- **Creator attribution:** New rows store `createdBySubject`; the API exposes it as `createdBy` for labels such as "Von ..." / "Erstellt von ...". Filters like **Alle** vs. **Eigene** only narrow the list view, not edit permissions.
- **Classes:** CRUD for school classes at `/classes` and `/api/classes`; names are unique per school.
- **Players:** CRUD for players with separate `firstName` and `lastName`, optional class assignment from all catalog classes, search by name/class, sortable columns, and scoped list views.
- **Import/export:** The players page imports XLS/XLSX files with `Vorname`, `Name`, and `Klasse`; import modes support append, replace by `Vorname + Name + Klasse`, or reset all data. Export writes the same schema.

### Tournaments

- **Tournament modes:** Create tournaments as **Group -> K.O.**, **Direct K.O.**, or **Round-Robin**. Tournaments can also run in "teams as individuals" mode, e.g. for badminton.
- **Roster setup:** Add teams, assign any catalog player to a roster, rename teams and group labels, or transfer roster structure from another tournament.
- **Operations tab (`Spielbetrieb`):** Configure group count, save advancers per group, generate group/round-robin/knockout matches, advance phases, and delete all matches/groups when needed.
- **Generation rules:** Empty teams are excluded from group generation. Regenerating group matches removes existing knockout matches. Direct K.O. supports arbitrary team counts with byes.
- **Standings and phases:** Group standings are computed from persisted results. Tournament phases advance through round of 16, quarter-final, semi-final, final, and completed where applicable.

### Matches And Realtime

- **Match operation:** Start, pause, resume, end, or cancel the timer. Scores remain editable at any time.
- **Score persistence:** Saving sends both home and away goals together. Knockout winners are determined only from persisted scores; ending the timer alone does not decide a winner.
- **Stopwatch display:** Live elapsed time is computed locally from server timestamps on a one-second UI tick, so there is no per-second polling.
- **Live updates:** WebSocket updates run on `/api/ws`. Tournament subscribers receive `tournamentChanged`; all connected clients receive `catalogChanged` and `tournamentsChanged`.
- **Draft protection:** When realtime refreshes tournament details, the client merges score drafts so unsaved typing is not wiped.

### Interface And Feedback

- **Responsive Vue UI:** Single light theme, mobile navigation, and shared title/action rows via `CatalogPageHeader`.
- **Toasts:** Global bottom-screen toasts surface validation hints and API errors for tournament actions.
- **Centralized theming:** Font tokens live in `client/src/theme/designTokens.js` and `client/src/theme/fonts.css`; semantic colors and reusable UI utility classes live in `client/src/style.css`.

### Knockout Logic Details

- **Bracket (Turnierbaum):** In this project, "bracket" means the K.O. tournament tree (who plays whom and which winner advances to the next round).
- **Phase flows:** Group+KO and Direct-KO display concrete KO phases (`ROUND_OF_16` → `QUARTER` → `SEMI` → `FINAL` → `COMPLETED`) depending on team count and current state; Round-Robin uses `GROUP` (match operation phase) → `COMPLETED`.
- **Randomness:** KO pairings are intentionally randomized during KO generation (direct KO) and during advancement from qualifiers; byes (`Freilos`) are handled automatically and created as finished matches.
- **Bye handling:** Non-power-of-2 team counts are padded to the next power of 2. Empty slots become bye matches (`awayTeamId = null`) created as `FINISHED` so they auto-advance the home team. This applies to both Direct-KO generation and qualifier-based advancement.
- **Tie-breaking in qualifiers:** When multiple teams share the same point total at the cutoff boundary, a deterministic pseudo-random selection (seeded by tournament ID + group label) picks the advancing teams and emits a user-visible notice.
- **Winner determination:** KO winners are determined exclusively from persisted `homeScore`/`awayScore`. Draws are not allowed in knockout — the user must enter a decisive result (e.g. after extra time or penalties).

For a detailed German-language explanation of the tournament logic, see **[`doc/TURNIERLOGIK.md`](doc/TURNIERLOGIK.md)**.

## How To Use (Typical Workflow)

1. **Access**
   - Place the app behind a reverse proxy that sets **`Remote-User`** (Authelia) and forwards WebSocket upgrades for **`/api/ws`**.
   - The browser uses **same-origin** `fetch` with **`credentials: "include"`**; no JWT in `localStorage`.

2. **(Admin) Maintain schools**
   - Open **Admin** (`/admin`) to create/rename/delete schools when your proxy groups include the configured admin group.

3. **Prepare master data**
   - In **Classes**, create school classes (optional but recommended). Any user can use classes created by others when assigning players.
   - In **Players**, create participants (`firstName` + `lastName`) and optionally link each player to a class from the shared catalog.
   - In the **Players** list, use class filter + search field together and sort by **Vorname**, **Name**, or **Klasse** directly from the table header.
   - Optional: use **Import/Export** on the players page. Import expects **XLS/XLSX** with **`Vorname`**, **`Name`**, **`Klasse`**; export writes the current list with the same schema.

4. **Create a tournament**
   - Choose mode:
     - **Group -> K.O.** for group stage + playoffs,
     - **Direct K.O.** for immediate bracket play,
     - **Round-Robin** for everyone vs everyone.
   - Optional: enable **teams as individuals** when each player should act as a team.

5. **Set up teams in `Mannschaften`**
   - Add teams (or participants in individual mode).
   - Add/remove roster members per team.
   - Rename team names and group labels directly in the roster UI.
   - Optional: transfer roster structure from another tournament.

6. **Run match generation in `Spielbetrieb`**
   - **Group -> K.O.:** set `groupCount` next to "Gruppenspiele erzeugen", then generate groups.
   - Save `advancesPerGroup` separately with "Einstellungen speichern".
   - **Direct K.O.:** generate the initial knockout round.
   - **Round-Robin:** generate league matches.
   - Safety behavior:
     - regenerating group matches clears existing KO matches,
     - teams without members are excluded from group generation,
     - byes are created as already `FINISHED`.

7. **Operate matches in `Spiele`**
   - Use timer controls: start, pause, resume, end, cancel.
   - Enter and save **both** scores (`homeScore` + `awayScore`) to persist valid results.
   - Standings update from persisted match data; unsaved score drafts are preserved during refreshes.

8. **Advance phases**
   - Trigger next phase from Spielbetrieb (as allowed by current state).
   - KO pairings are randomized by server logic.
   - If final match(es) are finished, tournament phase auto-switches to `COMPLETED`.

9. **Reset when needed**
   - Use "Delete all matches and groups" in the danger zone to remove all matches and reset phase context.

## Tech Stack

| Layer    | Technology |
| -------- | ---------- |
| Client   | Vite, Vue 3, TypeScript, Pinia, Vue Router, Tailwind CSS |
| Server   | Express, TypeScript, **`ws`** (WebSocket on `/api/ws`, same HTTP server as the API) |
| Shared   | **`@turnier-hub/shared`** workspace: TypeScript types for catalog and tournament API payloads (e.g. `Player`, `CreatedBy`, `SessionUser`) plus helpers like `formatCreator` and `formatPlayerName`; consumed by client and server |
| Database | MySQL via Prisma ORM |
| Identity | Reverse-proxy headers (`Remote-User`, optional admin list); optional `AUTHELIA_LOGOUT_URL` for SPA logout |
| Lint     | ESLint 9 (flat config), `typescript-eslint`, `eslint-plugin-vue` (client) |

Database connection settings are read from `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, and `DB_NAME`; the server derives Prisma's `DATABASE_URL` from those values when it is not provided explicitly.

Server error handling is centralized: route handlers should use `server/src/middleware/asyncHandler.ts`, and uncaught/domain errors are mapped in `server/src/middleware/error.ts` (for example `ServiceError` and Prisma conflict handling).

Server architecture (quick reference):
- **Routes:** API modules live in `server/src/routes/`; admin endpoints are mounted under `/api/admin`; tournament endpoints are split in `server/src/routes/tournaments/` (`core`, `teams`, `matches`, `standings-advance`) and mounted under `/api/tournaments`.
- **Validation / parser:** request payloads are validated with **Zod** in route modules; invalid input returns `400`.
- **Middleware:** auth guard is `server/src/middleware/auth.ts`; async error forwarding uses `server/src/middleware/asyncHandler.ts`; centralized error mapping/logging is in `server/src/middleware/error.ts`.
- **Services:** business/domain logic lives in `server/src/services/` (pure logic + orchestration); route handlers stay thin and call services.

## Prerequisites

- **Node.js** (>= 22)
- **npm** (workspaces are used at the repo root)
- **MySQL** (local server or reachable instance)

## Quick Start

1. **Clone the repository** and install dependencies from the repository root:

   ```bash
   npm install
   ```

2. **Configure the server environment.** Copy the example file and adjust values if needed:

   ```bash
   cp server/.env.example server/.env
   ```

   Important variables:

   - `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` / `DB_NAME` — MySQL connection settings. The app and npm scripts derive Prisma's `DATABASE_URL` from these values when `DATABASE_URL` is not set explicitly.
   - `DEFAULT_SCHOOL_ID` — **required in production**: Prisma `id` of the school whose catalog (classes, players, tournaments) this instance serves. In development, the app falls back to the school named `DEFAULT_SCHOOL_NAME` (from seed).
   - `DEFAULT_SCHOOL_NAME` — seed/bootstrap school name when resolving by name (default: `defaultSchool`).
   - `AUTHELIA_LOGOUT_URL` — full URL returned on `GET /api/session` as `logoutUrl` so the SPA can navigate the browser there on **Abmelden** (clears the SSO session cookie at the identity provider).
   - `DEV_REMOTE_USER` — optional local fallback when no `Remote-User` header is present (never rely on this in production).
   - `DEV_REMOTE_GROUPS` — optional local fallback when no `Remote-Groups` header is present, for example `admins` to enable the Admin UI in local development (never relied on in production).
   - `PORT` — API port (default `3000`).
   - `STATIC_DIR` — path to the built client files, resolved relative to `server/` (default `../client/dist`).
   - `VITE_API_PROXY_TARGET` — optional target for the Vite dev proxy (`/api` + WebSocket). If unset, Vite uses `http://127.0.0.1:${PORT}` from `server/.env`.
   - `CORS_ALLOWED_ORIGINS` — comma-separated allowlist of browser origins that may call the API with credentials.
   - `TRUST_PROXY` — set to `1` (or the correct hop count) when running behind a reverse proxy so IP-based protections use the real client IP.
   - `JSON_BODY_LIMIT` — max JSON request payload size for `express.json` (default `100kb`).
   - `WS_CONNECT_WINDOW_MS` / `WS_CONNECT_MAX_PER_IP` / `WS_MESSAGE_WINDOW_MS` / `WS_MESSAGE_MAX_PER_WINDOW` / `WS_MAX_SUBSCRIPTIONS_PER_CLIENT` — websocket abuse protection (upgrade/message rates + per-client subscription cap).

3. **Create the local MySQL databases and user.** Run this once with an administrative MySQL account, for example via `mysql -u root -p`:

   ```sql
   CREATE DATABASE `turnier-hub`;
   CREATE DATABASE `turnier-hub-test`;

   CREATE USER IF NOT EXISTS 'turnier_user'@'localhost' IDENTIFIED BY 'turnier_pass';

   GRANT ALL PRIVILEGES ON `turnier-hub`.* TO 'turnier_user'@'localhost';
   GRANT ALL PRIVILEGES ON `turnier-hub-test`.* TO 'turnier_user'@'localhost';

   FLUSH PRIVILEGES;
   ```

   If the API connects from another host or container, replace `'localhost'` with the concrete host or `%` and keep the same value in `DB_HOST`.

4. **Apply the database schema** and optionally **seed** demo data:

   ```bash
   npm run db:push
   npm run db:seed
   ```

   For the test database schema:

   ```bash
   npm run db:push:test
   ```

   If `db:push` fails because of existing rows (e.g. after a breaking schema change), reset the **local** development database (this deletes all data), then push and seed again — for example use `npx prisma db push --force-reset` from `server/` (development only).

  The seed creates two schools (`defaultSchool`, `secondSchool`), twelve players, shared demo **school classes**, and four demo tournaments: **"Demo: Football School Cup"** (Group → K.O., 8 teams in 2 groups), **"Demo: Volleyball K.O."** (Direct K.O., 6 teams with byes), **"Demo: Direct K.O. with 15 Teams"** (Direct K.O., 15 teams), and **"Demo: Badminton Round Robin"** (Round-Robin, 5 individuals). Re-running the seed removes **all** tournaments, **school classes**, and players for the default school, then recreates the demo data.

4.1. **Wipe demo data (dev/test)**

If you want to remove catalog content (classes, players, tournaments) but keep schools:

```bash
npm run db:clear -- --yes
```

For the test database:

```bash
npm run db:clear:test -- --yes
```

5. **Run the app in development** (API + Vite dev server with proxy):

   ```bash
   npm run dev
   ```

   - Front end: [http://localhost:5173](http://localhost:5173)
   - API: [http://localhost:3000](http://localhost:3000)
   - The Vite dev server proxies **`/api`** to `VITE_API_PROXY_TARGET` when set; otherwise it derives `http://127.0.0.1:${PORT}` from `server/.env`. The proxy covers both **HTTP and WebSocket** (realtime uses `ws://` / `wss://` on the same host as the SPA in dev).

## NPM Scripts (repository root)

| Script | Description |
| ------ | ----------- |
| `npm run dev` | Starts Express (with API) and the Vite dev server concurrently. |
| `npm run build` | Builds server TypeScript output and the client production bundle. |
| `npm run lint` | Runs ESLint on the client (`client/`). |
| `npm run lint:fix` | ESLint with `--fix` (client workspace). |
| `npm run prod:prepare` | `db:generate` + full `build` (typical after `npm ci` on a server). |
| `npm run prod:start` | Starts the server with `NODE_ENV=production` (serves API + built SPA from `client/dist`). |
| `npm run prod` | `prod:prepare` then `prod:start` in one step. |
| `npm run db:push` | Pushes the Prisma schema to the database from `server/.env`. |
| `npm run db:deploy` | Same as `db:push` — use on production hosts with either `DATABASE_URL` or the split `DB_*` variables in the environment. |
| `npm run db:studio` | Opens Prisma Studio against the database from `server/.env`. |
| `npm run db:generate` | Generates the Prisma client. |
| `npm run db:seed` | Runs the Prisma seed (dev database). |
| `npm run db:clear` | Clears catalog data (classes, players, tournaments, audit log) but keeps `School` rows (dev database). Pass `-- --yes` for confirmation. |
| `npm run db:push:test` | Pushes schema using `server/.env.test` (test DB). |
| `npm run db:seed:test` | Seeds the test database. |
| `npm run db:clear:test` | Same as `db:clear` for the test DB. Pass `-- --yes` for confirmation. |
| `npm run dev:test` | Runs the server with `NODE_ENV=test` (loads `server/.env.test`, default port `3002`). |
| `npm run test` | Runs Vitest suites for server + client. |
| `npm run test:client` | Runs all client tests (unit + client-API integration). |
| `npm run test:unit` | Runs server unit tests only (Vitest). |
| `npm run test:integration` | Pushes test schema and runs client-API integration tests (Vitest, against test DB/API). |
| `npm run security:audit` | Runs a policy-based audit wrapper across workspaces (fails on non-allowlisted high/critical vulnerabilities). |
| `npm run clean` | Removes `node_modules` and `dist` folders in the monorepo. |
| `npm run clean:install` | Runs `clean` then `npm install`. |
| `npm run storybook` | Starts Storybook for the client (port `6006`; config in `tests/client/storybook/`). See **[tests/client/storybook/README.md](tests/client/storybook/README.md)** for fixtures, mocks, and routed stories. |
| `npm run build-storybook` | Static Storybook build (output under `client/storybook-static/`). |

**Prisma — `db:push` / `db:deploy` vs `db:generate`:** `db:push` and `db:deploy` apply **`schema.prisma` to the database** (tables and columns). `db:generate` only **rebuilds the Prisma Client** under `node_modules` (typed API for your code) and does **not** modify the database. After schema edits you usually run a push (or deploy) and ensure the client is generated (`db:generate`, or rely on tooling that runs it — e.g. `prod:prepare` runs `db:generate` before the build).

Realtime test coverage (current baseline):
- **Server WS hub:** `tests/server/unit/realtimeHub.test.ts` (auth, subscribe routing, `tournamentChanged` to subscribers, **broadcast** `catalogChanged` / `tournamentsChanged` to all connected sockets).
- **Client WS adapter:** `tests/client/unit/realtimeClient.test.ts` (connect URL, subscribe flush/send, message dispatch hook, disconnect behavior).

## Database Profiles (dev / test / production)

### Dev DB
- Environment file: `server/.env`
- One-time local MySQL setup (run as an admin user, e.g. `mysql -u root -p`):

  ```sql
  CREATE DATABASE `turnier-hub`;
  CREATE DATABASE `turnier-hub-test`;

  CREATE USER IF NOT EXISTS 'turnier_user'@'localhost' IDENTIFIED BY 'turnier_pass';

  GRANT ALL PRIVILEGES ON `turnier-hub`.* TO 'turnier_user'@'localhost';
  GRANT ALL PRIVILEGES ON `turnier-hub-test`.* TO 'turnier_user'@'localhost';

  FLUSH PRIVILEGES;
  ```

  If the API connects from another host or container, replace `'localhost'` with the concrete host or `%`.
- Apply schema: `npm run db:push`
- Seed demo data: `npm run db:seed` (script: `server/scripts/seed.ts`)
- Clear catalog data (keeps `School` rows): `npm run db:clear -- --yes` (script: `server/scripts/clearDbExceptUsers.ts`)
- Internally, `db:seed` runs Prisma's configured seed script via `server/package.json` → `prisma.seed: "tsx scripts/seed.ts"`.
- Internally, `db:clear` runs `tsx scripts/clearDbExceptUsers.ts` from `server/package.json`.

### Test DB
- Environment file: `server/.env.test`
- Apply schema: `npm run db:push:test`
- Seed demo data: `npm run db:seed:test` (same script: `server/scripts/seed.ts`)
- Clear catalog data (keeps `School` rows): `npm run db:clear:test -- --yes` (same script: `server/scripts/clearDbExceptUsers.ts`)
- Internally, `db:seed:test` reuses the same seed file (`server/scripts/seed.ts`) but executes under `server/.env.test`.
- Internally, `db:clear:test` runs the same clear file (`server/scripts/clearDbExceptUsers.ts`) but executes under `server/.env.test`.

### Production
- Environment variables: `DATABASE_URL` or `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` / `DB_NAME`, plus other secrets, are provided by the host (no local `.env` reliance)
- Apply schema: `npm run db:deploy`
- Seed/clear: not part of the standard flow; avoid `npm run db:clear` on production.

## Production

For Ansible-based production automation (bootstrap, restart, update + deploy), see [`ansible/README.md`](ansible/README.md).

1. Set environment variables on the host (`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` or `DATABASE_URL`, **`DEFAULT_SCHOOL_ID`**, `PORT`, `STATIC_DIR`, `CORS_ALLOWED_ORIGINS`, `TRUST_PROXY`, optional `AUTHELIA_LOGOUT_URL`, etc.) — do not rely on committing `.env`.

2. Install dependencies and prepare the build:

   ```bash
   npm ci
   npm run prod:prepare
   ```

3. Apply the schema to the production database (with production DB env set):

   ```bash
   npm run db:deploy
   ```

   There are no Prisma migration files yet; deployment uses **`prisma db push`**. For larger production setups, consider adopting **migrations** later.

4. Start the server (API + static SPA):

   ```bash
   npm run prod:start
   ```

Notes:
- `db:seed` / `db:clear` are for development/test workflows. On production, use `db:deploy` only (and seed manually only if you explicitly want demo data).
- **Reverse proxy (e.g. Nginx / Authelia):** forward **`Remote-User`** to Node for both HTTP and WebSocket upgrades. Enable **WebSocket pass-through** for paths that hit the API (at least **`/api/ws`**), e.g. `proxy_http_version 1.1`, `Upgrade`, and `Connection "upgrade"`, so realtime push keeps working.

   Or use `npm run prod` to run steps 2–4's build/start in one go after `npm ci` (run `db:deploy` separately when the database is ready).

   Equivalent from the server workspace after a root build: `npm run start:prod -w server`.

## Security

Identity and access are handled **outside** the app: a **reverse proxy** (for example Authelia) should terminate TLS, authenticate users, and set **`Remote-User`** (and optional group headers) on **HTTP and WebSocket** upgrades. The API does not issue JWTs to the browser; the SPA uses **same-origin** requests with **`credentials: "include"`**.

**Implemented server-side controls** (configure via `server/.env` / host env; see `server/.env.example`):

- **`helmet`** — baseline HTTP security headers on API responses (`server/src/app.ts`).
- **CORS** — only origins in **`CORS_ALLOWED_ORIGINS`** may call the API with credentials; preflight to **`/api/*`** from disallowed origins is answered with **`403`** (`server/src/app.ts`).
- **`TRUST_PROXY`** — must match how many proxy hops you trust so **`req.ip`** and WebSocket client IP logic align with **`X-Forwarded-For`** (`server/src/config.ts`, `server/src/realtime/hub.ts`).
- **`JSON_BODY_LIMIT`** — maximum size for JSON bodies parsed by **`express.json`**.
- **WebSocket (`/api/ws`)** — upgrades require a non-empty **`Remote-User`** (or dev fallback); **`Origin`** must be in **`CORS_ALLOWED_ORIGINS`**; **`WS_*`** env vars cap upgrade bursts per IP, message rate per socket, **max payload**, and **max tournament subscriptions** per connection (`server/src/realtime/hub.ts`).
- **Structured warning logs** — optional **`SECURITY_HTTP_STATUS_*`** thresholds on **`/api`** responses (`401`, `403`, `429`) and **`SECURITY_WS_CONNECTIONS_*`** for concurrent-connection peaks; WebSocket **rate-limit** hits log **`ws_rate_limit_triggered`** (JSON lines on **`console.warn`** for log shipping; `server/src/security/monitoring.ts`).
- **Process scope** — rate limits and connection counters are **in-memory per Node process**; in front of multiple instances, add complementary limits at the **reverse proxy or load balancer**.
- **Dependencies** — **`npm run security:audit`** wraps **`npm audit`** and fails the build on non-allowlisted **high/critical** findings (`scripts/security-audit.mjs`).

## Additional Documentation

- [`doc/TURNIERLOGIK.md`](doc/TURNIERLOGIK.md) - detailed German-language tournament logic documentation.
- [`doc/TODO.md`](doc/TODO.md) - historical tournament refactoring checklist.

## Project Layout

```
turnier-hub/
├── ansible/                   # Production playbooks + role (see ansible/README.md)
├── tests/                     # Shared root test tree (server + client Vitest tests)
│   ├── server/
│   └── client/
├── shared/                    # @turnier-hub/shared: catalog + tournament TypeScript types and formatting helpers (client + server depend on this)
├── client/                    # Vue SPA (Vite)
│   ├── eslint.config.js       # ESLint flat config
│   ├── src/
│   │   ├── api/               # sessionApi, adminApi, classesApi, playersApi, tournamentsApi, http (fetch + credentials)
│   │   ├── components/        # Shared UI (e.g. CatalogPageHeader, EntityDialog, ScopeToggle); Storybook stories in tests/client/storybook/
│   │   ├── composables/       # Feature composables (dashboard, admin, classes, players, tournaments)
│   │   ├── realtime/          # WebSocket client (connect, tournament subscribe, dispatch to stores)
│   │   ├── stores/            # Pinia: auth, theme, toast + domain (tournamentLayout/ with rosterActions, matchActions, phaseActions; players/classes/tournaments list, dashboard)
│   │   ├── theme/             # centralized design tokens and font import
│   │   ├── tournament/        # Pure derive/format logic, layout bridge (useTournamentLayoutState → store), UI class tokens; DTO types from @turnier-hub/shared
│   │   └── views/
│   │       └── tournament/    # TournamentLayout, Matches (layout + overview + setup), Roster (thin; roster logic in composables)
├── server/                    # Express API, Prisma schema & scripts
│   ├── prisma/
│   ├── scripts/
│   └── src/
│       ├── app.ts, index.ts   # Express app; HTTP server + WebSocket upgrade
│       ├── realtime/          # WebSocket hub (/api/ws); tournament push to subscribers; catalog + list broadcast
│       ├── routes/            # session, classes, players, tournaments/…, admin
│       │   └── tournaments/   # Thin route handlers (validate → service → notify → respond)
│       └── services/          # Pure logic (advancePhase, standings, matchTimer, knockoutBracket, roundRobinSchedule) + orchestration (tournamentRosterService, tournamentMatchService, ServiceError)
└── package.json               # npm workspaces + shared scripts
```

## TypeScript (client)

The client uses **project references**: root `tsconfig.json` points at `tsconfig.app.json` (application sources) and `tsconfig.node.json` (Vite config). Shared options live in `tsconfig.base.json`. Run `vue-tsc --build --noEmit` from `client/` for a full typecheck. `*.tsbuildinfo` files are local caches and ignored by git.

## Accessibility (front end)

The Vue app follows common **WCAG-oriented** patterns: a **skip link** to main content (`App.vue`), semantic regions (`header` / `main` / `nav`), labeled forms (`AuthFormField` and related views), **modal dialogs** with `role="dialog"`, `aria-labelledby` / `aria-describedby`, and a **keyboard focus trap** plus Escape-to-close via `EntityDialog.vue` and `client/src/composables/useDialogFocusTrap.ts`. Tables use captions and column scope where appropriate; many routes expose `aria-current="page"` for the active navigation item; `:focus-visible` styling is centralized in `client/src/style.css`.

For a concise checklist, file paths, and how to reuse the focus trap in new dialogs, see **[AGENTS.md — Accessibility (client)](AGENTS.md#accessibility-client)**.

## Test Environment

- `server/.env.test` defines the separate MySQL database `turnier-hub-test` and port `3002`.
- Use `npm run db:push:test` and `npm run db:seed:test` against that database.
- Use `npm run db:clear:test -- --yes` to wipe demo catalog content while keeping `School` rows.
- If you run only the test API, point the client proxy at port `3002` or call the API directly.
- Client integration tests (`tests/client/integration`) reset the test DB and seed a small minimal dataset per test for faster runs.

## License

See the `LICENSE` file in the repository.
