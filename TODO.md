# TODO — Turniersystem Refactoring

Alle Punkte sind implementiert.

## Umbenennungen (Frontend-Anzeige deutsch, Code englisch)
- [x] Vorrundenspiele → Gruppenspiele
- [x] Kader → Mannschaften

## Turnier-Anlage (defineMatch-Wizard)
- [x] Start mit Gruppenspiele / Direkter Start mit K.O.
- [x] Jeder gegen Jeden
- [x] Mannschaften sind Einzelpersonen (z. B. Badminton)

## Turniermodi
- [x] Klassische Gruppenspiele (GROUP_KO) — Gruppen → Viertel-/Halb-/Finale
- [x] Direkt mit K.O. (DIRECT_KO) — auch mit 10+ Mannschaften, Freilose
- [x] Jeder gegen Jeden (ROUND_ROBIN) — alle in einer Gruppe, kein K.O.
- [x] Mannschaften können Einzelpersonen sein (`teamsAreIndividuals`)

## Phasen und Struktur
- [x] Turnier in Phasen unterteilt: Gruppen / Jeder-gegen-Jeden → K.O.-Phase
- [x] K.O.-Phase: Mannschaften einzeln (Gruppe hat keine Bedeutung mehr)
- [x] Achtelfinale (ROUND_OF_16) für große Turniere

## Parallelität
- [x] Jeder-gegen-Jeden / Gruppenspiele nach Parallelität sortiert (Spielrunden)

## Spielbetrieb
- [x] Alle Spiele auf einmal löschbar (Gefahrenzone, DELETE /api/tournaments/:id/matches)
- [x] Gruppenanzahl in „1. Gruppenspiele“ direkt neben „Gruppenspiele erzeugen“
- [x] „Weiterkommen pro Gruppe“ separat speicherbar („Einstellungen speichern“)
- [x] Mannschaften ohne Spieler bei Gruppengenerierung ignorieren

## Seed-Daten
- [x] Drei Demo-Turniere (GROUP_KO, DIRECT_KO, ROUND_ROBIN)
- [x] 12 Spieler, Demo-Schulklassen

## Tests & Infrastruktur
- [x] Vitest für Server (Unit + Integration gegen Test-DB)
- [x] Vitest für Client (Unit + client-API Integration)
- [x] Tests zentral unter `tests/` (server/client) organisiert
- [x] Seed-Fixtures in wiederverwendbares Modul ausgelagert (`server/src/seed/demoSeed.ts`)
- [x] Client-TSConfig aufgeräumt (`tsconfig.base.json`), `*.tsbuildinfo` aus Git entfernt/ignoriert
- [x] Client-Integrationstests beschleunigt (minimales Test-Seeding pro Test statt vollständigem Demo-Seed)

## UX-Verbesserungen
- [x] Gruppennamen im Kader umbenennbar
- [x] Mannschaftsnamen im Kader umbenennbar
