# Turnier-Hub

Turnier-Hub is a small full-stack web application for managing school sports tournaments (for example volleyball, football, or two-field ball). It covers user registration with an invite code, a **shared catalog** of **school classes**, **players**, and **tournaments** (any signed-in user can edit; creator is shown for attribution), player rosters, tournament setup with **teams** (or individuals), three **tournament modes** (group stage → knockout, direct knockout, round-robin), multiple **groups**, knockout phases (round of 16 / quarter / semi / final), manual score entry, and a per-match stopwatch.

> **AWS migration in flight.** The codebase is moving from the legacy single-VM deployment to a fully serverless AWS stack (Lambda Function URLs + CloudFront + RDS Postgres + DynamoDB). The phase plan and current status live in [`MIGRATION_AWS.md`](MIGRATION_AWS.md). Local development in this repository runs without Docker using a local PostgreSQL server.

## Table of Contents

- [Quick Paths](#quick-paths)
- [Quick Start](#quick-start)
- [NPM Scripts (repository root)](#npm-scripts-repository-root)
- [How To Use (Typical Workflow)](#how-to-use-typical-workflow)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Production](#production)
- [Additional Documentation](#additional-documentation)

## Quick Paths

- **Run locally (daily dev):** follow [Quick Start](#quick-start), then `npm run dev`.
- **Work on database:** use [Local Dev (no Docker DB)](#local-dev-no-docker-db) and [Database Profiles](#database-profiles-dev--test--production).
- **Run Lambda locally:** use [Lambda Local (SAM)](#lambda-local-sam).
- **Deploy AWS/CDK:** see [AWS / CDK](#aws--cdk) and migration status in [`MIGRATION_AWS.md`](MIGRATION_AWS.md).
- **Need contributor-level details?** Use [`AGENTS.md`](AGENTS.md) for deeper implementation notes.

## Features

- **Auth + roles:** invite-code signup, JWT sessions, `user`/`admin` roles with admin-only school/user management.
- **Shared catalog:** classes, players, and tournaments are editable by any signed-in user; creator attribution is kept for transparency.
- **Tournament operations:** `GROUP_KO`, `DIRECT_KO`, `ROUND_ROBIN`, plus roster management, transfers, standings, and phase progression.
- **Realtime updates:** SSE (`/api/sse`) pushes tournament and catalog changes to connected clients.
- **Match control:** timer controls, score persistence, KO advancement rules, and final auto-complete.
- **Frontend UX:** responsive Vue UI with global toasts, centralized design tokens, and shared page-header components.

For detailed tournament behavior (KO bracket, byes, tie-breakers, phase flow), see **[`doc/TURNIERLOGIK.md`](doc/TURNIERLOGIK.md)**.
For contributor/deep implementation notes, see **[`AGENTS.md`](AGENTS.md)**.

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
| Database | **PostgreSQL** via Prisma ORM (local without Docker), RDS Postgres in the AWS target architecture |
| Auth     | JWT, bcryptjs |
| Lint     | ESLint 9 (flat config), `typescript-eslint`, `eslint-plugin-vue` (client) |

Local development uses a local PostgreSQL server (for example via Homebrew or Postgres.app) with separate `turnier_dev` and `turnier_test` databases.

Server error handling is centralized: route handlers should use `server/src/middleware/asyncHandler.ts`, and uncaught/domain errors are mapped in `server/src/middleware/error.ts` (for example `ServiceError` and Prisma conflict handling).

Server architecture (quick reference):
- **Routes:** API modules live in `server/src/routes/`; admin endpoints are mounted under `/api/admin`; tournament endpoints are split in `server/src/routes/tournaments/` (`core`, `teams`, `matches`, `standings-advance`) and mounted under `/api/tournaments`.
- **Validation / parser:** request payloads are validated with **Zod** in route modules; invalid input returns `400`.
- **Middleware:** auth guard is `server/src/middleware/auth.ts`; async error forwarding uses `server/src/middleware/asyncHandler.ts`; centralized error mapping/logging is in `server/src/middleware/error.ts`.
- **Services:** business/domain logic lives in `server/src/services/` (pure logic + orchestration); route handlers stay thin and call services.

## Prerequisites

- **Node.js** (>= 22)
- **npm** (workspaces are used at the repo root)
- **PostgreSQL 16** binaries (`initdb`, `pg_ctl`, `createdb`, optional `psql`)

## Quick Start

1. **Clone the repository** and install dependencies from the repository root:

   ```bash
   npm install
   ```

2. **Install PostgreSQL binaries on macOS** (Homebrew):

   ```bash
   brew install postgresql@16
   ```

   Then run all local DB scripts with explicit binary path:

   ```bash
   npm run db:init
   npm run db:start
   ```

3. **Configure the server environment.** Copy the example file and adjust values if needed:

   ```bash
   cp server/.env.example server/.env
   ```

   Important variables:

   - `DATABASE_URL` — Postgres connection string (default: `postgresql://turnier:turnier@localhost:5432/turnier_dev?schema=public`).
   - `JWT_SECRET` — use a strong secret in production.
   - `INVITE_CODE` — required for new sign-ups (default in the example: `ballspiele2026`).
   - `DEFAULT_SCHOOL_NAME` — school name auto-created at startup (default: `defaultSchool`; may contain spaces, e.g. `"BBS Hannover"`).
   - `PORT` — API port (default `3001`).
   - `AUTH_RATE_LIMIT_WINDOW_MS` / `AUTH_LOGIN_MAX_REQUESTS` / `AUTH_SIGNUP_MAX_REQUESTS` / `AUTH_IDENTIFIER_MAX_REQUESTS` — auth-endpoint abuse protection (window + max requests per IP and identifier). Storage is pluggable: in-memory in dev/legacy single-VM, DynamoDB in the upcoming AWS deployment (Phase 5).
   - `LOGIN_LOCKOUT_START_AFTER_FAILURES` / `LOGIN_LOCKOUT_BASE_MS` / `LOGIN_LOCKOUT_MAX_MS` — progressive temporary lockout for repeated failed logins per email/identifier (same pluggable storage as above).
   - `CORS_ALLOWED_ORIGINS` — comma-separated allowlist of browser origins that may call the API with credentials.
   - `TRUST_PROXY` — set to `1` (or the correct hop count) when running behind a reverse proxy so IP-based protections use the real client IP.
   - `JSON_BODY_LIMIT` — max JSON request payload size for `express.json` (default `100kb`).

3.1. **(Optional) Configure the client API base URL** for deployed frontends:

   ```bash
   cp client/.env.example client/.env
   ```

   - `VITE_API_BASE_URL` controls where frontend `fetch`/SSE requests are sent.
   - Keep it empty in local dev (Vite proxy handles `/api`).
   - Set it to your CloudFront/custom domain in deployed environments (for example `https://turnier.example.com`).

4. **Initialize and start local PostgreSQL** (without Docker):

   ```bash
   npm run db:init
   npm run db:start
   ```

   This creates a local Postgres cluster under `data/postgres`, writes logs to `data/postgres.log`, and ensures both databases (`turnier_dev`, `turnier_test`) exist.

   Helpful commands:
   - `npm run db:status`
   - `npm run db:stop`
   - The script auto-detects Homebrew Postgres (`postgresql@16/bin`) when available.
   - If binaries are still not in your PATH, set `PG_BIN` manually (example: `PG_BIN=/opt/homebrew/opt/postgresql@16/bin npm run db:start`).

   If you run into role/permission issues (for example Prisma `P1010: User was denied access`), fix local ownership/rights once:

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

5. **Apply Prisma schema** to the dev DB and optionally **seed** demo data:

   ```bash
   npm run db:push   # = prisma db push
   npm run db:seed
   ```

   If you change `schema.prisma`, re-apply the schema locally:

   ```bash
   npm run db:push
   ```

   The seed creates a demo user (`seed@turnier-hub.local` / `seeduser`, password `seedseed12`) with role **`admin`**, twelve players, shared demo **school classes**, and four demo tournaments: **"Demo: Football School Cup"** (Group → K.O., 8 teams in 2 groups), **"Demo: Volleyball K.O."** (Direct K.O., 6 teams with byes), **"Demo: Direct K.O. with 15 Teams"** (Direct K.O., 15 teams), and **"Demo: Badminton Round Robin"** (Round-Robin, 5 individuals). Re-running the seed removes **all** tournaments, **school classes**, and players belonging to that demo user, then recreates the demo data (other accounts are untouched).

5.1. **Wipe demo data (dev/test) without deleting users**

If you want to remove all demo content but keep `User` rows intact:

```bash
npm run db:clear -- --yes
```

For the test database:

```bash
npm run db:clear:test -- --yes
```

6. **Run the app in development** (API + Vite dev server with proxy):

   ```bash
   npm run dev
   ```

   - Front end: [http://localhost:5173](http://localhost:5173)
   - API: [http://localhost:3001](http://localhost:3001)
   - The Vite dev server proxies **`/api`** to port 3001. SSE (`/api/sse`) goes through that proxy as a regular long-lived HTTP response — no special WebSocket pass-through is needed.

7. **(Optional) Run Lambda locally via SAM** (integration path):

   ```bash
   npm run dev:lambda
   ```

   Notes:
   - This path uses your local Postgres (`localhost:5432`) and runs Prisma schema sync before SAM startup.
   - `sam local` itself requires Docker as Lambda runtime emulator, even if your daily DB/API workflow runs without Docker.
   - One-shot invoke is available via `npm run dev:lambda:invoke`.

### Local Dev Quick Commands (macOS, no Docker)

```bash
brew install postgresql@16
npm run db:init
npm run db:start
npm run db:push
npm run db:push:test
npm run db:seed
npm run dev
```

## NPM Scripts (repository root)

### Local Dev (no Docker DB)

| Script | Description |
| ------ | ----------- |
| `npm run dev` | Starts Express (with API) and the Vite dev server concurrently. |
| `npm run db:init` | Initializes local Postgres data directory under `data/postgres` (no Docker). |
| `npm run db:start` | Starts local Postgres from `data/postgres` and ensures `turnier_dev` + `turnier_test`. |
| `npm run db:status` | Shows status for the local Postgres cluster in `data/postgres`. |
| `npm run db:stop` | Stops local Postgres cluster from `data/postgres`. |
| `npm run db:restart` | Restarts the local Postgres cluster (`db:stop` then `db:start`). |
| `npm run db:push` | Applies the Prisma schema using `server/.env` (= `prisma db push`). |
| `npm run db:deploy` | Same as `db:push` — use on hosts with the correct `DATABASE_URL` in the environment. |
| `npm run db:studio` | Opens Prisma Studio against the database from `server/.env`. |
| `npm run db:generate` | Generates the Prisma client. |
| `npm run db:seed` | Runs the Prisma seed (dev database). |
| `npm run perf:sse` | Runs the SSE capacity probe script (100 concurrent streams by default). |
| `npm run db:clear` | Clears all tables except `User` (dev database). Pass `-- --yes` for confirmation. |
| `npm run db:push:test` | Applies Prisma schema against `server/.env.test` (test DB). |
| `npm run db:seed:test` | Seeds the test database. |
| `npm run db:clear:test` | Clears all tables except `User` (test DB). Pass `-- --yes` for confirmation. |
| `npm run dev:test` | Runs the server with `NODE_ENV=test` (loads `server/.env.test`, default port `3002`). |

### Lambda Local (SAM)

| Script | Description |
| ------ | ----------- |
| `npm run dev:lambda:check` | Checks whether `sam` and `docker` are installed and reachable. |
| `npm run dev:lambda` | Starts local Postgres (if needed), syncs schema, then runs SAM local API (`template.yaml`). |
| `npm run dev:lambda:sam` | Starts SAM local API only (`sam local start-api -t template.yaml --port 3001`). |
| `npm run dev:lambda:invoke` | Invokes local Lambda once with sample event (`tests/lambda/events/api-health.json`). |

### AWS / CDK

| Script | Description |
| ------ | ----------- |
| `npm run cdk:synth` | Synthesizes all CDK stacks in `infra/` to CloudFormation templates (`infra/cdk.out`). |
| `npm run cdk:diff` | Shows infrastructure differences against the deployed stacks (all CDK stacks). |
| `npm run cdk:deploy` | Deploys all CDK stacks in dependency order. |
| `npm run cdk:check` | Runs AWS/CDK preflight checks (context, credentials, required env vars). |

### Build, Test, Quality

| Script | Description |
| ------ | ----------- |
| `npm run build` | Builds server TypeScript output and the client production bundle. |
| `npm run lint` | Runs ESLint on the client (`client/`). |
| `npm run lint:fix` | ESLint with `--fix` (client workspace). |
| `npm run test` | Runs Vitest suites for server + client. |
| `npm run test:client` | Runs all client tests (unit + client-API integration). |
| `npm run test:unit` | Runs server unit tests only (Vitest). |
| `npm run test:integration` | Pushes test schema and runs client-API integration tests (Vitest, against test DB/API). |
| `npm run security:audit` | Runs a policy-based audit wrapper across workspaces (fails on non-allowlisted high/critical vulnerabilities). |
| `npm run storybook` | Starts Storybook for the client (port `6006`; config in `tests/client/storybook/`). See **[tests/client/storybook/README.md](tests/client/storybook/README.md)** for fixtures, mocks, and routed stories. |
| `npm run build-storybook` | Static Storybook build (output under `client/storybook-static/`). |

### Production Helpers

| Script | Description |
| ------ | ----------- |
| `npm run prod:prepare` | `db:generate` + full `build` (typical after `npm ci` on a server). |
| `npm run prod:start` | Starts the server with `NODE_ENV=production` (serves API + built SPA from `client/dist`). |
| `npm run prod` | `prod:prepare` then `prod:start` in one step. |

### Maintenance

| Script | Description |
| ------ | ----------- |
| `npm run clean` | Removes `node_modules` and `dist` folders in the monorepo. |
| `npm run clean:install` | Runs `clean` then `npm install`. |

**Prisma — `db:push` / `db:deploy` vs `db:generate`:** `db:push` and `db:deploy` both apply the current `schema.prisma` to the configured database (`prisma db push`). `db:generate` only **rebuilds the Prisma Client** under `node_modules` (typed API for your code) and does **not** modify the database.

Realtime test coverage (current baseline):
- **Server bus + SSE handler:** `tests/server/unit/eventBus.test.ts` (subscription filtering, listener isolation) and `tests/server/unit/sseEndpoint.test.ts` (SSE handler over a real HTTP server: token auth, `tournamentChanged` routed only to subscribers, `catalogChanged` broadcast, listener cleanup on disconnect).
- **Client SSE adapter:** `tests/client/unit/realtimeClient.test.ts` (`EventSource` URL building, debounced reconnect on subscribe/unsubscribe, message dispatch hook, disconnect behavior).

## Database Profiles (dev / test / production)

### Dev DB
- Environment file: `server/.env`
- Underlying database: local PostgreSQL database `turnier_dev` (cluster files in `data/postgres`)
- Apply schema: `npm run db:push` (= `prisma db push`)
- Seed demo data: `npm run db:seed` (script: `server/scripts/seed.ts`)
- Clear demo content (keep `User`): `npm run db:clear -- --yes` (script: `server/scripts/clearDbExceptUsers.ts`)
- Internally, `db:seed` runs Prisma's configured seed script via `server/package.json` → `prisma.seed: "tsx scripts/seed.ts"`.
- Internally, `db:clear` runs `tsx scripts/clearDbExceptUsers.ts` from `server/package.json`.

### Test DB
- Environment file: `server/.env.test`
- Underlying database: local PostgreSQL database `turnier_test` (same local cluster)
- Apply schema: `npm run db:push:test`
- Seed demo data: `npm run db:seed:test` (same script: `server/scripts/seed.ts`)
- Clear demo content (keep `User`): `npm run db:clear:test -- --yes` (same script: `server/scripts/clearDbExceptUsers.ts`)
- Internally, `db:seed:test` reuses the same seed file (`server/scripts/seed.ts`) but executes under `server/.env.test`.
- Internally, `db:clear:test` runs the same clear file (`server/scripts/clearDbExceptUsers.ts`) but executes under `server/.env.test`.

### Production
- Environment variables: `DATABASE_URL` and other secrets are provided by the host (no local `.env` reliance)
- Apply schema: `npm run db:deploy` (= `prisma db push`)
- Seed/clear: not part of the standard flow; avoid `npm run db:clear` on production.

## Production

Primary target is the AWS serverless stack (Lambda Function URLs + CloudFront + RDS Postgres + DynamoDB), provisioned via CDK.

### AWS serverless deploy (target path)

1. Configure AWS credentials + stage environment:
   - `TURNIER_HUB_STAGE` (for example `dev` or `prod`)
   - account credentials/role with permissions for CDK deploy
   - ensure account/region context is resolvable by CDK (`AWS_PROFILE` or `CDK_DEFAULT_ACCOUNT` + `CDK_DEFAULT_REGION`)
   - optional custom domain settings:
     - `TURNIER_HUB_DOMAIN_NAME` (for example `turnier.example.com`)
     - `TURNIER_HUB_HOSTED_ZONE_DOMAIN` (for example `example.com`)
     - optional existing cert: `TURNIER_HUB_ACM_CERTIFICATE_ARN`
       - if omitted and domain+zone are set, CDK creates a DNS-validated ACM cert in `us-east-1`
2. Deploy infrastructure:
   ```bash
   npm run cdk:check
   npm run cdk:synth
   npm run cdk:diff
   npm run cdk:deploy
   ```
3. Deploy SPA assets:
   - use [`.github/workflows/spa-deploy.yml`](.github/workflows/spa-deploy.yml) with configured AWS role/bucket inputs
   - or manually sync `client/dist` to the configured S3 bucket and invalidate CloudFront
4. Validate runtime:
   - API endpoints via CloudFront domain (`/api/*`)
   - SSE endpoint via `/api/sse`
   - auth flow + one tournament realtime update

Detailed phase status and open cutover tasks: [`MIGRATION_AWS.md`](MIGRATION_AWS.md).
For Route53/domain switch and SSE edge verification, use [`doc/AWS_EDGE_CUTOVER_CHECKLIST.md`](doc/AWS_EDGE_CUTOVER_CHECKLIST.md).


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
- [`infra/README.md`](infra/README.md) - AWS-CDK Infrastrukturdoku (Stacks, Konfiguration, Schritt-für-Schritt Deploy).
- [`doc/AWS_PERF_CHECKLIST.md`](doc/AWS_PERF_CHECKLIST.md) - SSE + DynamoDB capacity probe checklist and on-demand vs provisioned decision guide.
- [`doc/AWS_EDGE_CUTOVER_CHECKLIST.md`](doc/AWS_EDGE_CUTOVER_CHECKLIST.md) - Route53/domain cutover and SSE edge validation checklist.
- [`.github/workflows/spa-deploy.yml`](.github/workflows/spa-deploy.yml) - manual GitHub Action to build `client` and sync SPA assets to S3 (with optional CloudFront invalidation).
- [`doc/TURNIERLOGIK.md`](doc/TURNIERLOGIK.md) - detailed German-language tournament logic documentation.
- [`doc/SECURITY.md`](doc/SECURITY.md) - consolidated security checklist and incident runbook.
- [`doc/TODO.md`](doc/TODO.md) - historical tournament refactoring checklist.

## Project Layout

```
turnier-hub/
├── infra/                     # AWS CDK app (Network/Data/Lambda/Edge stacks; see infra/bin/infra.ts)
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
│   ├── prisma/                # schema.prisma
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

- `server/.env.test` points at the local `turnier_test` PostgreSQL database; the API runs on port `3002`.
- Use `npm run db:push:test` and `npm run db:seed:test` against that database.
- Use `npm run db:clear:test -- --yes` to wipe demo content while keeping `User`.
- If you run only the test API, point the client proxy at port `3002` or call the API directly.
- Client integration tests (`tests/client/integration`) reset the test DB and seed a small minimal dataset per test for faster runs.

## License

See the `LICENSE` file in the repository.
