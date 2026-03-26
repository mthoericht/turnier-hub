# Turnier-Hub

Turnier-Hub is a small full-stack web application for managing school sports tournaments (for example volleyball, football, or two-field ball). It covers user registration with an invite code, **school classes** (managed separately and linked to players), player rosters, tournament setup with **teams** (or individuals), three **tournament modes** (group stage → knockout, direct knockout, round-robin), multiple **groups**, knockout phases (round of 16 / quarter / semi / final), manual score entry, and a per-match stopwatch.

## Features

- **Authentication:** Sign-up requires a shared **invite code** (configurable). Login uses email and password. Sessions use **JWT** in the `Authorization: Bearer` header; the token is stored in the browser under the localStorage key `turnier_hub_token`.
- **Users:** Each account has a **username** (unique, normalized) and email. **Players** and **tournaments** belong to that user.
- **Classes:** CRUD for **school classes** (names unique per user); players optionally belong to one class. Routes `/classes` (API `/api/classes`).
- **Players:** CRUD for players; optional class is chosen from your managed classes. Scoped list views (all vs. own) like tournaments.
- **Tournaments:** Create tournaments with one of three **modes**: **Group → K.O.** (classic group stage feeding knockout rounds), **Direct K.O.** (knockout only, supports arbitrary team counts with byes), or **Round-Robin** (everyone vs everyone, no knockout). Optionally mark **teams as individuals** (e.g. Badminton — players become teams directly). In **Spielbetrieb**, Group → K.O. lets you set **group count** directly next to "Gruppenspiele erzeugen" and save **advancers per group** separately via "Einstellungen speichern". Add **teams**, assign players to **team rosters** (optionally transfer rosters from another tournament in the **Mannschaften** tab), generate **group / round-robin matches** (organized in parallel rounds), view **standings** (per group when applicable), then advance through **round of 16 → quarter → semi → final** with pairings computed on the server; scoped to the signed-in user. Group generation ignores teams without members. Group and team names are editable in the roster UI. All matches can be **deleted at once** via "Alle Spiele löschen" in Spielbetrieb. The tournament UI uses tabs **Mannschaften** then **Spiele** (default `/tournaments/:id` opens **Mannschaften**). Under **Spiele**, the German labels **Übersicht** and **Spielbetrieb** map to routes `tournament-matches-overview` and `tournament-matches-setup` (paths `/tournaments/:id/matches` and `/tournaments/:id/matches/setup`).
- **Matches:** **Start / pause / resume / end / cancel** timer; **scores** editable at any time. Score fields default to **0**; **Save** sends **both** home and away goals in one request so the database never ends up with only one side set (required for knockout advancement). **Ending the timer** marks the match finished but does **not** substitute for saved scores — use **Save** so winners can be determined from stored values. While a match timer is running, periodic reloads **merge** the score draft with the server so unsaved typing is not wiped. Regenerating the **group stage** or **KO rounds** asks for confirmation if existing results would be deleted.
- **Feedback:** **Toasts** (global, bottom of the screen) surface validation hints and API errors for tournament actions (for example advance rules or save issues).
- **UI:** Vue front end with **light and dark** themes (persisted), **responsive** layout including a mobile navigation menu.

## Tech Stack

| Layer    | Technology |
| -------- | ---------- |
| Client   | Vite, Vue 3, TypeScript, Pinia, Vue Router, Tailwind CSS |
| Server   | Express, TypeScript |
| Database | SQLite via Prisma ORM |
| Auth     | JWT, bcryptjs |
| Lint     | ESLint 9 (flat config), `typescript-eslint`, `eslint-plugin-vue` (client) |

The SQLite file lives under `data/` (for example `data/dev.db`). Database files are not committed to the repository.

## Prerequisites

- **Node.js** (current LTS recommended)
- **npm** (workspaces are used at the repo root)

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

   - `DATABASE_URL` — SQLite path relative to `server/prisma` (default points to `data/dev.db`).
   - `JWT_SECRET` — use a strong secret in production.
   - `INVITE_CODE` — required for new sign-ups (default in the example: `ballspiele2026`).
   - `PORT` — API port (default `3001`).

3. **Apply the database schema** and optionally **seed** demo data:

   ```bash
   npm run db:push
   npm run db:seed
   ```

   If `db:push` fails because of existing rows (e.g. after a breaking schema change), reset the **local** SQLite file (this deletes all data), then push and seed again — for example delete `data/dev.db` or use `npx prisma db push --force-reset` from `server/` (development only).

   The seed creates a demo user (`seed@turnier-hub.local` / `seeduser`, password `seedseed12`), twelve players, shared demo **school classes**, and three demo tournaments covering each mode: **"Demo: Fußball Schulcup"** (Group → K.O., 8 teams in 2 groups), **"Demo: Volleyball K.O."** (Direct K.O., 6 teams with byes), and **"Demo: Badminton Jeder gegen Jeden"** (Round-Robin, 5 individuals). Re-running the seed removes **all** tournaments, **school classes**, and players belonging to that demo user, then recreates the demo data (other accounts are untouched).

3.1. **Wipe demo data (dev/test) without deleting users**

If you want to remove all demo content but keep `User` rows intact:

```bash
npm run db:clear -- --yes
```

For the test database:

```bash
npm run db:clear:test -- --yes
```

4. **Run the app in development** (API + Vite dev server with proxy):

   ```bash
   npm run dev
   ```

   - Front end: [http://localhost:5173](http://localhost:5173)
   - API: [http://localhost:3001](http://localhost:3001)

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
| `npm run db:deploy` | Same as `db:push` — use on production hosts with the correct `DATABASE_URL` in the environment. |
| `npm run db:studio` | Opens Prisma Studio against the database from `server/.env`. |
| `npm run db:generate` | Generates the Prisma client. |
| `npm run db:seed` | Runs the Prisma seed (dev database). |
| `npm run db:clear` | Clears all tables except `User` (dev database). Pass `-- --yes` for confirmation. |
| `npm run db:push:test` | Pushes schema using `server/.env.test` (test DB). |
| `npm run db:seed:test` | Seeds the test database. |
| `npm run db:clear:test` | Clears all tables except `User` (test DB). Pass `-- --yes` for confirmation. |
| `npm run dev:test` | Runs the server with `NODE_ENV=test` (loads `server/.env.test`, default port `3002`). |
| `npm run test` | Runs Vitest suites for server + client. |
| `npm run test:client` | Runs all client tests (unit + client-API integration). |
| `npm run test:unit` | Runs server unit tests only (Vitest). |
| `npm run test:integration` | Pushes test schema and runs client-API integration tests (Vitest, against test DB/API). |
| `npm run clean` | Removes `node_modules` and `dist` folders in the monorepo. |
| `npm run clean:install` | Runs `clean` then `npm install`. |

## Database Profiles (dev / test / production)

### Dev DB
- Environment file: `server/.env`
- Apply schema: `npm run db:push`
- Seed demo data: `npm run db:seed` (script: `server/scripts/seed.ts`)
- Clear demo content (keep `User`): `npm run db:clear -- --yes` (script: `server/scripts/clearDbExceptUsers.ts`)
- Internally, `db:seed` runs Prisma's configured seed script via `server/package.json` → `prisma.seed: "tsx scripts/seed.ts"`.
- Internally, `db:clear` runs `tsx scripts/clearDbExceptUsers.ts` from `server/package.json`.

### Test DB
- Environment file: `server/.env.test`
- Apply schema: `npm run db:push:test`
- Seed demo data: `npm run db:seed:test` (same script: `server/scripts/seed.ts`)
- Clear demo content (keep `User`): `npm run db:clear:test -- --yes` (same script: `server/scripts/clearDbExceptUsers.ts`)
- Internally, `db:seed:test` reuses the same seed file (`server/scripts/seed.ts`) but executes under `server/.env.test`.
- Internally, `db:clear:test` runs the same clear file (`server/scripts/clearDbExceptUsers.ts`) but executes under `server/.env.test`.

### Production
- Environment variables: `DATABASE_URL` and other secrets are provided by the host (no local `.env` reliance)
- Apply schema: `npm run db:deploy`
- Seed/clear: not part of the standard flow; avoid `npm run db:clear` on production.

## Production

1. Set environment variables on the host (`DATABASE_URL`, `JWT_SECRET`, `INVITE_CODE`, `PORT`, etc.) — do not rely on committing `.env`.

2. Install dependencies and prepare the build:

   ```bash
   npm ci
   npm run prod:prepare
   ```

3. Apply the schema to the production database (with production `DATABASE_URL` set):

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

   Or use `npm run prod` to run steps 2–4's build/start in one go after `npm ci` (run `db:deploy` separately when the database is ready).

   Equivalent from the server workspace after a root build: `npm run start:prod -w server`.

## Project Layout

```
turnier-hub/
├── tests/                     # Shared root test tree (server + client Vitest tests)
│   ├── server/
│   └── client/
├── client/                    # Vue SPA (Vite)
│   ├── eslint.config.js       # ESLint flat config
│   ├── src/
│   │   ├── api/               # authApi, classesApi, playersApi, tournamentsApi, http (fetch + token)
│   │   ├── tournament/        # Types, API, pure logic, composables, UI class tokens
│   │   └── views/
│   │       └── tournament/    # TournamentLayout, Matches (layout + overview + setup view; UI: Übersicht / Spielbetrieb), Roster
├── server/                    # Express API, Prisma schema & scripts
│   ├── prisma/
│   ├── scripts/
│   └── src/
├── data/                      # SQLite files (created locally; .gitignored)
└── package.json               # npm workspaces + shared scripts
```

## TypeScript (client)

The client uses **project references**: root `tsconfig.json` points at `tsconfig.app.json` (application sources) and `tsconfig.node.json` (Vite config). Shared options live in `tsconfig.base.json`. Run `vue-tsc --build --noEmit` from `client/` for a full typecheck. `*.tsbuildinfo` files are local caches and ignored by git.

## Test Environment

- `server/.env.test` defines a separate SQLite file (for example `data/test.db`) and port `3002`.
- Use `npm run db:push:test` and `npm run db:seed:test` against that database.
- Use `npm run db:clear:test -- --yes` to wipe demo content while keeping `User`.
- If you run only the test API, point the client proxy at port `3002` or call the API directly.
- Client integration tests (`tests/client/integration`) reset the test DB and seed a small minimal dataset per test for faster runs.

## License

See the `LICENSE` file in the repository.
