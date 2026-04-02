# Storybook-Tests (Rendering) via Vitest

Dieses Verzeichnis enthält Storybook-Konfiguration und -Stories, die über den Vitest-Addon `@storybook/addon-vitest` als “Render/Visual”-Tests ausgeführt werden.

## Wie werden die Tests ausgeführt?

1. `client/vitest.config.ts` prüft `process.env.STORYBOOK_TESTS`.
2. Wenn `STORYBOOK_TESTS === "true"`, wird ein zusätzliches Vitest-Project konfiguriert:
   - Plugin: `storybookTest(...)` mit `configDir: tests/client/storybook`
   - Browser: Playwright (headless, `chromium`)
3. Der `client`-Testlauf startet standardmäßig mit `STORYBOOK_TESTS=true` (siehe `client/package.json`), d.h. `npm run test -w client` führt die Storybook-Tests automatisch mit aus.

## Konfiguration

- `tests/client/storybook/main.ts`: Storybook-Config (Storie-Glob, Addons, Vite-`viteFinal`).
- `tests/client/storybook/preview.ts`:
  - erstellt einen kleinen `vue-router`-Stub, damit `RouterLink`/benannte Routen aus den Stories auflösbar sind
  - relevant ist z.B. die Route `tournament-roster` unter `/tournaments/:id/roster` (sonst scheitert die `HomeView`-Story)
- `tests/client/storybook/mocks/`: Storybook-Mocks für Composables (z.B. Dashboard-State).

## Noise-Filter (Vue Compiler Warning)

Beim Story-Rendering kann Vue in non-browser Builds eine Warnung ausgeben:
`decodeEntities option is passed but will be ignored in non-browser builds.`

Diese Warnung wird in `client/vitest.setup.ts` per `console.warn`/`console.error`-Filter unterdrückt, damit CI-Logs nicht unnötig verschmutzt werden.

