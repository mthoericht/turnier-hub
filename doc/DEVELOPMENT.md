# Development

Run commands from the repository root with Node.js 22.13+ within the 22 line or Node.js 24 LTS. Install with
`npm ci`. The npm workspaces are `client/` (Vue/Pinia/Vite/Tailwind), `server/`
(Express/Prisma/SQLite) and `shared/` (DTOs/helpers). Contributor conventions are
in [AGENTS.md](../AGENTS.md).

Server lifecycle is in `server/src/runtime.ts`; the shared REST routes are
`/api/classes`, `/api/players` and `/api/tournaments`, with live updates on
`/api/ws`. Electron owns the local host controls; they are not API routes.

## Supported host workflow

`npm run dev` delegates to `npm run desktop:dev`. `desktop/dev.mjs` prepares the
current source and starts Electron with its own server, management window and
persistent development data. Defaults are port 3220 and `.local/desktop-dev/`.
The packaged default is port 3210 with a different data folder. See the
[desktop guide](../desktop/README.md) for operation and data compatibility.

This is a build-before-open workflow, without renderer HMR. Low-level client Vite
and server workspace commands remain available as development tools, but do not
supply the complete local host environment. A LAN browser has no privileged host
management. `prod:*` scripts are API/static-server tools, not Electron packaging.

Both development and packaged Electron hosts ignore `server/.env`. For a
deliberately configured API-only process, `server/.env.example` lists the environment options used by the
current server. Do not reuse a real or legacy database to try the new schema.

## Checks

- `npm run build`: build shared, server and client workspaces.
- `npm run lint`: client ESLint. In `client/`, `npx vue-tsc --build --noEmit`
  checks Vue/TypeScript types.
- `npm test`: server, client, integration and Storybook tests using a new temporary
  SQLite database. `npm run test:client` runs the client/API/Storybook subset with
  that same isolation. `npm run test:integration` runs the focused API/client flows.
  The runner explicitly supplies its test database; it does not reset an existing
  development or `.env.test` database. It removes its temporary data afterward.
- `npm run desktop:prepare`, then `npm run desktop:test`: prepare resources and
  run isolated storage/backup tests.
- `npm run desktop:smoke`, `npm run desktop:smoke:host` and
  `npm run desktop:smoke:errors`: isolated Electron verification. Scripts accept
  a packaged executable as an optional argument. The general smoke defaults to
  port 3210, host-management smoke uses 3213 and error smoke uses 3212; avoid
  conflicting with a running host. Reports/screenshots are in temporary folders.
- `npm run storybook` / `npm run build-storybook`: component examples; see the
  [Storybook guide](../tests/client/storybook/README.md).
- `npm run security:audit`: dependency review using the [audit policy](#audit-policy).

Generate the Prisma client with `npm run db:generate` when required after schema
changes. This generates code; it does not apply the schema to a database. Desktop
preparation includes this step. Direct workspace test commands
do not themselves create the isolated database; prefer the root test runners for
integration flows. Test reset helpers require the isolated-runner flag.

## Database tools

The schema lives in `server/prisma/schema.prisma`. `db:generate` regenerates code
without database writes. Manual `db:push` is retained only for deliberately fresh
API sandboxes; it is not a versioned migration system. `db:studio` is optional
inspection/editing tooling. Desktop users use host management instead. Redundant
manual seed/clear/test-profile DB wrappers have been removed; internal temporary
template/test creation and shared demo fixtures remain.

Never point push/reset/seed/clear commands or smoke tests at existing real,
development or prototype data. Use a new explicitly isolated database for schema
experiments. The desktop build creates a fresh empty template in a temporary
folder; no Prisma CLI runs inside the packaged application.

Do not commit `.env`, SQLite data, `.local/`, generated `dist/`, `desktop/runtime/`
or `release/`. Future schema upgrades require a separate design and acceptance;
see the [validation limits](STANDALONE_VALIDATION.md#limits-of-this-evidence).

## Audit policy

`security:audit` fails on every reported high/critical finding and rejects missing
or malformed audit reports. The former XLSX exception was removed after switching
to the repaired official distribution. A passing result is not a claim that all
dependencies are free of advisories. Registry auditing needs network access and
does not fully cover tarball dependencies; the fixed SheetJS version, upstream
advisories and lockfile integrity are checked separately below.

For the actual LAN/IPC/file-access boundary, see the
[desktop guide](../desktop/README.md#local-access-and-safety).

## Implemented dependency update: 25 October 2026

The authorized update group is implemented in the main checkout. Electron remains
the desktop architecture. The subsequently authorized high-priority Zod/Prisma/
XLSX fixes are also complete. Pinia 4, Router 5, Tailwind 4 and TypeScript 7 were
not adopted.
The 24 October assessment is a historical checkpoint; the following inventory
records the actual installed versions.

### Applied versions and compatibility changes

- Electron 44.9.3 and electron-builder 26.18.0; native arm64 app and ZIP built.
  Electron 44 requires macOS 13 Ventura or later. The builder minimum and actual
  app Info.plist both record `13.0.0`; the embedded Electron framework is 44.9.3.
  The 43/44 breaking-change review did not identify a used removed API. Native
  IPC/window/server lifecycle was checked against the packaged executable.
  Source: [Electron breaking changes](https://www.electronjs.org/docs/latest/breaking-changes).
- Vue 3.5.44, Vite 8.3.5, Vue plugin 6.0.10 and esbuild 0.28.2. The former
  unsupported Vue-plugin/Vite and esbuild peer combinations are gone.
- Storybook core/framework/official addons 10.6.3, Chromatic 5.6.0, Vitest and
  browser/coverage/provider packages 4.1.12, Playwright 1.64.1 and its matching
  Chromium binaries. The Playwright provider uses its factory; obsolete provider
  references were removed. Test mock history is explicitly cleared between XLSX
  export cases under Vitest 4 without weakening the assertions.
- ESLint 10.13.0, @eslint/js 10.0.1, typescript-eslint 8.72.0 and Vue lint plugin
  10.11.1 work with the current flat config. TypeScript stays on 5.9.3; vue-tsc
  is 3.3.13. Smaller compatible tools were refreshed as listed below.
- Express remains 4.22.3 with matching Express 4 types (4.17.25), ws is 8.22.0,
  Helmet 8.3.0, PostCSS 8.5.31. The high-priority follow-up uses Prisma CLI/client/
  adapter 7.10.1, Zod 4.6.7 and official SheetJS 0.20.3.
- Root Node engine range is now `^22.13.0 || ^24.0.0`, replacing the overly broad
  `>=22`; build/test tooling ran with Node 22.22.2. Electron's bundled Node is a
  separate runtime.

The former lockfile reproduced an npm internal `edgesOut` crash. It and the old
installed dependencies were preserved locally; the lockfile was resolved anew
from the deliberate version ranges and installed with `npm ci`. No forced peer
resolution or dependency overrides were introduced. `npm ls --all` exits zero
with no invalid/missing peer relationships. npm additionally reports five
extraneous optional WASM-support packages (@emnapi/core, @emnapi/runtime,
@emnapi/wasi-threads, @napi-rs/wasm-runtime, @tybys/wasm-util); these are install-tree
bookkeeping findings, not silently claimed to be a pristine tree or audit fixes.

### Current direct registry dependencies

Exact versions in the final shared lockfile. Local shared-workspace references
are omitted; the desktop/app manifest has no independent dependency graph.

**package.json**

- `@electron/rebuild`: 4.2.1.
- `electron`: 44.9.3.
- `electron-builder`: 26.18.0.
- `esbuild`: 0.28.2.
- `rimraf`: 6.1.3.

**client/package.json**

- `@fontsource/dm-sans`: 5.3.0.
- `@fontsource/outfit`: 5.3.0.
- `pinia`: 3.0.4.
- `vue`: 3.5.44.
- `vue-router`: 4.6.4.
- `xlsx`: 0.20.3.
- `@chromatic-com/storybook`: 5.6.0.
- `@eslint/js`: 10.0.1.
- `@storybook/addon-a11y`: 10.6.3.
- `@storybook/addon-docs`: 10.6.3.
- `@storybook/addon-vitest`: 10.6.3.
- `@storybook/vue3-vite`: 10.6.3.
- `@vitejs/plugin-vue`: 6.0.10.
- `@vitest/browser`: 4.1.12.
- `@vitest/browser-playwright`: 4.1.12.
- `@vitest/coverage-v8`: 4.1.12.
- `@vue/test-utils`: 2.5.1.
- `autoprefixer`: 10.6.1.
- `dotenv-cli`: 8.0.0.
- `eslint`: 10.13.0.
- `eslint-plugin-vue`: 10.11.1.
- `globals`: 17.13.0.
- `jsdom`: 29.1.1.
- `playwright`: 1.64.1.
- `postcss`: 8.5.31.
- `storybook`: 10.6.3.
- `tailwindcss`: 3.4.19.
- `typescript`: 5.9.3.
- `typescript-eslint`: 8.72.0.
- `vite`: 8.3.5.
- `vitest`: 4.1.12.
- `vue-tsc`: 3.3.13.

**server/package.json**

- `@prisma/adapter-better-sqlite3`: 7.10.1.
- `@prisma/client`: 7.10.1.
- `cors`: 2.8.6.
- `dotenv`: 16.6.1.
- `express`: 4.22.3.
- `helmet`: 8.3.0.
- `ws`: 8.22.0.
- `zod`: 4.6.7.
- `@types/cors`: 2.8.19.
- `@types/express`: 4.17.25.
- `@types/node`: 22.20.5.
- `@types/supertest`: 6.0.3.
- `@types/ws`: 8.18.2.
- `dotenv-cli`: 8.0.0.
- `prisma`: 7.10.1.
- `supertest`: 7.3.1.
- `tsx`: 4.23.15.
- `typescript`: 5.9.3.
- `vitest`: 4.1.12.

**shared/package.json**

- `typescript`: 5.9.3.

### High-priority fixes and database compatibility

- Zod 4.6.7 is beyond the advisory’s 4.6.6 fixed boundary. Existing strict objects,
  field constraints and German route errors remain; new regression tests reject
  malformed fields/import rows and unsupported modes. The only request array is
  the player import; it remains subject to the existing 100 KiB decoded JSON
  body limit. No arbitrary new business row cap or removed validation is used
  as a substitute for upgrading the library. Source:
  [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- Prisma CLI/client/official SQLite adapter are 7.10.1. No deepmerge override or
  prerelease Prisma 8 is used. The native driver resolves to better-sqlite3
  12.11.1. The CLI/config/deepmerge vulnerable dependency chain is gone. The
  existing supported client-js generator is retained. URL configuration moved
  to Prisma Config; temporary schema application uses an explicit temporary
  config and absolute temporary URL, never an existing selected catalog. Sources:
  [Prisma upgrade](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7),
  [underlying deepmerge advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx).
- `dbClient.ts` supplies the adapter to both runtime and maintenance clients with
  `unixepoch-ms` DateTimes. Both CLI/runtime preserve old schema-relative paths
  for manual API sandboxes. Model/enum DDL, foreign keys and v1 backup format
  remain unchanged. `desktop/schema-identity.mjs` normalizes only the removed
  connection-setting line before hashing, preserving v1 fingerprint
  `1ef88f16376a0505a35a11ce2b254ddeef575792e402742f9f59055c801f3262`.
  Model/provider changes still change identity and startup/restore guards remain.
  A test-only SQL fixture from Prisma 6 verifies old DDL/backup restore, roster
  IDs, scores, timers, numeric timestamps and subsequent integer-format writes.
  Source: [SQLite timestamp compatibility](https://docs.prisma.io/docs/orm/v6/overview/databases/sqlite).
- Desktop preparation copies only actual runtime dependencies and rebuilds only
  the staged native driver for Electron. API tests retain the build-Node binary;
  desktop tests execute with Electron as Node against fresh temporary data.
  No Prisma CLI, native build or dependency download runs during packaged startup.
- XLSX is pinned to the official SheetJS 0.20.3 tarball, under Apache-2.0. It has
  no install/postinstall script. The lockfile URL and SHA-512 match the inspected
  upstream archive; `npm ci` reproduced the install. The license is included in
  packaged runtime notices. Real reader/writer tests cover both existing example
  files, header normalization, Unicode, incomplete rows, German errors and native
  export/import roundtrips. Append/reconcile ID/membership preservation continues
  through existing API tests and packaged host smoke. Sources:
  [official distribution](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/),
  [prototype pollution affected below 0.19.3](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6),
  [ReDoS affected below 0.20.2](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9).

SheetJS URL: `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`.
Lock integrity: `sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==`.
The upstream version/advisory comparison is needed because npm has no maintained
registry release for this package; audit absence alone is not proof of a repair.
This resolves the identified CVEs, not every conceivable parser/resource risk.

### Remaining security findings

The final full-workspace audit reports **0 critical, 0 high and 3 moderate**
affected package records. These are Tailwind 3, postcss-nested and the shared
postcss-selector-parser chain; they are not three independently proven attacks.
The high/critical policy now passes with no allowlist. No forced audit fix or
major parser override was used. Moderate CSS/Tailwind work remains explicitly
deferred; this result is not a claim of no vulnerabilities.

### Verification and preserved state

Passed: full workspace build, client lint, application Vue and separate Storybook
typechecks including server/shared; 54 server tests and 94 client/API/Storybook
tests through the isolated root runner; desktop preparation and 21 isolated desktop
storage/backup/legacy-compatibility tests;
native Mac arm64 app/ZIP build; all three packaged startup/LAN/shutdown, host
management/backup/restore and startup-error smoke scripts. The latter used fresh
temporary data folders, never the existing development or prototype catalog.

Storybook's static build and local manager/addon panels were checked separately.
The [Storybook guide](../tests/client/storybook/README.md#type-checks-and-version-compatibility)
explains Docs/Chromatic limits. Nonblocking warnings remain for future native Vite
config loading (extensionless config imports/dirname), Vue docgen deprecation and
large Storybook chunks. These were not hidden or treated as failed app tests.

The pre-fix source/runtime/release and data checksums are preserved in ignored
`.local/high-fixes-before-20261025-110507/`. Completion evidence is retained in
`.local/high-fix-validation-20261025/`. All 11 recorded existing database/settings
files match their pre-fix checksums. No existing data were reset, seeded, migrated
or restored over user changes.

The packaged app is unsigned/unnotarized; verification ran on macOS 27.0.1 arm64,
not on an actual macOS 13 device. Physical second-device, clean-machine offline
installation, Windows and signing remain outside this acceptance. App version
remains 0.2.0. No commits or pushes were made.

## Dependency review: 24 October 2026

The initial read-only assessment covered 50 unique direct registry packages and
found 32 affected audit records (7 critical, 19 high, 5 moderate, 1 low). It led
to the authorized update implemented above; it is not the current package list.
The prior source/report is preserved in the ignored update backup. Current exact
versions and remaining findings are recorded in the preceding section.

## Database command review

Electron remains the chosen architecture. Users load demo data, reset, back up
and restore through **Host-Verwaltung**. Its exchange stops/drains work and takes
a backup before replacement. No terminal DB command is needed for ordinary use.

After checking source, package scripts, desktop preparation, tests and CI:

- Kept `db:generate`: desktop prepare/pack/dist and production preparation need
  Prisma client generation. This changes generated code, not database contents.
- Kept internal direct Prisma schema application in `desktop/prepare.mjs` and
  `scripts/test-isolated.mjs`, restricted to newly created temporary databases.
  Those consumers never call the removed public wrappers. The interface does
  not implement schema upgrades.
- Kept `server/src/seed/demoSeed.ts`: both `server/src/desktopData.ts` and
  `tests/server/helpers/db.ts` use it. It is separate from the deleted CLI adapter.
- Removed root/server `db:deploy`, `db:seed`, `db:clear`, `db:clear:test`,
  `db:push:test`, plus server-only `db:seed:test`. Removed their sole-purpose
  `server/scripts/seed.ts`, `server/scripts/clearDb.ts` and Prisma seed config hook.
- Kept `db:push` only as an advanced, explicitly fresh API-sandbox schema tool.
  It is not an automatic update/migration operation. `db:studio` remains optional
  API/debug inspection tooling and can edit data. Neither is part of startup.
- Kept `.env.test` and `dev:test`: direct workspace launchers still reference
  that manual profile. Root tests override it with a fresh temporary DATABASE_URL
  and the isolation guard. Existing test/profile data were not deleted.

No removed command was needed by host reset or the isolated runners, and no
existing database was used to verify the removal.
