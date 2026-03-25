# Agent / contributor guide

This document helps humans and coding agents work effectively in **turnier-hub**. For user-facing documentation, see [README.md](README.md).

## Repository shape

- **npm workspaces** at the repo root: `client/` (Vue 3 + Vite + Tailwind), `server/` (Express + Prisma + SQLite).
- Run **install and most scripts from the repository root**, not only inside `client` or `server`, unless you have a reason.

## Commands (from repo root)

| Goal | Command |
| ---- | ------- |
| Dev (API + Vite) | `npm run dev` |
| Production build (server + client) | `npm run build` |
| Lint client (ESLint) | `npm run lint` / `npm run lint:fix` |
| Prod: generate Prisma client + build | `npm run prod:prepare` |
| Prod: start API + static SPA (`NODE_ENV=production`) | `npm run prod:start` |
| Prod: prepare + start in one step | `npm run prod` |
| Apply Prisma schema (dev `.env`) | `npm run db:push` |
| Apply schema (production naming; uses current `DATABASE_URL`) | `npm run db:deploy` |
| Prisma Studio | `npm run db:studio` |
| Regenerate Prisma client | `npm run db:generate` |
| Seed demo data (dev) | `npm run db:seed` |
| Clear DB (dev, keep `User`) | `npm run db:clear -- --yes` |
| Test DB schema + seed | `npm run db:push:test` / `npm run db:seed:test` |
| Clear DB (test, keep `User`) | `npm run db:clear:test -- --yes` |
| API only, test env (`PORT` 3002) | `npm run dev:test` |
| Clean install | `npm run clean:install` |

- **Server** entry: `server/src/index.ts` (dev: `tsx watch`). Production: `node server/dist/index.js` (`start` / `start:prod` in server workspace).
- **Client** dev server proxies `/api` to the backend (default `http://localhost:3001`).
- **Client** ESLint: flat config in `client/eslint.config.js` (`typescript-eslint`, `eslint-plugin-vue`; stylistic rules include semicolons, Allman braces, 2-space indent).

## Environment and secrets

- Copy `server/.env.example` → `server/.env` for local development. Do **not** commit `.env`.
- `DATABASE_URL` in `.env` is resolved relative to `server/prisma/` (see `.env.example`).
- **Test** profile: `server/.env.test` (separate SQLite file, e.g. `data/test.db`). Seed respects an already-set `DATABASE_URL` so `dotenv-cli` can target the test DB.
- Typical keys: `JWT_SECRET`, `INVITE_CODE`, `PORT`, `DATABASE_URL`.

## Database and Prisma

- Schema: `server/prisma/schema.prisma`.
- **Dev DB**: uses `server/.env` (SQLite file referenced by `DATABASE_URL`) and the root scripts:
  - Apply schema: `npm run db:push`
  - Seed demo data: `npm run db:seed` (script: `server/scripts/seed.ts`)
    - Under the hood: `server/package.json` configures Prisma seed (`prisma.seed`) to run `tsx scripts/seed.ts`.
  - Clear DB (keep `User`): `npm run db:clear -- --yes` (script: `server/scripts/clearDbExceptUsers.ts`)
    - Under the hood: `server/package.json` runs `tsx scripts/clearDbExceptUsers.ts`.
- **Test DB**: uses `server/.env.test` and the root scripts:
  - Apply schema: `npm run db:push:test`
  - Seed demo data: `npm run db:seed:test` (same script: `server/scripts/seed.ts`)
    - Under the hood: same `tsx scripts/seed.ts`, but executed with `dotenv -e .env.test`.
  - Clear DB (keep `User`): `npm run db:clear:test -- --yes` (same script: `server/scripts/clearDbExceptUsers.ts`)
    - Under the hood: same `tsx scripts/clearDbExceptUsers.ts`, but executed with `dotenv -e .env.test`.
- **Production**: uses host environment variables (especially `DATABASE_URL`) and the root scripts:
  - Apply schema: `npm run db:deploy` (currently `prisma db push`; no migration history yet)
  - Regenerate Prisma client if needed: `npm run db:generate`
  - Seed/clear are not part of the standard production flow; avoid `db:clear` on production.
- **Breaking schema changes:** if `prisma db push` refuses to add non-nullable columns to existing rows, use a **development-only** reset (destroys all local DB data), then `db:seed`. Prisma may require `prisma db push --force-reset` plus an explicit consent env var when run from tooling; running the same from your own terminal is fine for local SQLite.

## API surface (high level)

- REST under `/api`: `/api/auth`, `/api/classes`, `/api/players`, `/api/tournaments` (nested routes for teams, roster members, matches, timer, advance, standings, etc.).
- Auth: `Authorization: Bearer <JWT>`; client stores token in **localStorage** key `turnier_hub_token`.

## Front end

- **Pinia** (`auth`, `theme`, **`toast`**), **Vue Router**, Tailwind with **`darkMode: 'class'`** on `<html>`.
- Theme persistence: `localStorage` key `turnier_hub_theme`.
- **Toasts:** `client/src/stores/toast.ts` (`showError` / `showSuccess` / `showInfo`); **`ToastHost.vue`** is mounted in `App.vue` (fixed overlay, no `Teleport` + `TransitionGroup` together — known Vue pitfall).
- **Tournaments:** parent layout `TournamentLayout.vue` loads data once, `provide`s `tournamentLayoutKey` from `client/src/tournament/tournamentContext.ts`; child routes **Roster** (`TournamentRosterView.vue`) and **Matches** (`TournamentMatchesLayout.vue` with nested overview + setup views), tabs **Kader** then **Spiele**; under **Spiele**, UI labels **Übersicht** / **Spielbetrieb** (code: `tournament-matches-overview`, `tournament-matches-setup`, `TournamentMatchesSetupView.vue`). Default redirect is **roster**. **Logic** lives under `client/src/tournament/` (API, pure derive/format helpers, UI class tokens, `useTournamentLayoutState`, `useTournamentPhaseStepper`); views stay thin. Paths `roster`, `matches`, `matches/setup`.
- **Score draft:** `buildScoreDraftFromMatches` / `mergeScoreDraftFromMatches` in `tournamentDerive.ts` — merge on `load()` avoids overwriting in-progress edits when the match timer poll refetches; draft defaults missing DB scores to **`"0"`**; **`parseScoreDraftForPatch`** requires **both** goals when saving (no partial PATCH). Tournament action errors use **toasts** from `useTournamentLayoutState` (initial load failure still uses layout `error`). **Regenerate group / advance** confirm dialogs when existing results would be lost (`groupRegenerateRisksDataLoss`, `advanceTargetRisksDataLoss` in `tournamentDerive.ts`).
- **Server KO advancement:** `requireKnockoutWinnerTeamId` in `server/src/services/standings.ts` (used by `advancePhase.ts`) — winners come from **persisted** `homeScore`/`awayScore` only; timer **end** alone does not set them.
- **Classes:** route `/classes`, view `ClassesView.vue`, API `client/src/api/classesApi.ts` (scope all/own like players).
- Prefer **responsive** patterns already used: mobile nav in `App.vue`, `sm:` / `md:` breakpoints elsewhere.

## Conventions for changes

- Keep diffs **focused** on the requested task; match existing style, imports, and naming.
- Do **not** commit SQLite files (`*.db`), `.env`, or generated `dist/` / `node_modules/`.
- **English** for `README.md` and this file; product UI strings may stay **German** unless the project moves to i18n.
- If you add new env vars, update `server/.env.example` and [README.md](README.md) when relevant.
- After substantive client edits, run **`npm run lint -w client`** (and `vue-tsc --build --noEmit` in `client/` if types are touched).

## Useful paths

| Area | Path |
| ---- | ---- |
| API routes | `server/src/routes/` |
| Auth middleware | `server/src/middleware/auth.ts` |
| Tournament logic | `server/src/services/` |
| DB seed | `server/scripts/seed.ts` |
| DB clear (keep User) | `server/scripts/clearDbExceptUsers.ts` |
| Client views | `client/src/views/` |
| HTTP API (resource modules) | `client/src/api/authApi.ts`, `classesApi.ts`, `playersApi.ts`, `tournamentsApi.ts` (use `http.ts` for `getToken` / `setToken` / low-level `api`) |
| Tournament domain (pure helpers + UI tokens) | `client/src/tournament/tournamentFormat.ts`, `tournamentDerive.ts`, `tournamentPhaseFlow.ts`, `tournamentUi.ts` |
| Tournament composables | `client/src/tournament/useTournamentLayoutState.ts`, `useTournamentPhaseStepper.ts` (also available via `client/src/composables/tournaments/` re-exports) |
| Tournament views | `client/src/views/tournament/` |
| Tournament types + inject key | `client/src/tournament/tournamentContext.ts` |
| Client API helper | `client/src/api/http.ts` |
| Client ESLint | `client/eslint.config.js` |
| Toasts (Pinia + host) | `client/src/stores/toast.ts`, `client/src/components/ToastHost.vue` |

## Product context (short)

School-style tournaments: scoped per **user**; **school classes** are managed per user (`SchoolClass`); **players** optionally link to a class and are assigned to **team rosters** per tournament. **Matches are team vs. team**: one **group stage** (every team vs. every other team), standings in a **single table**, top **`advancesPerGroup`** rows feed knockout pairings (server-side). **Manual scores**; **match timer** (including **end** from scheduled state without starting the clock). Sign-up requires the configured **invite code**.
