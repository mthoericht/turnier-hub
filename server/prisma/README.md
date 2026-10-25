# Prisma schema notes

`schema.prisma` defines the shared account-free catalog: SchoolClass, Player,
Tournament, TournamentTeam, TournamentTeamMember and Match. There are no user,
role or school-tenant models. Class names are globally unique. Players have
firstName/lastName and an optional class.

## Relations and queries

Scalar IDs such as `tournamentId`, `homeTeamId` and `awayTeamId` are foreign-key
fields; `tournament`, `homeTeam` and `awayTeam` are Prisma relation fields used by
`include`/`select`. A match belongs to one tournament. Both team relations are
nullable, including an away-team bye. Deleting a tournament cascades its matches;
deleting a referenced team sets the match's corresponding team ID to null.

A typical match query is:

```ts
const matches = await prisma.match.findMany({
  where: { tournamentId },
  include: { homeTeam: true, awayTeam: true },
  orderBy: [{ roundOrder: "asc" }, { slotIndex: "asc" }],
});
```

Treat nullable teams explicitly in the service/UI. Schema integrity does not
replace tournament-specific validation such as requiring a persisted winner.

## Schema changes and databases

`npm run db:generate` regenerates the client only. Manual `db:push` writes the
selected database; neither command is versioned migration history. Only apply schema
experiments to a new explicitly isolated database. SQLite URLs in a manual server
environment are resolved relative to this schema directory.

The Electron build creates its own fresh empty template. Runtime compares schema
fingerprints and refuses mismatches; it does not run Prisma CLI or reset an old
database. Existing prototype/development data must remain intact. Versioned
standalone upgrades remain an [implementation limit](../../doc/STANDALONE_VALIDATION.md#limits-of-this-evidence).

Use the root isolated test runner for API/integration checks; see
[development](../../doc/DEVELOPMENT.md). For normal operation use
[host management](../../desktop/README.md#host-management), rather than manual
schema/seed/clear commands against existing data.

## Prisma 7 compatibility

CLI/client/SQLite adapter are pinned together at 7.10.1. Connection URLs live in
`server/prisma.config.ts`, not the datasource block. Both the manual CLI config
and runtime factory preserve schema-relative paths for API-only development.
The existing `prisma-client-js` generator remains supported by Prisma 7, preserving
current imports; no prerelease Prisma 8 or generator rewrite is used.

`server/src/dbClient.ts` centralizes the official better-sqlite3 adapter with
`timestampFormat: "unixepoch-ms"`, retaining Prisma 6’s integer DateTime storage.
The model/enum definitions and SQLite DDL are unchanged. The build normalizes only
the relocated connection-URL line before fingerprinting, retaining the v1 ID
`1ef88f16376a0505a35a11ce2b254ddeef575792e402742f9f59055c801f3262`.
Actual schema and relationship validation remain active.

Isolated desktop regression tests construct the old Prisma 6 DDL, restore a v1
backup with numeric timestamps, preserve roster IDs/scores/timers, and verify that
new writes retain integer timestamps. This is compatibility, not an automatic
schema migration; no existing database was used for these tests.
