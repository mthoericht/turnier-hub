# Turnierlogik — Technische Dokumentation

Dieses Dokument beschreibt die interne Turnierlogik von Turnier-Hub: Turniermodi, Phasenablauf, K.O.-Bracket-Erzeugung, Freilose, Tabellen, Tie-Break-Verfahren und Siegerermittlung.

---

## Inhaltsverzeichnis

1. [Turniermodi](#1-turniermodi)
2. [Phasenablauf (Phase Flow)](#2-phasenablauf-phase-flow)
3. [Gruppenphase und Tabelle](#3-gruppenphase-und-tabelle)
4. [Qualifikation für die K.O.-Phase](#4-qualifikation-für-die-ko-phase)
5. [Tie-Break bei Punktgleichheit](#5-tie-break-bei-punktgleichheit)
6. [K.O.-Bracket-Erzeugung](#6-ko-bracket-erzeugung)
7. [Freilose (Byes)](#7-freilose-byes)
8. [Siegerermittlung im K.O.](#8-siegerermittlung-im-ko)
9. [Weiterschalten der Phasen (Advance)](#9-weiterschalten-der-phasen-advance)
10. [Spielplan-Erzeugung (Round-Robin)](#10-spielplan-erzeugung-round-robin)
11. [Match-Timer (Stoppuhr)](#11-match-timer-stoppuhr)
12. [Automatischer Abschluss](#12-automatischer-abschluss)
13. [Datenkonsistenz und Transaktionen](#13-datenkonsistenz-und-transaktionen)
14. [Relevante Dateien](#14-relevante-dateien)

---

## 1. Turniermodi

Es gibt drei Modi (`TournamentMode`):

| Modus | Beschreibung |
|-------|-------------|
| `GROUP_KO` | Gruppenphase → K.O.-Runden (Achtelfinale, Viertelfinale, Halbfinale, Finale) |
| `DIRECT_KO` | Nur K.O.-Runden, kein Gruppenstadium. Unterstützt beliebige Teamanzahlen (≥ 2) mit automatischen Freilosen. |
| `ROUND_ROBIN` | Jeder gegen Jeden. Keine K.O.-Phase. |

Zusätzlich gibt es das Flag `teamsAreIndividuals` — wenn aktiv, wird jeder Spieler direkt als eigenes Team behandelt (z. B. Badminton-Einzel).

---

## 2. Phasenablauf (Phase Flow)

Jedes Turnier hat eine aktuelle Phase (`TournamentPhase`):

```
GROUP → ROUND_OF_16 → QUARTER → SEMI → FINAL → COMPLETED
```

**Je nach Modus werden Phasen übersprungen:**

- **GROUP_KO:** Startet in `GROUP`. Je nach Teilnehmerzahl geht es nach der Gruppenphase direkt ins Viertelfinale, Halbfinale oder Finale (nicht alle K.O.-Phasen müssen durchlaufen werden).
- **DIRECT_KO:** Startet direkt in der passenden K.O.-Phase (`QUARTER`, `SEMI` oder `FINAL`), bestimmt durch die Teamanzahl.
- **ROUND_ROBIN:** Nutzt nur `GROUP` → `COMPLETED`.

### Phasenzuordnung nach Teamanzahl (K.O.)

| Teams | Bracket-Größe (nächste 2er-Potenz) | Startphase |
|-------|-------------------------------------|-----------|
| 2     | 2                                   | `FINAL`   |
| 3–4   | 4                                   | `SEMI`    |
| 5–8   | 8                                   | `QUARTER` |
| 9–16  | 16                                  | `ROUND_OF_16` |

→ Datei: `server/src/services/knockoutBracket.ts` → `koPhaseForBracketSize()`

---

## 3. Gruppenphase und Tabelle

### Punktevergabe

| Ergebnis | Punkte |
|----------|--------|
| Sieg     | 3      |
| Unentschieden | 1 |
| Niederlage | 0    |

### Tabellenberechnung

Nur Spiele mit **beiden** gespeicherten Torzahlen (`homeScore` und `awayScore`) und Status ≠ `CANCELLED` werden gewertet.

### Sortierung (Rangfolge)

1. **Punkte** (absteigend)
2. **Tordifferenz** (absteigend)
3. **Erzielte Tore** (absteigend)
4. **Teamname** (alphabetisch, als letztes Kriterium)

> Es gibt kein direktes Vergleichs-Tiebreak (Head-to-Head). Die Sortierung basiert rein auf den globalen Werten.

### Mehrere Gruppen

Bei `groupCount > 1` werden die Teams zufällig auf die Gruppen verteilt (Labels: A, B, C, …). Jede Gruppe berechnet eine eigene Tabelle.

→ Datei: `server/src/services/standings.ts` → `computePoolStandings()`

---

## 4. Qualifikation für die K.O.-Phase

Beim Weiterschalten von der Gruppenphase in eine K.O.-Runde werden die Qualifikanten aus den Gruppentabellen ermittelt:

**Einzelgruppe:**
- Die besten `advancesPerGroup` Teams qualifizieren sich.

**Mehrere Gruppen:**
- Pro Gruppe qualifizieren sich die besten `advancesPerGroup` Teams.
- Die Qualifikanten aller Gruppen werden zusammengeführt.

**Maximale Teilnehmerzahl:**
- Für die Zielphase wird eine Maximalzahl erwartet:

| Zielphase | Maximale Qualifikanten |
|-----------|----------------------|
| `ROUND_OF_16` | 16 |
| `QUARTER` | 8 |
| `SEMI` | 4 |
| `FINAL` | 2 |

Gibt es mehr Qualifikanten als Plätze, werden die überzähligen abgeschnitten. Gibt es weniger, wird mit Freilosen aufgefüllt (siehe [Abschnitt 7](#7-freilose-byes)).

→ Datei: `server/src/services/advancePhase.ts` → `collectGroupQualifiers()`

---

## 5. Tie-Break bei Punktgleichheit

Wenn an der Qualifikationsgrenze mehrere Teams **exakt gleich viele Punkte** haben, greift ein **deterministisch-zufälliges Auswahlverfahren**:

### Ablauf

1. Die Tabelle wird nach den Standardkriterien (Punkte, Tordifferenz, Tore, Name) sortiert.
2. Es wird geprüft, ob an der Grenzposition (letzter Qualifikationsplatz) eine Punktgleichheit vorliegt.
3. Zunächst greifen weiterhin die **normalen Sortierkriterien** (Punkte, Tordifferenz, Tore). Nur wenn mehrere Teams **nach diesen Kriterien vollständig gleichauf** sind (gleiche Punkte, gleiche Tordifferenz, gleiche erzielten Tore), bilden sie einen Tie-Cluster.
4. Liegt ein solcher vollständig gleicher Tie-Cluster über der Qualifikationsgrenze und es gibt darin **mehr Teams als freie Plätze**, wird innerhalb dieses Clusters gelost:
   - Ein **deterministischer Pseudo-Zufallsgenerator** (Mulberry32-PRNG, geseedet mit Turnier-ID + Gruppenlabel + Punktzahl + Tordifferenz + Toranzahl) mischt diesen Cluster.
   - Die benötigte Anzahl Teams wird aus der gemischten Teilmenge gewählt.
5. Alle Teams **vor** diesem vollständig gleichen Cluster bleiben unverändert gemäß der Tabellenreihenfolge qualifiziert.
6. Ein **Toast-Hinweis** wird dem Benutzer angezeigt, welche Teams per Losverfahren ausgewählt wurden.

### Konkretes Beispiel

Angenommen, es gibt eine Gruppe A mit folgender sortierter Abschlusstabelle (inkl. Torverhältnis) und es sollen **3 Teams** weiterkommen:

- 1. Team Alpha – 10 Punkte, +6 Tore (10:4)  
- 2. Team Bravo – 9 Punkte, +4 Tore (8:4)  
- 3. Team Charlie – 9 Punkte, +2 Tore (7:5)  
- 4. Team Delta – 9 Punkte,  0 Tore (5:5)  
- 5. Team Echo – 5 Punkte,  -3 Tore (4:7)  

Hier liegt die **Qualifikationsgrenze** zwischen Platz 3 und 4:

- Platz 1 (Alpha) ist eindeutig gesetzt.  
- Alle Teams mit 9 Punkten werden **zunächst** durch Tordifferenz/Tore auseinandergezogen:  
  - Bravo vor Charlie vor Delta.  

Da sich die Teams mit 9 Punkten **nicht vollständig gleichen**, gibt es **keinen Tie-Cluster** – es wird **nicht gelost**, sondern einfach die besten drei Teams nach Tabelle genommen:

- Qualifiziert: **Alpha, Bravo, Charlie**.  
- Delta und Echo sind nicht qualifiziert.

Nur wenn ein Beispiel so aussieht:

- 1. Team Alpha – 10 Punkte, +6 Tore (10:4)  
- 2. Team Bravo – 9 Punkte, +3 Tore (7:4)  
- 3. Team Charlie – 9 Punkte, +2 Tore (6:4)  
- 4. Team Delta – 9 Punkte, +2 Tore (6:4)  
- 5. Team Echo – 5 Punkte,  -3 Tore (4:7)  

Dann sind Charlie und Delta **vollständig gleichauf** (gleiche Punkte, gleiche Tordifferenz, gleiche erzielte Tore) und bilden einen Tie-Cluster:

1. Alpha und Bravo sind gesetzt (Punkte/Tordifferenz).  
2. Zwischen Charlie und Delta ist **genau ein Platz frei**.  
3. Nur für Charlie/Delta wird der deterministische PRNG verwendet, um zu entscheiden, wer den letzten Platz erhält.  
4. Der Hinweis-Text nennt explizit das per Losverfahren ausgewählte Team (z. B. „Gruppe A: … (Charlie)“).

### Warum deterministisch?

Der Seed ist stabil (basiert auf Turnier-ID und Gruppeninformationen). Dadurch liefert dasselbe Turnier bei denselben Ergebnissen **immer dieselbe Auswahl** — auch bei mehrfachem Aufrufen. Erst wenn sich Ergebnisse ändern (und damit ggf. die Tie-Situation), ändert sich die Auswahl.

→ Datei: `server/src/services/advancePhase.ts` → `pickQualifiersWithRandomPointsTie()`

---

## 6. K.O.-Bracket-Erzeugung

### Grundprinzip

1. Die Teams werden **zufällig gemischt** (Fisher-Yates-Shuffle mit `Math.random()`).
2. Die Teamanzahl wird auf die **nächste Zweierpotenz** aufgerundet (z. B. 5 → 8, 6 → 8, 3 → 4).
3. Teams werden in Slots eingetragen; leere Slots = Freilos.
4. Paarungen werden nach dem **Top-vs-Bottom-Prinzip** gebildet: Slot 0 gegen letzten Slot, Slot 1 gegen vorletzten, usw.

### Beispiel: 5 Teams

```
Bracket-Größe: 8 (nächste 2er-Potenz)
Slots:  [T1] [T2] [T3] [T4] [T5] [—] [—] [—]

Paarungen (Top vs. Bottom):
  Spiel 0: T1 vs —   (Freilos → T1 kommt weiter)
  Spiel 1: T2 vs —   (Freilos → T2 kommt weiter)
  Spiel 2: T3 vs —   (Freilos → T3 kommt weiter)
  Spiel 3: T4 vs T5  (echtes Spiel)
```

### Zwei Erzeugungswege

| Weg | Verwendet für | Funktion |
|-----|--------------|----------|
| `generateKoBracketFirstRound()` | Direct-KO: erstes Erzeugen des Brackets | `knockoutBracket.ts` |
| `generatePairingsWithByes()` | Advance: Qualifikanten oder Vorrundensieger → nächste K.O.-Runde | `knockoutBracket.ts` |

Beide verwenden die gleiche Bye-fähige Logik (Auffüllen auf 2er-Potenz).

→ Datei: `server/src/services/knockoutBracket.ts`

---

## 7. Freilose (Byes)

Ein **Freilos** entsteht, wenn die Teamanzahl keine Zweierpotenz ist.

**Technische Umsetzung:**
- `awayTeamId = null`
- Status: `FINISHED` (sofort als beendet markiert)
- Das Heimteam kommt automatisch in die nächste Runde

**Im UI:** Freilos-Spiele werden als „Freilos" angezeigt (statt `—` für das fehlende Gastteam).

**Beim Weiterschalten:** Die Funktion `collectWinnersFromPreviousPhase()` erkennt Bye-Matches am fehlenden `awayTeamId` und übernimmt das Heimteam automatisch als Sieger.

---

## 8. Siegerermittlung im K.O.

### Regeln

- Sieger werden **ausschließlich** aus den **gespeicherten** Torzahlen ermittelt (`homeScore` / `awayScore`).
- **„Spiel beenden"** (Timer-End) markiert das Spiel als `FINISHED`, setzt aber **keine** Scores — die müssen vorher oder nachher manuell eingetragen und gespeichert werden.
- **Unentschieden sind im K.O. nicht erlaubt.** Beim Versuch weiterzuschalten wirft der Server einen Fehler mit dem Hinweis, ein eindeutiges Ergebnis einzutragen (z. B. nach Verlängerung/Elfmeterschießen).
- Beide Scores müssen vorhanden sein. Fehlt einer, wird ein Fehler geworfen.

### Funktion

```
requireKnockoutWinnerTeamId(match, roundLabel)
  → homeScore == null || awayScore == null  → Fehler: "Es fehlen gespeicherte Torzahlen"
  → homeScore == awayScore                  → Fehler: "Unentschieden — eindeutiger Sieger benötigt"
  → homeScore > awayScore                   → Heimteam gewinnt
  → awayScore > homeScore                   → Gastteam gewinnt
```

→ Datei: `server/src/services/standings.ts` → `requireKnockoutWinnerTeamId()`

---

## 9. Weiterschalten der Phasen (Advance)

Der Advance-Mechanismus in `advanceTournamentPhase()` hat zwei Pfade:

### Pfad A: Vorherige K.O.-Runde existiert

1. Sieger der vorherigen K.O.-Runde werden gesammelt (inkl. Freilos-Sieger).
2. Sieger werden **zufällig gemischt**.
3. **Paarungen mit Bye-Handling** werden erzeugt (Auffüllen auf 2er-Potenz).
4. Bestehende Matches der Zielphase (und spätere) werden gelöscht.
5. Neue Matches werden in einer **Transaktion** angelegt.

### Pfad B: Keine vorherige K.O.-Runde (Gruppenphase → K.O.)

1. Qualifikanten werden aus Gruppentabellen ermittelt (inkl. Tie-Break, s.o.).
2. Qualifikantenliste wird auf die maximale Teilnehmerzahl der Zielphase gekürzt.
3. Qualifikanten werden **zufällig gemischt**.
4. **Paarungen mit Bye-Handling** werden erzeugt.
5. Alte K.O.-Matches werden gelöscht, neue werden in einer **Transaktion** erstellt.

### Schutzmaßnahmen

- Mindestens 2 Qualifikanten benötigt, sonst Fehler.
- Das UI zeigt Bestätigungsdialoge, wenn durch das Weiterschalten Ergebnisse verloren gehen.
- Bestehende K.O.-Runden ab der Zielphase werden immer gelöscht und neu erzeugt.

→ Datei: `server/src/services/advancePhase.ts` → `advanceTournamentPhase()`

---

## 10. Spielplan-Erzeugung (Round-Robin)

Die Gruppenspiele werden mit der **Circle-Methode** (Polygon-Scheduling) erzeugt:

1. Bei ungerader Teamanzahl wird ein virtueller Platzhalter (`BYE`) hinzugefügt.
2. Ein Team bleibt fix, die restlichen rotieren im Kreis.
3. Jede Rotation erzeugt eine **Spielrunde** (parallel spielbar).
4. Teams, die gegen `BYE` gelost sind, haben in dieser Runde ein Freilos (das Spiel wird einfach nicht erzeugt).
5. Heimrecht wechselt pro Runde für das fixe Team.

**Ergebnis:** Bei `n` Teams entstehen `n-1` Runden (gerade) bzw. `n` Runden (ungerade). Jede Runde enthält bis zu `n/2` parallele Spiele.

### Gruppenverteilung

Bei mehreren Gruppen (`groupCount > 1`) werden die Teams per Zufall gleichmäßig auf Gruppen verteilt. Jede Gruppe bekommt einen Buchstaben-Label (A, B, C, …). Pro Gruppe wird ein eigener Round-Robin-Spielplan erzeugt.

→ Datei: `server/src/services/roundRobinSchedule.ts`

---

## 11. Match-Timer (Stoppuhr)

Jedes Spiel hat einen Timer mit den Zuständen:

```
SCHEDULED → LIVE → PAUSED → LIVE → … → FINISHED
                                    ↘ CANCELLED
```

### Zustandsübergänge

| Aktion | Von | Nach | Effekt |
|--------|-----|------|--------|
| `start` | `SCHEDULED` / `CANCELLED` | `LIVE` | `matchStartedAt = now`, Timer auf 0 |
| `pause` | `LIVE` | `PAUSED` | `pausedAt = now` |
| `resume` | `PAUSED` | `LIVE` | Pausenzeit wird zu `totalPausedMs` addiert |
| `end` | `LIVE` / `PAUSED` / `SCHEDULED` | `FINISHED` | `elapsedSnapshotMs` wird gesetzt |
| `cancel` | `LIVE` / `PAUSED` | `CANCELLED` | `elapsedSnapshotMs` wird gesetzt |

### Berechnung der Spielzeit

```
Laufend (LIVE):     now - matchStartedAt - totalPausedMs
Pausiert (PAUSED):  pausedAt - matchStartedAt - totalPausedMs
Beendet/Abgebr.:    elapsedSnapshotMs (gespeicherter Wert)
Geplant:            0
```

Maximalwert: 5 Stunden (Schutz vor Fehlern).

**Wichtig:** Die Anzeige im Browser tickt **lokal** (1-Sekunden-Intervall) während `LIVE` — es gibt **kein** sekundengenaues Polling zum Server. Der Timer-Zustand wird nur bei Aktionen (Start/Pause/Ende) oder WebSocket-Updates vom Server aktualisiert.

→ Dateien: `server/src/services/matchTimer.ts`, `client/src/tournament/matchElapsed.ts`

---

## 12. Automatischer Abschluss

Wenn alle Finale-Spiele (`phase = FINAL`) den Status `FINISHED` haben, wird die Turnierphase automatisch auf `COMPLETED` gesetzt.

**Auslöser:**
- Score-Speichern auf einem Finale-Spiel
- Timer-Ende auf einem Finale-Spiel

→ Datei: `server/src/routes/tournaments/shared.ts` → `completeTournamentIfFinalFinished()`

---

## 13. Datenkonsistenz und Transaktionen

Folgende destruktive Workflows laufen innerhalb einer **Prisma-Transaktion** (`$transaction`), sodass bei Fehlern ein Rollback stattfindet:

- **Gruppenspiele erzeugen:** Alle bestehenden Matches löschen, Gruppenlabels zurücksetzen, neue Matches und Labels anlegen, Turnierphase aktualisieren — alles atomar.
- **K.O.-Bracket erzeugen (Direct-KO):** Bestehende Matches löschen, neue Bracket-Matches anlegen, Phase setzen — atomar.
- **K.O.-Phase weiterschalten (Advance):** Ziel- und Folgephasen löschen, neue Paarungen anlegen, Phase aktualisieren — atomar.

---

## 14. Relevante Dateien

| Bereich | Datei |
|---------|-------|
| Tabelle & Sieger | `server/src/services/standings.ts` |
| K.O.-Bracket-Erzeugung | `server/src/services/knockoutBracket.ts` |
| Phasen-Advance & Tie-Break | `server/src/services/advancePhase.ts` |
| Round-Robin-Spielplan | `server/src/services/roundRobinSchedule.ts` |
| Match-Timer | `server/src/services/matchTimer.ts` |
| Match-Routes (Erzeugen, Scores, Timer) | `server/src/routes/tournaments/matches.ts` |
| Standings & Advance-Routes | `server/src/routes/tournaments/standings-advance.ts` |
| Hilfsfunktionen (Serialisierung, Owner-Check) | `server/src/routes/tournaments/shared.ts` |
| Client: Timer-Anzeige | `client/src/tournament/matchElapsed.ts` |
| Client: Score-Draft-Merge | `client/src/tournament/tournamentDerive.ts` |
| Tests: K.O.-Bracket | `tests/server/unit/knockoutBracket.test.ts` |
| Tests: Advance & Tie-Break | `tests/server/unit/advancePhase*.test.ts` |
