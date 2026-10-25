# Storybook and browser rendering tests

Stories render the current account-free components and views. They are not part
of the production renderer bundle and do not provide privileged host management.

From the repository root:

- `npm run storybook`: interactive component examples.
- `npm run build-storybook`: static Storybook build.
- `npm test`: isolated server/client/integration tests plus Storybook rendering
  tests in headless Chromium. See the [development guide](../../../doc/DEVELOPMENT.md).

`client/vitest.config.ts` adds the browser project when `STORYBOOK_TESTS=true` or
`VITEST_STORYBOOK=true`. `client/storybookVitestProject.ts` shares the project
configuration with `tests/client/vitest.config.ts`, which lets the Storybook addon
find its browser project. Workspace tests alone do not create the isolated API
database; use the root runner for the full suite.

## Preview and routing

[main.ts](main.ts) configures stories, addons and Vite aliases. Mock aliases must
precede the `@` alias to `client/src`; do not accidentally override them while
merging Vite configuration.

[preview.ts](preview.ts) installs Pinia, shared styles and a memory router for
catalog and nested tournament views. Use `parameters.route` for the initial path
or named route. The route decorator is synchronous; awaiting before rendering
`story()` breaks the Vue canvas setup.

[StorybookRouterCanvas.vue](StorybookRouterCanvas.vue) supplies a single router
outlet for nested view stories. Use it when rendering a tournament layout through
the router, rather than mounting parent/child layouts twice.

## Fixtures and mocks

- [stories/fixtures/](stories/fixtures/) contains match, roster and tournament-detail
  data shared by stories and composable mocks. Keep IDs aligned with route IDs.
- [mocks/](mocks/) supplies dashboard, class/player lists, tournament lists/layout
  and a stubbed tournament-source list for roster transfer. Avoid real API/WS
  calls in stories that use static state.
- Keep fixtures aligned with shared DTOs: firstName/lastName, optional schoolClass
  and no account/creator/scope fields.
- Name the primary CSF export `Default` when reasonable for stable story URLs.
- Preview adds canvas padding and non-inline docs rendering. Preserve existing
  accessible labels, modal focus behavior and responsive examples.

`stories/components/` contains reusable UI examples; `stories/views/` holds catalog
and nested tournament-view examples. Fixtures include `matchStoryHelpers.ts`,
`rosterStoryHelpers.ts` and `tournamentDetailStory.ts`. Use relative fixture imports
and keep route IDs consistent. See the [contributor guide](../../../AGENTS.md).

## Type checks and version compatibility

Run `npx vue-tsc --noEmit -p tests/client/storybook/tsconfig.json` from the root
in addition to the client application typecheck. Story-control setters/resetters
are imported relatively from their mock files; importing them from a production
composable alias works at runtime through Vite but hides their types from TypeScript.

On 24 October 2026 the Storybook typecheck and 91 isolated client/API/story tests
passed after stale creator props, name fields and obsolete imports were removed.
Those were local fixture/type issues, not evidence that a package upgrade was required.

The installed Storybook/core/Vue framework/a11y/docs/vitest packages are 10.6.3,
Chromatic is 5.6.0, and client/server Vitest plus browser/coverage/provider packages
are aligned on 4.1.12. `client/storybookVitestProject.ts` uses the factory from
`@vitest/browser-playwright`; the obsolete triple-reference provider shim was
removed. The browser package remains explicitly aligned because the addon and
coverage package declare its peer relationship.

Vitest 4 no longer clears factory mock history through `vi.restoreAllMocks()`.
The XLSX export tests now explicitly clear mock calls between cases; assertions
for download fallback, successful native save and cancellation remain intact.
See the [Vitest migration guide](https://v4.vitest.dev/guide/migration).

The [maintainer advisory](https://github.com/storybookjs/storybook/security/advisories/GHSA-f2ph-cmg5-wxc8)
explains the patched dev-server origin/iframe behavior and Chromatic highlight
API change. No insecure compatibility flags were enabled. Version 11 alpha is
not used. The existing Vue docgen deprecation warning concerns the next major
and is not suppressed with an experimental migration in this update.

Verification: 91 client/API/Storybook tests and the dedicated Storybook typecheck
passed. A static build completed in a separate temporary directory. The local
loopback dev manager rendered a story and loaded addon panels without page errors.
One sample story completed its real accessibility scan with 8 passes and no
violations; this is not a full UI accessibility acceptance. Chromatic cloud
execution was not performed; its login/setup state is expected.
No automatic Docs entries are configured in the current story index, so the Docs
addon was checked through its successful static bundle, not a claimed Docs-page
acceptance. The existing Docs-view accessibility no-op workaround is not counted
as an accessibility audit; story rendering tests still use the real story-mode
addon. Full findings and acceptance limits are in the
[implemented update](../../../doc/DEVELOPMENT.md#implemented-dependency-update-25-october-2026).
