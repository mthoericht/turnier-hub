# Turnier-Hub Backend (Server)

Diese README beschreibt das Backend im `server/`-Workspace im Detail: Architektur, Laufzeit, API-Struktur, Middleware, Services, Realtime, Datenbank und Betrieb.

## Überblick

Das Backend ist eine Express-API mit Prisma (SQLite). Identität kommt vom **Reverse-Proxy** über den Header **`Remote-User`** (z. B. Authelia); Admin über **`ADMIN_REMOTE_USERS`** und/oder **`Remote-Groups`** (Gruppe **`ADMIN_REMOTE_GROUP`**, Standard `admins`).

- REST-Basis: `/api/*` (inkl. `GET /api/session` für Subjekt, Rolle und optional `logoutUrl`)
- Realtime: `/api/ws` (gleicher HTTP-Server wie die API; Upgrade mit `Remote-User`)
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
    ├── config.ts            # ENV-Konfiguration
    ├── db.ts                # Prisma-Client
    ├── middleware/          # auth, asyncHandler, error
    ├── realtime/            # WS-Hub + Notify-Helfer
    ├── routes/              # REST-Routen (session, classes, players, tournaments, admin)
    ├── services/            # Domänenlogik
    ├── lib/                 # Mapper, catalogSchool, Select-Helper
    └── types/               # globale TS-Augmentations
```

## Router und API-Aufteilung

In `src/app.ts` gemountet:

- `/api/session` -> `src/routes/session.ts`
- `/api/classes` -> `src/routes/classes.ts`
- `/api/players` -> `src/routes/players.ts`
- `/api/tournaments` -> `src/routes/tournaments/index.ts`
- `/api/admin` -> `src/routes/admin.ts`

### Tournament-Route-Module

`src/routes/tournaments/index.ts` registriert modulare Teilrouter:

- `core.ts` - Turnier-CRUD (listen, create, detail, patch, delete)
- `teams.ts` - Teams, Mitglieder, Gruppen-Umbenennung, Team-Transfer
- `matches.ts` - Match-Generierung, Score-Update, Timer-Aktionen, Delete-all-matches
- `standings-advance.ts` - Tabellen/Standings und Phase-Advance
- `shared.ts` - gemeinsame Serialisierung/Loader/Helper für Tournament-Routen

## Middleware-Konzept

### `src/middleware/auth.ts`

- liest **`Remote-User`** (normalisiert); optional Fallback **`DEV_REMOTE_USER`** nur für Entwicklung/Test; optional **`DEV_REMOTE_ADMIN`** setzt für jede Identität die Rolle Admin (nur non-production); **`Remote-Groups`** für Admin gemäß **`ADMIN_REMOTE_GROUP`**
- setzt `req.remoteSubject` und `req.userRole` (`ADMIN` bei Treffer in `ADMIN_REMOTE_USERS`, bei Gruppe in `Remote-Groups` laut `ADMIN_REMOTE_GROUP`, sonst `USER`; non-production: `DEV_REMOTE_ADMIN`)
- liefert `401`, wenn kein Subjekt ermittelt werden kann

### `src/types/express.d.ts`

- erweitert `Express.Request` um `remoteSubject` und `userRole`
- wird von geschützten Routen genutzt

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

`src/lib/createdBy.ts` enthält wiederverwendbare API-Mapping-Logik; `src/lib/catalogSchool.ts` löst die Katalog-Schule (`DEFAULT_SCHOOL_ID` oder Name) auf.

- `toCreatedBy(...)` (from `createdBySubject`)
- `playerToApi(...)`, `schoolClassToApi(...)`
- `parseListScope(...)` (`own` vs. `all`)

## Realtime (WebSocket)

- Hub: `src/realtime/hub.ts`
- Notify-Funktionen: `src/realtime/notify.ts`
- Endpoint: `/api/ws` (Identität wie HTTP über **`Remote-User`** beim Upgrade)

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

- `PORT`, `DATABASE_URL`
- `DEFAULT_SCHOOL_ID` / `DEFAULT_SCHOOL_NAME` (Katalog-Zuordnung)
- `CORS_ALLOWED_ORIGINS`, `TRUST_PROXY`
- `ADMIN_REMOTE_USERS`, `ADMIN_REMOTE_GROUP`, `AUTHELIA_LOGOUT_URL`, `DEV_REMOTE_USER`, `DEV_REMOTE_ADMIN` (nur lokal / non-production)
- `JSON_BODY_LIMIT`, `WS_*`, `SECURITY_*`

## Response- und Fehlerkonventionen

- Erfolg: JSON (oder `204` ohne Body bei Delete)
- Validierungsfehler: `400`
- Nicht gefunden: `404`
- Nicht angemeldet / fehlende Identität: `401`
- Verboten (z. B. Admin-only): `403`
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
