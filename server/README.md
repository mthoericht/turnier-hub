# Turnier-Hub server

Express, Prisma and SQLite server for the account-free shared catalog. See the
[root README](../README.md) for the supported host-development workflow. Start
`npm run dev` at the repository root to get the same Electron host and local
management as the desktop application, with a separate development database.

`src/runtime.ts` owns HTTP/WebSocket/Prisma startup and shutdown. Catalog routes
are `/api/classes`, `/api/players` and `/api/tournaments`; `/api/ws` pushes changes.
There are no authentication, admin, user or school-tenant routes. Host-only data
operations are bounded Electron IPC, never LAN HTTP/filesystem endpoints.

The server workspace's `dev` command is a low-level API-only tool. It does not
provide local host management. Running it manually uses the chosen environment;
never point schema/seed/clear tools at a real or legacy prototype database.
The supported root host start ignores `.env` and supplies isolated runtime settings.

`prisma/schema.prisma` defines the account-free schema. `db:generate` regenerates
only the client; `db:push` writes the selected database. Desktop builds create a
fresh empty template and refuse changed runtime fingerprints rather than migrating
existing databases. `scripts/seed.ts` refuses nonempty catalogs. No runtime Prisma
CLI calls, downloads or automatic seeding are performed.
