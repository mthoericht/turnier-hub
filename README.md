# Turnier-Hub

Turnier-Hub is a small full-stack web application for managing school sports tournaments (for example volleyball, football, or two-field ball). It covers user registration with an invite code, **school classes** (managed separately and linked to players), player rosters, tournament setup with **teams**, a **single group stage** where every team plays every other team once, knockout phases (quarter / semi / final), manual score entry, and a per-match stopwatch.

## Features

- **Authentication:** Sign-up requires a shared **invite code** (configurable). Login uses email and password. Sessions use **JWT** in the `Authorization: Bearer` header; the token is stored in the browser under the localStorage key `turnier_hub_token`.
- **Users:** Each account has a **username** (unique, normalized) and email. **Players** and **tournaments** belong to that user.
- **Classes:** CRUD for **school classes** (names unique per user); players optionally belong to one class. Routes `/classes` (API `/api/classes`).
- **Players:** CRUD for players; optional class is chosen from your managed classes. Scoped list views (all vs. own) like tournaments.
- **Tournaments:** Create tournaments, add **teams** (no pools — one league table), assign players to **team rosters**, generate **round-robin group matches** for all teams, view **standings** (one table), configure **how many teams advance** from the group table, then advance to **quarter-finals**, **semi-finals**, or **final** with pairings computed on the server; scoped to the signed-in user. The tournament UI uses tabs **Roster** then **Matches** (default `/tournaments/:id` opens **roster**). Under **Matches**, the German labels **Übersicht** and **Spielbetrieb** map to routes `tournament-matches-overview` and `tournament-matches-setup` (paths `/tournaments/:id/matches` and `/tournaments/:id/matches/setup`; legacy `/matches/spielbetrieb` redirects to setup). Legacy `/kader` and `/spiele` redirect to roster and matches overview respectively.
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

   The seed creates a demo user (`seed@turnier-hub.local` / `seeduser`, password `seedseed12`), eight players, shared demo **school classes**, and a **“Demo: Fußball Schulcup”** tournament with **four teams**, **six** group-stage matches (all-play-all), and `advancesPerGroup` set to **4** so you can try knockout flows. Re-running the seed removes **all** tournaments, **school classes**, and players belonging to that demo user, then recreates the demo data (other accounts are untouched).

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
| `npm run db:push:test` | Pushes schema using `server/.env.test` (test DB). |
| `npm run db:seed:test` | Seeds the test database. |
| `npm run dev:test` | Runs the server with `NODE_ENV=test` (loads `server/.env.test`, default port `3002`). |
| `npm run clean` | Removes `node_modules` and `dist` folders in the monorepo. |
| `npm run clean:install` | Runs `clean` then `npm install`. |

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

   Or use `npm run prod` to run steps 2–4’s build/start in one go after `npm ci` (run `db:deploy` separately when the database is ready).

   Equivalent from the server workspace after a root build: `npm run start:prod -w server`.

## Project Layout

```
turnier-hub/
├── client/                    # Vue SPA (Vite)
│   ├── eslint.config.js       # ESLint flat config
│   ├── src/
│   │   ├── api/               # authApi, classesApi, playersApi, tournamentsApi, http (fetch + token)
│   │   ├── tournament/        # Types, API, pure logic, composables, UI class tokens
│   │   └── views/
│   │       └── tournament/    # TournamentLayout, Matches (layout + overview + setup view; UI: Übersicht / Spielbetrieb), Roster
├── server/                    # Express API, Prisma schema & seed
│   ├── prisma/
│   └── src/
├── data/                      # SQLite files (created locally; .gitignored)
└── package.json               # npm workspaces + shared scripts
```

## TypeScript (client)

The client uses **project references**: root `tsconfig.json` points at `tsconfig.app.json` (application sources) and `tsconfig.node.json` (Vite config). Run `vue-tsc --build --noEmit` from `client/` for a full typecheck.

## Test Environment

- `server/.env.test` defines a separate SQLite file (for example `data/test.db`) and port `3002`.
- Use `npm run db:push:test` and `npm run db:seed:test` against that database.
- If you run only the test API, point the client proxy at port `3002` or call the API directly.

## License

See the `LICENSE` file in the repository.
