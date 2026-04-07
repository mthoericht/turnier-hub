# Storybook-Stories (`stories/`)

- **Inhalt:** CSF-Stories für Views und Komponenten; laufen nur in Storybook / Vitest-Browser-Tests, **nicht** im Produktions-Client-Bundle.
- **Konfiguration:** [`../main.ts`](../main.ts), [`../preview.ts`](../preview.ts).
- **Ausführliche Doku** (Fixtures, Mocks, Router, A11y, Vitest): [`../README.md`](../README.md).

## Ordner

| Ordner | Zweck |
| ------ | ----- |
| `components/` | UI-Komponenten-Stories |
| `views/` | Seiten-Stories (z. B. Dashboard, Login); Turnier-Views unter `views/tournament/` |
| `fixtures/` | Statische Demo-Daten und Builder (siehe unten) |

## Fixtures (`fixtures/`)

Wiederverwendbare, typisierte Beispieldaten für Stories:

| Datei | Inhalt |
| ----- | ------ |
| `matchStoryHelpers.ts` | z. B. `baseScheduledMatch`, Hilfsfunktionen für Match-Card-Stories |
| `rosterStoryHelpers.ts` | Demo-Spieler, Demo-Teams (`demoPlayers`, `demoTeamWithMembers`, …) |
| `tournamentDetailStory.ts` | `buildDemoTournamentDetail()`, Szenario-IDs (`storyTournamentId`, `storyTournamentIndividualsId`, `storyTournamentDirectKoId`), `getTournamentStoryScenario()` für den Turnier-Layout-Mock |

Stories importieren Fixtures per relativen Pfad, z. B. `../../fixtures/tournamentDetailStory`.

## Mocks

Liegen in [`../mocks/`](../mocks/) und werden in [`../main.ts`](../main.ts) per Vite-Alias eingebunden — siehe Haupt-README.
