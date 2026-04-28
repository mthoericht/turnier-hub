# Turnier-Hub Backend (Server)

Diese README beschreibt das Backend im `server/`-Workspace im Detail: Architektur, Laufzeit, API-Struktur, Middleware, Services, Realtime, Datenbank und Betrieb.

## Überblick

Das Backend ist eine Express-API mit Prisma (PostgreSQL), JWT-Auth und SSE-Realtime.

- REST-Basis: `/api/*`
- Realtime: `/api/ws` (gleicher HTTP-Server wie die API)
- Auth: `Authorization: Bearer <JWT>`
- Request-Validierung: `zod` in den Route-Modulen
- Fehlerbehandlung: zentral über Error-Middleware

## Startpunkte und Laufzeit

- `src/index.ts`
  - erstellt den HTTP-Server aus der Express-App
  - hängt den WebSocket-Hub auf `/api/ws` an
- `src/app.ts`
  - registriert globale Middleware (CORS, JSON-Parser)
  - mountet alle Router
  - liefert im Production-Betrieb das gebaute SPA aus `client/dist`
  - enthält 404-Handler und globale Error-Middleware

## Verzeichnisstruktur (Server)

```text
server/
├── prisma/                  # Prisma-Schema + DB-Doku
├── scripts/                 # Seed / DB-Cleanup Skripte
└── src/
    ├── app.ts               # Express-App
    ├── index.ts             # HTTP-Server + WS-Anbindung
    ├── auth/                # Token-Helfer
    ├── config.ts            # ENV-Konfiguration
    ├── db.ts                # Prisma-Client
    ├── middleware/          # auth, asyncHandler, error
    ├── realtime/            # WS-Hub + Notify-Helfer
    ├── routes/              # REST-Routen
    ├── services/            # Domänenlogik
    ├── lib/                 # gemeinsame Mapper/Select-Helper
    └── types/               # globale TS-Augmentations
```

## Router und API-Aufteilung

In `src/app.ts` gemountet:

- `/api/auth` -> `src/routes/auth.ts`
- `/api/classes` -> `src/routes/classes.ts`
- `/api/players` -> `src/routes/players.ts`
- `/api/tournaments` -> `src/routes/tournaments/index.ts`

### Tournament-Route-Module

`src/routes/tournaments/index.ts` registriert modulare Teilrouter:

- `core.ts` - Turnier-CRUD (listen, create, detail, patch, delete)
- `teams.ts` - Teams, Mitglieder, Gruppen-Umbenennung, Team-Transfer
- `matches.ts` - Match-Generierung, Score-Update, Timer-Aktionen, Delete-all-matches
- `standings-advance.ts` - Tabellen/Standings und Phase-Advance
- `shared.ts` - gemeinsame Serialisierung/Loader/Helper für Tournament-Routen

## Middleware-Konzept

### `src/middleware/auth.ts`

- liest `Bearer`-Token aus dem Header
- validiert JWT
- setzt `req.userId`
- liefert `401` bei fehlendem/ungültigem Token

### `src/types/express.d.ts`

- erweitert `Express.Request` um `userId?: string`
- wird von Auth-geschützten Routen genutzt

### `src/middleware/asyncHandler.ts`

- Wrapper für async Route-Handler
- leitet Rejections automatisch an `next(err)` weiter
- vermeidet `try/catch`-Boilerplate in jeder Route

### `src/middleware/error.ts`

Zentrale Fehlerbehandlung:

- `ServiceError` -> `statusCode` + message
- Prisma `P2002` -> `409` (Konflikt)
- sonst: `500` + Server-Logging (`console.error`)

## Parser / Validierung

- Validierung erfolgt pro Route mit `zod` (`safeParse`)
- typische Antwort bei ungültigem Input: `400`
- Vorteil: Route-nahes, explizites Schema statt impliziter Annahmen

Beispiele:

- Auth (`signup`, `login`) in `src/routes/auth.ts`
- Team-/Match-Payloads in `src/routes/tournaments/*.ts`

## Service-Schicht

Services in `src/services/` kapseln Fachlogik und halten Routen schlank.

Wichtige Bausteine:

- `tournamentRosterService.ts`
  - Teams erstellen/ändern/löschen
  - Mitglieder hinzufügen/entfernen
  - Team-Transfer
- `tournamentMatchService.ts`
  - Gruppen-/KO-Matches erzeugen
  - Scores patchen
  - Timer-Aktionen
  - alle Matches löschen
- `advancePhase.ts`
  - Turnier-Phasenübergänge inkl. KO-Aufbau
- `standings.ts`
  - Tabellenberechnung / Qualifikationslogik
- `knockoutBracket.ts`
  - KO-Paarungen inkl. Freilose
- `matchTimer.ts`
  - serverseitige Timer-Berechnung/-Regeln
- `ServiceError.ts`
  - typsicherer Domänenfehler mit HTTP-Status

## Gemeinsame Mapper / Select-Helper

`src/lib/createdBy.ts` enthält wiederverwendbare API-Mapping-Logik:

- `createdBySelect`
- `toCreatedBy(...)`
- `playerToApi(...)`
- `schoolClassToApi(...)`
- `parseListScope(...)` (`own` vs. `all`)

Dadurch bleiben Prisma-Selects und DTO-Mapping zentral konsistent.

## Realtime (WebSocket)

- Hub: `src/realtime/hub.ts`
- Notify-Funktionen: `src/realtime/notify.ts`
- Endpoint: `/api/ws?token=<JWT>`

Push-Typen:

- `tournamentChanged` (nur abonnierte Clients)
- `catalogChanged` (Broadcast an alle)
- `tournamentsChanged` (Broadcast an alle)

Subscription-Modell:

- Client abonniert Turnier-IDs
- Server schickt turnierspezifische Änderungen gezielt an Subscriber

## Datenbank / Prisma

- Schema: `prisma/schema.prisma`
- Prisma-Client: über `src/db.ts`
- Dev-DB: über `server/.env`
- Test-DB: über `server/.env.test`

Wichtige Kommandos (im `server/`-Workspace):

```bash
npm run dev
npm run build
npm run start
npm run db:push
npm run db:seed
npm run db:clear -- --yes
npm run test:unit
```

Hinweis: Im Projekt werden diese Skripte meist vom Repo-Root aus via Workspace-Skripte aufgerufen.

## Umgebungsvariablen

Siehe `server/.env.example`. Typisch relevant:

- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `INVITE_CODE`

## Response- und Fehlerkonventionen

- Erfolg: JSON (oder `204` ohne Body bei Delete)
- Validierungsfehler: `400`
- Nicht gefunden: `404`
- Auth-Fehler: `401`
- Konflikte: `409` (z. B. eindeutige Constraints)
- Unbekannt: `500` (globaler Error-Handler)

## Tests

Server-Tests liegen unter `tests/server/` (Repo-Root):

- Unit: `tests/server/unit/**`
- Integration: `tests/server/integration/**`

Typische Ausführung:

```bash
npm run test:unit -w server
```

## Entwicklungsrichtlinien (Backend)

- Route-Handler schlank halten (validate -> service -> notify -> response)
- neue async Handler mit `asyncHandler(...)` registrieren
- Domänenfehler bevorzugt als `ServiceError` modellieren
- gemeinsame Mapper/Selects in `lib/` statt Duplikaten in Routen
- keine sensiblen Dateien committen (`.env`, DB-Dateien, `dist/`)

