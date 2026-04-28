# Turnier-Hub

Turnier-Hub is a small full-stack web application for managing school sports tournaments (for example volleyball, football, or two-field ball). It covers user registration with an invite code, a **shared catalog** of **school classes**, **players**, and **tournaments** (any signed-in user can edit; creator is shown for attribution), player rosters, tournament setup with **teams** (or individuals), three **tournament modes** (group stage → knockout, direct knockout, round-robin), multiple **groups**, knockout phases (round of 16 / quarter / semi / final), manual score entry, and a per-match stopwatch.

> **AWS migration in flight.** The codebase is moving from the legacy single-VM deployment to a fully serverless AWS stack (Lambda Function URLs + CloudFront + RDS Postgres + DynamoDB). The phase plan and current status live in [`MIGRATION_AWS.md`](MIGRATION_AWS.md). At the time of writing, **Phase 1 (Postgres)** and **Phase 2 (state adapters + WS→SSE)** are merged; Phase 3+ is in progress. Local development now requires **Docker** (Postgres + DynamoDB-Local via Docker Compose).

## Table of Contents

- [Features](#features)
- [How To Use (Typical Workflow)](#how-to-use-typical-workflow)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [NPM Scripts (repository root)](#npm-scripts-repository-root)
- [Database Profiles (dev / test / production)](#database-profiles-dev--test--production)
- [Production](#production)
- [Security Notes](#security-notes)
- [Security Runbook](#security-runbook)
- [Additional Documentation](#additional-documentation)
- [Project Layout](#project-layout)
- [Accessibility (front end)](#accessibility-front-end)
- [Test Environment](#test-environment)

## Features

- **Authentication:** Sign-up requires a shared **invite code** (configurable). Login uses email and password. Sessions use **JWT** in the `Authorization: Bearer` header; the token is stored in the browser under the localStorage key `turnier_hub_token`.
- **Users and roles:** Each account has a **username** (unique, normalized), email, and a role: **`user`** or **`admin`**. New accounts default to `user`. Admin-only actions are available in the **Admin** view.
- **Admin area:** Admins can open `/admin` from the top navigation (next to tournaments) and manage:
  - **Schools:** create, rename, delete (deletion only when no users are assigned).
  - **User administration:** list users, change role (`user`/`admin`), and reassign users to a different school.
  - **Safety rule:** the backend prevents demoting the last remaining admin account.
- **Shared catalog:** **School classes**, **players**, and **tournaments** are visible and **fully editable** (create / update / delete) by **any authenticated user**. Database rows still store the **original creator** (`userId` on create); the API exposes this as **`createdBy`** for display only (“Von …” / “Erstellt von …”). List filters **Alle** vs. **Eigene** only narrow what you see, not who may edit. **Players** can be assigned to **any** class in the catalog. **Roster transfer** can use any tournament as the source.
- **Classes:** CRUD for **school classes** (names unique **per creator** in the DB — two users can each have a class named `10a`). Routes `/classes` (API `/api/classes`).
- **Players:** CRUD for players with separate **`firstName`** and **`lastName`**; optional class is chosen from **all** classes in the catalog. Scoped list views (all vs. own) like tournaments. The players page provides text search (first name, last name, full name, class), sortable table columns (**Vorname**, **Name**, **Klasse**, asc/desc toggle), and an **Import/Export** dialog. Import accepts **XLS/XLSX** with columns **`Vorname`**, **`Name`** (last name), **`Klasse`** and offers modes to append, reset all data, or replace players by matching existing rows on **Vorname + Name + Klasse** (only missing rows are removed). Export writes current players to XLSX using the same column schema. For better mobile landscape fit, creator attribution is shown as compact text below each row's action buttons.
- **Tournaments:** Create tournaments with one of three **modes**: **Group → K.O.** (classic group stage feeding knockout rounds), **Direct K.O.** (knockout only, supports arbitrary team counts with byes), or **Round-Robin** (everyone vs everyone, no knockout). Optionally mark **teams as individuals** (e.g. badminton — players become teams directly). In the **Operations** tab (`Spielbetrieb`), Group → K.O. lets you set **group count** directly next to "Generate group matches" and save **advancers per group** separately via "Save settings". Add **teams**, assign **any** catalog players to **team rosters** (optionally transfer rosters from **another** tournament in the **Teams** tab), generate **group / round-robin matches** (organized in parallel rounds), view **standings** (per group when applicable), then advance through **round of 16 → quarter → semi → final** with pairings computed on the server. K.O. pairings are randomized when generated. Group generation ignores teams without members and regenerating group matches removes existing knockout matches. Group and team names are editable in the roster UI. All matches can be **deleted at once** via "Delete all matches and groups" in the operations view. The tournament UI uses top tabs **Teams** (`Mannschaften`), **Matches** (`Spiele`), and **Operations** (`Spielbetrieb`).
- **Matches:** **Start / pause / resume / end / cancel** timer; **scores** editable at any time. Score fields default to **0**; **Save** sends **both** home and away goals in one request so the database never ends up with only one side set (required for knockout advancement). **Ending the timer** marks the match finished but does **not** substitute for saved scores — use **Save** so winners can be determined from stored values. When the final is finished, the tournament phase is automatically set to **Ende** (`COMPLETED`). Matches with a **Freilos** are created directly as **beendet** (`FINISHED`). **Live updates** use **Server-Sent Events** (`GET /api/sse?token=…&tournaments=…`): the server pushes **`tournamentChanged`** to clients subscribed to that tournament; **`catalogChanged`** (players/classes) and **`tournamentsChanged`** are **broadcast to every connected client**. The client uses the browser's `EventSource` and refetches affected tournament detail, **merging** the score draft so unsaved typing is not wiped. **Stopwatch display:** while a match is **LIVE**, elapsed time is derived **locally** from server timestamps (`matchStartedAt`, `totalPausedMs`, …) on a one-second **UI** tick — no per-second HTTP or SSE traffic; timer **state** still updates only from the API or SSE-driven refetches when you use the controls or another client changes the match. Regenerating the **group stage** or **KO rounds** asks for confirmation if existing results would be deleted.
- **Feedback:** **Toasts** (global, bottom of the screen) surface validation hints and API errors for tournament actions (for example advance rules or save issues).
- **UI:** Vue front end with a single light theme, **responsive** layout including a mobile navigation menu. **`CatalogPageHeader`** (`client/src/components/common/CatalogPageHeader.vue`) unifies title rows and action toolbars on **Classes**, **Players**, **Tournaments**, and the signed-in **home** (dashboard) view; optional intro text and controls use Vue slots.
- **Theming (centralized):** fonts and semantic UI colors are configured centrally. Font tokens live in `client/src/theme/designTokens.js` + `client/src/theme/fonts.css`; semantic color variables (`--ui-primary`, `--ui-card-*`, `--ui-input-*`, `--ui-danger*`) and reusable UI classes (`.ui-card`, `.ui-btn-primary-*`, `.ui-input-*`, etc.) are defined in `client/src/style.css`.

### Knockout bracket, phase flow, randomness

- **Bracket (Turnierbaum):** In this project, "bracket" means the K.O. tournament tree (who plays whom and which winner advances to the next round).
- **Phase flows:** Group+KO and Direct-KO display concrete KO phases (`ROUND_OF_16` → `QUARTER` → `SEMI` → `FINAL` → `COMPLETED`) depending on team count and current state; Round-Robin uses `GROUP` (match operation phase) → `COMPLETED`.
- **Randomness:** KO pairings are intentionally randomized during KO generation (direct KO) and during advancement from qualifiers; byes (`Freilos`) are handled automatically and created as finished matches.
- **Bye handling:** Non-power-of-2 team counts are padded to the next power of 2. Empty slots become bye matches (`awayTeamId = null`) created as `FINISHED` so they auto-advance the home team. This applies to both Direct-KO generation and qualifier-based advancement.
- **Tie-breaking in qualifiers:** When multiple teams share the same point total at the cutoff boundary, a deterministic pseudo-random selection (seeded by tournament ID + group label) picks the advancing teams and emits a user-visible notice.
- **Winner determination:** KO winners are determined exclusively from persisted `homeScore`/`awayScore`. Draws are not allowed in knockout — the user must enter a decisive result (e.g. after extra time or penalties).

For a detailed German-language explanation of the tournament logic, see **[`doc/TURNIERLOGIK.md`](doc/TURNIERLOGIK.md)**.

## How To Use (Typical Workflow)

1. **Sign up / log in**
   - Use the invite code configured on the server.
   - After login, your JWT is stored in `localStorage` and sent to `/api/*` routes.

2. **(Admin) Maintain schools and permissions**
   - Open **Admin** (`/admin`) to create/rename/delete schools.
   - Assign users to schools via select fields.
   - Change user roles (`user` / `admin`).
   - The API blocks role changes that would remove the last admin.

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
| Server   | Express, TypeScript, **Server-Sent Events** on `GET /api/sse` (same HTTP server as the API) |
| Shared   | **`@turnier-hub/shared`** workspace: TypeScript types for catalog and tournament API payloads (e.g. `Player`, `CreatedBy`, `AuthUser`) plus helpers like `formatCreator` and `formatPlayerName`; consumed by client and server |
| Database | **PostgreSQL** via Prisma ORM (Docker Compose locally; RDS Postgres in the upcoming AWS deployment) |
| Auth     | JWT, bcryptjs |
| Lint     | ESLint 9 (flat config), `typescript-eslint`, `eslint-plugin-vue` (client) |

Local Postgres + DynamoDB-Local run in Docker (`docker-compose.yml` at the repo root); their data volumes live outside the repo. Prisma migrations are checked in under `server/prisma/migrations/`.

Server error handling is centralized: route handlers should use `server/src/middleware/asyncHandler.ts`, and uncaught/domain errors are mapped in `server/src/middleware/error.ts` (for example `ServiceError` and Prisma conflict handling).

Server architecture (quick reference):
- **Routes:** API modules live in `server/src/routes/`; admin endpoints are mounted under `/api/admin`; tournament endpoints are split in `server/src/routes/tournaments/` (`core`, `teams`, `matches`, `standings-advance`) and mounted under `/api/tournaments`.
- **Validation / parser:** request payloads are validated with **Zod** in route modules; invalid input returns `400`.
- **Middleware:** auth guard is `server/src/middleware/auth.ts`; async error forwarding uses `server/src/middleware/asyncHandler.ts`; centralized error mapping/logging is in `server/src/middleware/error.ts`.
- **Services:** business/domain logic lives in `server/src/services/` (pure logic + orchestration); route handlers stay thin and call services.

## Prerequisites

- **Node.js** (>= 22)
- **npm** (workspaces are used at the repo root)
- **Docker** + **Docker Compose** (for local Postgres + DynamoDB-Local; matches the AWS-target stack)

## Quick Start

1. **Clone the repository** and install dependencies from the repository root:

   ```bash
   npm install
   ```

2. **Start local Postgres + DynamoDB-Local** (defined in `docker-compose.yml`):

   ```bash
   npm run docker:up
   ```

   This launches a Postgres 16 container on `localhost:5432` (database `turnier_dev` and `turnier_test`, user `turnier`, password `turnier`) and DynamoDB-Local on `localhost:8000`. Data persists in named Docker volumes; use `npm run docker:reset` to drop them.

3. **Configure the server environment.** Copy the example file and adjust values if needed:

   ```bash
   cp server/.env.example server/.env
   ```

   Important variables:

   - `DATABASE_URL` — Postgres connection string (default: `postgresql://turnier:turnier@localhost:5432/turnier_dev?schema=public`, matching the Docker Compose container).
   - `JWT_SECRET` — use a strong secret in production.
   - `INVITE_CODE` — required for new sign-ups (default in the example: `ballspiele2026`).
   - `DEFAULT_SCHOOL_NAME` — school name auto-created at startup (default: `defaultSchool`; may contain spaces, e.g. `"BBS Hannover"`).
   - `PORT` — API port (default `3001`).
   - `AUTH_RATE_LIMIT_WINDOW_MS` / `AUTH_LOGIN_MAX_REQUESTS` / `AUTH_SIGNUP_MAX_REQUESTS` / `AUTH_IDENTIFIER_MAX_REQUESTS` — auth-endpoint abuse protection (window + max requests per IP and identifier). Storage is pluggable: in-memory in dev/legacy single-VM, DynamoDB in the upcoming AWS deployment (Phase 5).
   - `LOGIN_LOCKOUT_START_AFTER_FAILURES` / `LOGIN_LOCKOUT_BASE_MS` / `LOGIN_LOCKOUT_MAX_MS` — progressive temporary lockout for repeated failed logins per email/identifier (same pluggable storage as above).
   - `CORS_ALLOWED_ORIGINS` — comma-separated allowlist of browser origins that may call the API with credentials.
   - `TRUST_PROXY` — set to `1` (or the correct hop count) when running behind a reverse proxy so IP-based protections use the real client IP.
   - `JSON_BODY_LIMIT` — max JSON request payload size for `express.json` (default `100kb`).

4. **Apply Prisma migrations** to the dev DB and optionally **seed** demo data:

   ```bash
   npm run db:push   # = prisma migrate deploy
   npm run db:seed
   ```

   If you change `schema.prisma`, generate a new migration locally:

   ```bash
   npm run db:migrate -- --name <slug>
   ```

   Migration history lives at `server/prisma/migrations/` and is checked in. For destructive iteration against an empty local DB, `npx prisma migrate reset --force` (from `server/`) is fine.

   The seed creates a demo user (`seed@turnier-hub.local` / `seeduser`, password `seedseed12`) with role **`admin`**, twelve players, shared demo **school classes**, and four demo tournaments: **"Demo: Football School Cup"** (Group → K.O., 8 teams in 2 groups), **"Demo: Volleyball K.O."** (Direct K.O., 6 teams with byes), **"Demo: Direct K.O. with 15 Teams"** (Direct K.O., 15 teams), and **"Demo: Badminton Round Robin"** (Round-Robin, 5 individuals). Re-running the seed removes **all** tournaments, **school classes**, and players belonging to that demo user, then recreates the demo data (other accounts are untouched).

4.1. **Wipe demo data (dev/test) without deleting users**

If you want to remove all demo content but keep `User` rows intact:

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
   - API: [http://localhost:3001](http://localhost:3001)
   - The Vite dev server proxies **`/api`** to port 3001. SSE (`/api/sse`) goes through that proxy as a regular long-lived HTTP response — no special WebSocket pass-through is needed.

## NPM Scripts (repository root)

| Script | Description |
| ------ | ----------- |
| `npm run dev` | Starts Express (with API) and the Vite dev server concurrently. |
| `npm run docker:up` | Starts local Postgres + DynamoDB-Local via `docker-compose.yml`. |
| `npm run docker:down` | Stops the containers (keeps named volumes). |
| `npm run docker:reset` | Stops containers **and** drops their data volumes. |
| `npm run build` | Builds server TypeScript output and the client production bundle. |
| `npm run lint` | Runs ESLint on the client (`client/`). |
| `npm run lint:fix` | ESLint with `--fix` (client workspace). |
| `npm run prod:prepare` | `db:generate` + full `build` (typical after `npm ci` on a server). |
| `npm run prod:start` | Starts the server with `NODE_ENV=production` (serves API + built SPA from `client/dist`). |
| `npm run prod` | `prod:prepare` then `prod:start` in one step. |
| `npm run db:push` | Applies all pending Prisma migrations using `server/.env` (= `prisma migrate deploy`). |
| `npm run db:migrate -- --name <slug>` | Generates a new dev migration and applies it locally (= `prisma migrate dev`). |
| `npm run db:deploy` | Same as `db:push` — use on production hosts with the correct `DATABASE_URL` in the environment. |
| `npm run db:studio` | Opens Prisma Studio against the database from `server/.env`. |
| `npm run db:generate` | Generates the Prisma client. |
| `npm run db:seed` | Runs the Prisma seed (dev database). |
| `npm run db:clear` | Clears all tables except `User` (dev database). Pass `-- --yes` for confirmation. |
| `npm run db:push:test` | Applies migrations against `server/.env.test` (test DB). |
| `npm run db:migrate:test` | Applies pending migrations against the test DB (rare; mostly mirrors `db:push:test`). |
| `npm run db:seed:test` | Seeds the test database. |
| `npm run db:clear:test` | Clears all tables except `User` (test DB). Pass `-- --yes` for confirmation. |
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

**Prisma — `db:push` / `db:migrate` / `db:deploy` vs `db:generate`:** `db:push`, `db:migrate`, and `db:deploy` all apply **migrations to the database**. `db:migrate` (= `prisma migrate dev`) is the only one that creates a new migration file from your current `schema.prisma`; the other two just apply what is already on disk. `db:generate` only **rebuilds the Prisma Client** under `node_modules` (typed API for your code) and does **not** modify the database. After schema edits you usually run `db:migrate -- --name <slug>` and ensure the client is generated (`db:generate`, or rely on tooling that runs it — e.g. `prod:prepare` runs `db:generate` before the build).

Realtime test coverage (current baseline):
- **Server bus + SSE handler:** `tests/server/unit/eventBus.test.ts` (subscription filtering, listener isolation) and `tests/server/unit/sseEndpoint.test.ts` (SSE handler over a real HTTP server: token auth, `tournamentChanged` routed only to subscribers, `catalogChanged` broadcast, listener cleanup on disconnect).
- **Client SSE adapter:** `tests/client/unit/realtimeClient.test.ts` (`EventSource` URL building, debounced reconnect on subscribe/unsubscribe, message dispatch hook, disconnect behavior).

## Database Profiles (dev / test / production)

### Dev DB
- Environment file: `server/.env`
- Underlying database: Postgres 16 from `docker-compose.yml` (database `turnier_dev`)
- Apply migrations: `npm run db:push` (= `prisma migrate deploy`)
- Generate a new migration after editing `schema.prisma`: `npm run db:migrate -- --name <slug>`
- Seed demo data: `npm run db:seed` (script: `server/scripts/seed.ts`)
- Clear demo content (keep `User`): `npm run db:clear -- --yes` (script: `server/scripts/clearDbExceptUsers.ts`)
- Internally, `db:seed` runs Prisma's configured seed script via `server/package.json` → `prisma.seed: "tsx scripts/seed.ts"`.
- Internally, `db:clear` runs `tsx scripts/clearDbExceptUsers.ts` from `server/package.json`.

### Test DB
- Environment file: `server/.env.test`
- Underlying database: same Postgres container, separate database `turnier_test` (created by `docker/postgres/init/01-create-test-database.sql` on first container start)
- Apply migrations: `npm run db:push:test`
- Seed demo data: `npm run db:seed:test` (same script: `server/scripts/seed.ts`)
- Clear demo content (keep `User`): `npm run db:clear:test -- --yes` (same script: `server/scripts/clearDbExceptUsers.ts`)
- Internally, `db:seed:test` reuses the same seed file (`server/scripts/seed.ts`) but executes under `server/.env.test`.
- Internally, `db:clear:test` runs the same clear file (`server/scripts/clearDbExceptUsers.ts`) but executes under `server/.env.test`.

### Production
- Environment variables: `DATABASE_URL` and other secrets are provided by the host (no local `.env` reliance)
- Apply migrations: `npm run db:deploy` (= `prisma migrate deploy`)
- Seed/clear: not part of the standard flow; avoid `npm run db:clear` on production.

## Production

The repository currently contains two production paths, switching from the first to the second over the course of the AWS migration:

1. **Legacy single-VM (Ansible).** Documented in [`ansible/README.md`](ansible/README.md). To be retired in [`MIGRATION_AWS.md`](MIGRATION_AWS.md) Phase 7.
2. **AWS serverless (in progress).** Lambda Function URLs (Express via `serverless-http`, plus a streaming SSE handler) behind CloudFront, with RDS Postgres and DynamoDB. CDK stacks land in Phase 4; see `MIGRATION_AWS.md` for status.

Steps below describe the legacy single-VM path; both paths share the same Node.js entry points and Prisma migrations.

1. Set environment variables on the host (`DATABASE_URL`, `JWT_SECRET`, `INVITE_CODE`, `PORT`, `CORS_ALLOWED_ORIGINS`, `TRUST_PROXY`, etc.) — do not rely on committing `.env`.

2. Install dependencies and prepare the build:

   ```bash
   npm ci
   npm run prod:prepare
   ```

3. Apply migrations to the production database (with production `DATABASE_URL` set):

   ```bash
   npm run db:deploy
   ```

   Migration history is tracked under `server/prisma/migrations/`; this command runs `prisma migrate deploy` (idempotent — applies only what has not been applied yet).

4. Start the server (API + static SPA):

   ```bash
   npm run prod:start
   ```

Notes:
- `db:seed` / `db:clear` are for development/test workflows. On production, use `db:deploy` only (and seed manually only if you explicitly want demo data).
- **Reverse proxy (e.g. Nginx):** if TLS or a proxy sits in front of Node, the only realtime concern is that the proxy must **not** buffer responses on `/api/sse` (set `proxy_buffering off`). SSE is plain HTTP/1.1, so no WebSocket upgrade headers are required.
- **Auth abuse protection:** login/signup are rate-limited per IP and per identifier (`email` / `username`) and return `429` + `Retry-After` when limits are exceeded.

   Or use `npm run prod` to run steps 2–4's build/start in one go after `npm ci` (run `db:deploy` separately when the database is ready).

   Equivalent from the server workspace after a root build: `npm run start:prod -w server`.

## Security Notes

- **Security backlog + runbook:** see [`doc/SECURITY.md`](doc/SECURITY.md) for prioritized hardening tasks, production checks, and incident procedures.
- **Auth endpoint throttling:** `POST /api/auth/login` and `POST /api/auth/signup` are rate-limited via the `RateLimitStore` adapter (`MemoryRateLimitStore` in dev/legacy single-VM; `DynamoRateLimitStore` in the upcoming AWS deployment — Phase 5).
- **Security headers:** API responses include baseline HTTP security headers via `helmet`.
- **CORS allowlist:** browser calls are accepted only from origins in `CORS_ALLOWED_ORIGINS` (comma-separated).
- **Rate-limit env vars:** `AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_LOGIN_MAX_REQUESTS`, `AUTH_SIGNUP_MAX_REQUESTS`, `AUTH_IDENTIFIER_MAX_REQUESTS`.
- **Progressive login lockout:** repeated failed logins per identifier trigger temporary backoff (`LOGIN_LOCKOUT_*`) and return `429` with `Retry-After`. Storage uses the same `LockoutStore` adapter pattern as the rate limiter.
- **Session invalidation:** JWTs carry per-user token version (`tv`). `POST /api/auth/revoke-sessions` rotates the caller's token version and invalidates all previously issued tokens for that account.
- **Proxy/IP env var:** `TRUST_PROXY` (for example `1` behind Nginx) so `req.ip` is correct for rate limits and auditing.
- **Payload-size env var:** `JSON_BODY_LIMIT` limits JSON request size globally (default `100kb`).
- **Structured security signals:** the server emits JSON warning logs for `401`/`403`/`429` responses (`category:"security"`, `type:"http_auth_status"`). In the AWS deployment, CloudWatch Metric Filters aggregate these into spike alarms; in dev they show up on stderr as one-line JSON events.
- **How limits are applied:** both per-IP and per-identifier counters run in parallel; if either threshold is exceeded in the active window, the request is blocked (`429`).
- **Current scope:** with the default in-memory adapters limits are process-local. The Phase-5 DynamoDB adapter makes them work across all Lambda instances; on the legacy single-VM that is not needed because there is only one process.
- **Proxy setup:** if your app runs behind a reverse proxy, configure trusted proxy hops so `req.ip` reflects the real client IP and keep your allowed browser origins aligned with the public frontend URL(s).
- **Secrets:** always set strong production values for `JWT_SECRET` and `INVITE_CODE` through host environment variables. AWS deployment pulls these from Secrets Manager (Phase 4).

## Security Runbook

For operational procedures and the security checklist in one place, see [`doc/SECURITY.md`](doc/SECURITY.md).

## Additional Documentation

- [`MIGRATION_AWS.md`](MIGRATION_AWS.md) - phase-by-phase AWS migration plan and current status.
- [`doc/TURNIERLOGIK.md`](doc/TURNIERLOGIK.md) - detailed German-language tournament logic documentation.
- [`doc/SECURITY.md`](doc/SECURITY.md) - consolidated security checklist and incident runbook.
- [`doc/TODO.md`](doc/TODO.md) - historical tournament refactoring checklist.

## Project Layout

```
turnier-hub/
├── ansible/                   # Legacy single-VM deployment (retiring in MIGRATION_AWS.md Phase 7)
├── docker-compose.yml         # Local Postgres + DynamoDB-Local for dev/tests
├── docker/postgres/init/      # First-run init SQL (creates the test database alongside dev)
├── tests/                     # Shared root test tree (server + client Vitest tests)
│   ├── server/
│   └── client/
├── shared/                    # @turnier-hub/shared: catalog + tournament TypeScript types and formatting helpers (client + server depend on this)
├── client/                    # Vue SPA (Vite)
│   ├── eslint.config.js       # ESLint flat config
│   ├── src/
│   │   ├── api/               # authApi, adminApi, classesApi, playersApi, tournamentsApi, http (fetch + token)
│   │   ├── components/        # Shared UI (e.g. CatalogPageHeader, EntityDialog, ScopeToggle); Storybook stories in tests/client/storybook/
│   │   ├── composables/       # Feature composables (dashboard, admin, classes, players, tournaments)
│   │   ├── realtime/          # SSE client (EventSource on /api/sse, tournament subscribe, dispatch to stores)
│   │   ├── stores/            # Pinia: auth, theme, toast + domain (tournamentLayout/ with rosterActions, matchActions, phaseActions; players/classes/tournaments list, dashboard)
│   │   ├── theme/             # centralized design tokens and font import
│   │   ├── tournament/        # Pure derive/format logic, layout bridge (useTournamentLayoutState → store), UI class tokens; DTO types from @turnier-hub/shared
│   │   └── views/
│   │       └── tournament/    # TournamentLayout, Matches (layout + overview + setup), Roster (thin; roster logic in composables)
├── server/                    # Express API, Prisma schema & scripts
│   ├── prisma/                # schema.prisma + migrations/ (Postgres)
│   ├── scripts/
│   └── src/
│       ├── app.ts, index.ts   # Express app; plain HTTP server (no WebSocket upgrade — SSE handler is a regular GET route)
│       ├── realtime/          # eventBus.ts (RealtimeEventBus + MemoryEventBus), sseEndpoint.ts (createSseHandler for /api/sse), notify.ts (publish into bus from routes)
│       ├── state/             # rateLimitStore.ts + lockoutStore.ts (transport-agnostic stores; Memory now, Dynamo in Phase 5)
│       ├── routes/            # auth, classes, players, tournaments/…
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

- `server/.env.test` points at the `turnier_test` Postgres database in the local Docker Compose container; the API runs on port `3002`.
- Use `npm run db:push:test` and `npm run db:seed:test` against that database.
- Use `npm run db:clear:test -- --yes` to wipe demo content while keeping `User`.
- If you run only the test API, point the client proxy at port `3002` or call the API directly.
- Client integration tests (`tests/client/integration`) reset the test DB and seed a small minimal dataset per test for faster runs.

## License

See the `LICENSE` file in the repository.
