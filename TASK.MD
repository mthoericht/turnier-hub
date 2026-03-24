Bitte erstelle eine Webapp zur verwaltung von Turnieren.

Sportarten u.a. typische Schulsportarten wie: Volleyball, Fußball, 2-Felderball, etc.

Features:
* Login (inkl. Signup) => es darf sich nur mit einem zusätzlichen "inviteCode" registriert werden. (Kann gerne erstmal "ballspiele2026" heißen)
* Spielerverwaltung (ggf. Klassen, Namen)
* Turnierverwaltung
  * Spieler aus der Spielerverwaltung sollen zuweisbar sein
  * Bei den Tournieren sollen die Ergebnisse eintragbar sein
  * Bitte mit Funktion "Spiel starten, pausieren, beenden, abbrechen" (inkl. Stoppuhr)
  * Ergebnisse müssen überall manuell eintragbar sein.
  * Sobald es in viertel, halb oder finale geht, bitte die Gruppen/Zuorndung entsprechend definieren. (Sicherheitshalber kann sie im Backend definiert werden wenn es Sinn macht)

Techstack:

* Vite
* Frontend in Typescript Vue.JS (inkl. Pinia, und VueRouter)
* CSS gerne in Tailwind
* Backend: Express, Typescript
* Datenbank bitte SQLite mit Prisma ORM (Bitte entsprechend nach den Features anlegen) => Bitte Datenbank in ein data-Verzeichnis in dieses Repo ablegen
* Auth: JWT, bcryptjs; token in Authorization: Bearer and localStorage key

---

## Stand der Umsetzung (Kurz)

- **Klassen:** Eigene Verwaltung unter „Klassen“ (`/classes`); Spieler wählen eine Klasse aus dieser Liste (kein Freitext mehr).
- **Vorrunde:** Keine Pools — alle Mannschaften einer Liga, **Jeder gegen Jeden**; eine Tabelle; **Weiterkommen-Plätze** (`advancesPerGroup`) steuern die K.-o.-Qualifikation.
- **Turnier-UI:** Standardansicht ist **Kader**, danach **Spiele**; Details siehe [README.md](README.md) / [AGENTS.md](AGENTS.md).
- **Ergebnisse:** Torfelder standardmäßig **0**; **Speichern** sendet immer **Heim und Gast** gemeinsam (kein halbes Ergebnis in der DB). **Spiel beenden** (Timer) ersetzt nicht das Speichern — für K.-o.-Weiterkommen zählen die **persistierten** Tore. Beim laufenden Timer schützt ein **Merge** des Entwurfs vor Datenverlust durch Poll-Reloads.
- **Hinweise:** **Toasts** für Validierung/API-Fehler bei Turnieraktionen; vor erneutem Anlegen von Vorrunde/K.-o. **Bestätigung**, wenn schon Ergebnisse betroffen wären.
