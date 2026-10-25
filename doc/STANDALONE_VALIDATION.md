# Standalone validation record

Recorded on 23 October 2026 for prototype 0.2.0, macOS Apple Silicon (arm64).
This section records the existing implementation checks; the later structural
checks are listed separately below.
The initial documentation-only review on 24 October checked source statements and references;
it did not build, seed, migrate or reset databases, or rerun application tests.

## Verified implementation checkpoint

In the main checkout:

- `npm run dev` invoked `desktop:dev` and opened the native account-free dashboard
  on port 3220 with host management and isolated `.local/desktop-dev/` data.
- `desktop:pack:mac` and `desktop:dist:mac` rebuilt the app successfully. The actual
  resulting app opened its dashboard and host management on default port 3210.
- Full workspace build, client lint and Vue typecheck passed.
- 51 server tests, 91 client/integration/Storybook tests and 19 desktop tests passed.
  Database tests used fresh temporary data, not existing development data.
- Existing development/test database and legacy prototype database/settings
  checksums were preserved during integration. Existing source changes were
  backed up before integration; no commits or pushes were made by the agent.

Packaged-app checks covered:

- Explicit seed into an empty catalog and refusal of a nonempty catalog.
- Export/restore/reset, cancellation, invalid-backup rejection and automatic
  backups before exchanges. Native file-picker selections and confirmation
  answers were automated within the isolated test.
- Backup roundtrip preserving tournament modes, rosters, scores and timer fields;
  invalid references/schema/checksums, WAL snapshots and interrupted replacement.
- Privileged IPC caller checks and constructed LAN admin requests being refused.
- Same-host LAN HTTP/WebSocket access, live catalog notifications, single-instance
  handoff, responsive layouts, bundled fonts, shutdown and restart persistence.
- Occupied port, missing database, corrupt settings and corrupt database producing
  visible startup errors without resetting existing files.

Relevant coverage lives in [desktop tests](../tests/desktop/),
[host smoke](../desktop/maintenance-smoke.mjs), [general smoke](../desktop/smoke.mjs),
[startup-error smoke](../desktop/error-smoke.mjs), [server tests](../tests/server/)
and [client tests](../tests/client/).

## Limits of this evidence

The user confirmed an early physical second-device LAN/live-update test for the
older prototype. That does not accept the new account-free host-management flow
on a second device. Same-host interface checks are not a substitute.

Outstanding acceptance and implementation limits:

- Confirm supported OS versions/devices. Verify clean-machine offline installation
  without development tools and core use without LAN/internet and with an empty cache.
- Accept multi-device catalog/roster/XLSX operations, all tournament modes, scores,
  timers, reconnect, sleep, address changes and firewall/guest-network behavior.
  Concurrent-save conflict rules remain undecided; no conflict-resolution guarantee.
- Verify operating-system restart and app-update persistence, permissions, disk-full
  failures and power-loss recovery. Existing rollback tests are not exhaustive fault
  injection. Keep test data separate from real/development/prototype data.
- Schema migrations and recovery UI available when normal startup fails are not
  implemented. Restore needs a running compatible host and the exact current schema.
  Legacy account-data migration is outside the agreed scope.
- Windows, native installer/engine/script portability, cross-platform restore,
  signing/notarization and a manual offline-update/release strategy remain open.
  An optional future online updater must not become a startup requirement.
- Larger dependency migrations remain outstanding. The implemented update and
  remaining audit findings are recorded in the
  [current dependency review](DEVELOPMENT.md#implemented-dependency-update-25-october-2026).

Current operation, backup limits and local access boundaries are in the
[desktop guide](../desktop/README.md). These limitations prevent the recorded
Mac prototype checks from being treated as full cross-platform release acceptance.

## Structural checks on 24 October 2026

The cleanup removed obsolete scripts/config duplication, stale Storybook auth
aliases/routes and account-era fixture props. Root `test:client` now uses the
isolated database runner; manual database commands were not executed. The shared
build now uses its equivalent canonical tsconfig directly.

Passed: client lint, application Vue typecheck, separate Storybook Vue typecheck,
51 server tests and 91 client/integration/Storybook tests. The isolated client-only
runner also passed its 91 tests. Existing runtime data and packaged output were
not reset, seeded or rebuilt. Desktop tests, packaging and physical-device
acceptance were not repeated for this structural cleanup.

A read-only npm dependency/security review was performed; no upgrades, installs,
lockfile rewrites or audit fixes were applied. Passing functional tests do not
resolve its findings. See the [dated review](DEVELOPMENT.md#dependency-review-24-october-2026).

## First dependency update checkpoint: 25 October 2026

The authorized Electron/frontend/tooling updates and removal of redundant manual
DB commands are complete. Full versions and remaining findings are in the
[implemented dependency update](DEVELOPMENT.md#implemented-dependency-update-25-october-2026).

Already completed on 24 October after the update: workspace build, client lint,
app/Storybook Vue typechecks, 51 server + 91 client/API/Storybook tests, desktop
prepare + 19 desktop tests, native Mac arm64 distribution build, and separate
static Storybook build. The export mock-history issue under Vitest 4 was corrected
without removing success/cancellation/fallback assertions; all suites passed.
Those expensive checks were not repeated merely because work resumed the next day.

Completed against the resulting packaged executable on 25 October:

- General smoke on test port 3214: empty first start, single instance, old login
  route redirect, class writes/reads, loopback and same-host LAN HTTP/WebSocket,
  bundled fonts, responsive widths, shutdown and restart persistence. No external
  renderer resource requests were needed.
- Host smoke on 3213: host panel, local-only privileges, explicit empty-catalog
  demo seed/nonempty refusal, export/restore/reset cancellation and confirmation,
  automatic backups, invalid restore refusal, forbidden LAN administration/reset
  and reconciliation preserving player IDs and tournament counts.
- Error smoke on 3212: occupied port, missing database, corrupt settings and
  corrupt database all show errors and close cleanly without replacing test files.
- Local Storybook manager/preview and addon panels load without page errors.
  No Chromatic cloud publication or automated Docs-page acceptance is claimed.

Smoke screenshots remain in temporary output. Completion logs, audit/tree and
summary evidence are retained in ignored `.local/update-validation-20261025/`;
prior release/source/output
was retained in `.local/updates-before-20261024-150652/`. All smoke operations used
fresh temporary data. Seven existing pre-update data hashes match; the development
DB differs from the older baseline (mtime 24 October 15:15), so it was preserved
as found rather than replaced. No existing data were reset or migrated.

The app Info.plist minimum is macOS **13.0.0 Ventura**, embedded Electron is
44.9.3, and the executable is arm64. Actual execution was on macOS 27.0.1; the
minimum-version device, clean-machine offline installation, physical second LAN
device, Windows, signing/notarization and power-loss acceptance remain unverified.

At that first checkpoint, the audit had 8 package records (0 critical, 5 high, 3 moderate). The existing audit
policy still fails on Prisma/config/deepmerge and Zod; XLSX remains its sole
configured high-severity exception. The high-priority follow-up below supersedes
that security status.

## High-priority security fixes: 25 October 2026

Zod 4.6.7, Prisma CLI/client/SQLite adapter 7.10.1 and official Apache-2.0 SheetJS
0.20.3 are implemented. The SheetJS lock integrity matches the official tarball;
the old audit exception is removed. Final audit: 0 critical, 0 high, 3 moderate
CSS/Tailwind package records. The high/critical audit policy passes with no
allowlist; tarball coverage limits and upstream CVE evidence are documented in
the [development guide](DEVELOPMENT.md#high-priority-fixes-and-database-compatibility).

Passed after a clean lockfile install: build, lint, App/Storybook/Server/Shared
typechecks, 54 server and 94 client/API/Storybook tests, desktop preparation and
21 desktop tests. New coverage retains valid/invalid input behavior, real XLSX
roundtrips, old Prisma 6 SQLite DDL/v1 backup compatibility, roster IDs, scores,
timers and integer-millisecond timestamp writes. All data were freshly temporary.

Native Mac arm64 app/ZIP packaging and all three packaged smokes pass: isolated
startup/LAN/WS/shutdown/restart, local host backup/restore/reset and privilege
boundaries, and occupied-port/missing/corrupt-file failures. The SheetJS license
is included in the package. The minimum remains macOS 13 Ventura; actual host
execution was macOS 27.0.1 arm64. Windows, physical second-device, clean-machine
offline install, signing/notarization and exhaustive fault injection are not
newly accepted.

The datasource URL moved to Prisma Config; persisted models/SQLite DDL are
unchanged. Fingerprinting normalizes only the removed connection URL, retaining
the old v1 identity while rejecting model/provider changes. The adapter retains
Prisma 6’s `unixepoch-ms` DateTimes. No automatic data/schema migration occurred.
All 11 recorded existing database/settings files retain pre-fix checksums.
Previous runtime/release output and source are in
`.local/high-fixes-before-20261025-110507/`; reports are in
`.local/high-fix-validation-20261025/`. No commits or pushes were made.
