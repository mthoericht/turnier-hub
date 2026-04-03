# Storybook-Tests (Rendering) via Vitest

Dieses Verzeichnis enthält Storybook-Konfiguration und -Stories, die über den Vitest-Addon `@storybook/addon-vitest` als “Render/Visual”-Tests ausgeführt werden.

## Wie werden die Tests ausgeführt?

1. `client/vitest.config.ts` lädt das Storybook-Vitest-Project, wenn **`STORYBOOK_TESTS === "true"`** (npm-Testlauf) oder **`VITEST_STORYBOOK === "true"`** (Child-Prozess von `@storybook/addon-vitest` in der Storybook-UI). Fehlt das Project, meldet Vitest `No projects matched the filter "storybook:…"`.
2. Dieses Project nutzt `storybookTest(...)` mit `configDir: tests/client/storybook` und Playwright (headless, `chromium`).
3. Der `client`-Testlauf startet standardmäßig mit `STORYBOOK_TESTS=true` (siehe `client/package.json`), d.h. `npm run test -w client` führt die Storybook-Tests automatisch mit aus.

## Konfiguration

- `tests/client/vitest.config.ts`: schlanke Vitest-Config **nur für das Storybook-Project** — `@storybook/addon-vitest` sucht `vitest.config.*` ausgehend von `tests/client/` nach oben und findet `client/vitest.config.ts` dort nicht. Die gemeinsame Projekt-Definition liegt in `client/storybookVitestProject.ts`.
- `tests/client/storybook/main.ts`: Storybook-Config (Storie-Glob, Addons, Vite-`viteFinal`).
- `tests/client/storybook/preview.ts`:
  - klassisches `Preview` + `setup` aus `@storybook/vue3-vite`
  - erstellt einen kleinen `vue-router`-Stub, damit `RouterLink`/benannte Routen aus den Stories auflösbar sind
  - relevant ist z.B. die Route `tournament-roster` unter `/tournaments/:id/roster` (sonst scheitert die `HomeView`-Story)
- `tests/client/storybook/mocks/`: Storybook-Mocks für Composables (z.B. Dashboard-State).

## Barrierefreiheit (Accessibility)

- **Panel bleibt bei „scan in progress“:** Der Preview führt den automatischen axe-Lauf nur im **Canvas** (`viewMode === "story"`) aus, nicht auf der **Docs**-Seite. Das Manager-Panel springt trotzdem auf „running“ und wartet auf einen Report — ohne Workaround hängt die Anzeige in der Docs-Ansicht. In `preview.ts` gibt es dafür `afterEachA11yDocsWorkaround` (Dummy-Report außerhalb Canvas); echte Ergebnisse siehst du in der **Story-Ansicht** (Tab „Canvas“, URL `path=/story/...`).
- **Addon:** `@storybook/addon-a11y` ist in `main.ts` registriert (basiert auf [axe-core](https://github.com/dequelabs/axe-core)).
- **Storybook-UI:** Beim Durchklicken der Stories erscheint das **Accessibility**-Panel (Violations / Passes / Incomplete). In der Toolbar gibt es zudem **Sehschwäche-Simulationen** (Vision-Filter).
- **Vitest + Playwright:** Zusammen mit `@storybook/addon-vitest` laufen dieselben Checks automatisch im Browser-Testlauf. Das Verhalten steuert `parameters.a11y.test` in `preview.ts`:
  - `'error'` — Verstöße **brechen** `npm run test -w client` (aktuell gesetzt; alle bestehenden Stories sind damit grün).
  - `'todo'` — Verstöße nur als **Warnung** in der Storybook-Test-Oberfläche; CI schlägt nicht fehl (sinnvoll für schrittweise Aufräumarbeiten).
  - `'off'` — keine automatischen A11y-Tests für diese Story / global (z. B. absichtliche Antipattern-Demos).

Pro Story oder pro Datei kann man das überschreiben, z. B. `parameters: { a11y: { test: 'todo' } }` an einer einzelnen Story. Weitere Optionen (`context`, `config`, `options` für axe) siehe [Accessibility tests – Storybook-Dokumentation](https://storybook.js.org/docs/writing-tests/accessibility-testing).

## Test-Runner / Chromatic

**Chromatic** und **@storybook/addon-vitest** sind getrennt: Wenn Chromatic meldet, dass der Build und die Snapshots fertig sind, ist damit nur der **visuelle** Chromatic-Lauf gemeint. Das **Vitest-Addon** startet danach (oder parallel) einen **eigenen** Node-Prozess mit Vitest + Playwright; der meldet sich erst mit `ready`, wenn dieser Stack oben ist.

- Storybook bricht den Boot-Versuch nach **30s** ab, wenn kein `ready` kommt (Upstream-Verhalten). Wenn das bei dir auftritt, z. B. unter hoher Last: Vitest-Addon weglassen mit **`STORYBOOK_DISABLE_VITEST_ADDON=1`** (CLI-Tests weiter über `npm run test -w client`), oder ein **`patch-package`**-Timeout-Patch auf `@storybook/addon-vitest` wieder einführen.

## Noise-Filter (Vue Compiler Warning)

Beim Story-Rendering kann Vue in non-browser Builds eine Warnung ausgeben:
`decodeEntities option is passed but will be ignored in non-browser builds.`

Diese Warnung wird in `client/vitest.setup.ts` per `console.warn`/`console.error`-Filter unterdrückt, damit CI-Logs nicht unnötig verschmutzt werden.

