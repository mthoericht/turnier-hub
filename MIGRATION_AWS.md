# Migration zu AWS

## Kurz:

Ich möchte diese Lösung auf AWS laufen lassen, von daher muss sie vermutlich nochmal komplett umstrukturiert werden. (https://docs.aws.amazon.com/cdk/v2/guide/home.html)


## Aufgaben:

- Bitte Codebase bzgl. AWS Integration/Migration prüfen
- Prüfen ob man die Datenbank inkl. Schema übertragen bekommt wenn nötig
- Sind Websockets möglich? Kann man die Echtzeitkommunikation sonst mit Lambda SSE lösen?
- Dinge wie Rate-Limit, etc. noch möglich?
- Kann man die Codebase so reduzieren, dass sie AWS-Kompatibel ist? (Besonders viel Security-Logik)
- Müssen die Automatisierten Tests für Backend angepasst werden?


Weitere Sinnvolle Lösungen: https://github.com/dougmoscrop/serverless-http


## Entscheidungen

| Thema | Entscheidung |
| ----- | ------------ |
| Zielarchitektur | **Pfad B — voll serverless**, **alle Lambdas hinter Function URLs + CloudFront** (kein API Gateway) |
| Datenbank | **Amazon RDS PostgreSQL** (mit RDS Proxy für Lambda-Connection-Pool) |
| Realtime | **SSE via Lambda Response Streaming** + DynamoDB-Polling für Fan-Out (1–2 s Latenz akzeptiert) |
| IaC | **AWS CDK in TypeScript** |
| Region | **eu-central-1 (Frankfurt)** — DSGVO + Latenz |
| Lokale Entwicklung | **Daily Dev ohne Docker** mit lokalem PostgreSQL (`data/postgres` via `db:init`/`db:start`); Lambda-Local via SAM bleibt optionaler Integrationspfad |

### Konsequenzen dieser Kombination

- **Lambda Response Streaming** funktioniert mit **Lambda Function URLs** out-of-the-box. Da wir komplett auf API Gateway verzichten, läuft sowohl der REST-Verkehr (`api`-Lambda) als auch SSE (`sse`-Lambda) jeweils über eine eigene Function URL.
- **CloudFront** liegt davor und unterscheidet anhand des Pfads:
  - `/api/sse` → `sse`-Lambda Function URL (Streaming)
  - `/api/*` → `api`-Lambda Function URL (REST via `serverless-http`)
  - `/*` → S3 (statische SPA)
- **Auth zwischen CloudFront und Function URLs** läuft via `Function URL AuthType: AWS_IAM` + CloudFront **Origin Access Control (OAC)**: nur CloudFront kann die Function URLs aufrufen. Application-Auth (JWT) bleibt in der Lambda.
- **Throttling/WAF** komplett auf CloudFront-/WAF-Ebene (statt an API GW). Application-Layer-Limits (Identifier, Login-Lockout) liegen in DynamoDB.
- **SSE Fan-Out**: jede Mutation schreibt einen Event in DynamoDB (`realtime_events`, TTL 1 h). Jede SSE-Lambda pollt diese Tabelle alle 1–2 s und schreibt neue Events als SSE-Frames in den Stream. Lambdas laufen bis zu 15 min, dann reconnected der Browser-`EventSource` automatisch.


## Analyse des aktuellen Stands

### Was AWS-Migration heute blockiert

| Bereich | Datei(en) | Problem für Lambda |
| ------- | --------- | ------------------ |
| HTTP + WS am gleichen Port | `server/src/index.ts`, `server/src/realtime/hub.ts` | Lambda kann keine persistenten WebSocket-Verbindungen halten — `ws`-basierter Hub muss durch SSE + DynamoDB-Event-Log ersetzt werden. |
| In-Memory Rate-Limit (HTTP) | `server/src/middleware/authRateLimit.ts` (`ipCounters`, `identifierCounters`) | Lambda-Instanzen sind kurzlebig und parallel. Maps wirkungslos. → DynamoDB-Adapter. |
| In-Memory Login-Lockout | `server/src/routes/auth.ts` (`loginFailures` Map) | Sicherheitskritisch. → DynamoDB-Adapter. |
| In-Memory Security-Telemetrie | `server/src/security/monitoring.ts` | Pro Lambda-Instanz gezählt, irrelevant. → CloudWatch Metric Filters. |
| WebSocket-Subscription-Registry | `server/src/realtime/hub.ts` (`tournamentSubs`, `socketMeta`) | Wird durch SSE-Lambda + DynamoDB-Event-Log + per-Connection-Subscriptions ersetzt. |
| Legacy lokale DB | `server/prisma/schema.prisma` (historisch lokale File-DB) | → RDS PostgreSQL. |
| SPA-Auslieferung | `server/src/app.ts` → `express.static(clientDist)` | Kostet Lambda-Zeit und Geld. → S3 + CloudFront. |
| Secrets via `.env` | `server/src/config.ts`, Ansible `server.env.j2` | → Secrets Manager + Lambda Env-Vars. |
| Long-running Listener | `server/src/index.ts` (`server.listen`, `attachToServer`) | Bleibt im **lokalen Dev-Modus** erhalten; in AWS ersetzt durch Lambda-Handler. |

### Antworten auf die Aufgaben aus dem Brief

1. **AWS-Integration generell.** Möglich. Code ist sauber strukturiert (klare Service-Schicht, dünne Routes), Express-App lässt sich via `serverless-http` quasi unverändert in Lambda packen. Großer Umbau betrifft Realtime-Hub und alle In-Memory-State-Stellen.
2. **Datenbank/Schema übertragen.** Schema ist Prisma-portabel; im Projekt ist inzwischen `provider = "postgresql"` aktiv. Prod-Daten müssen einmalig per sauberem Export/Import migriert werden (oder Re-Seed bei kleinem Bestand). **Vorher Prisma-Migration-Baseline einführen** — reines `db push` ist für Postgres in Prod nicht ratsam.
3. **Realtime möglich?** Ja, **SSE via Lambda Response Streaming** ist gewählt:
   - Der bestehende **`ws`-Server entfällt komplett**.
   - Alle drei Push-Typen (`tournamentChanged`, `catalogChanged`, `tournamentsChanged`) werden über SSE `event:`-Frames gestreamt.
   - Subscribe/Unsubscribe wandern in **Query-Parameter der SSE-URL** (`/api/sse?tournaments=tid1,tid2`); Reconnect des Clients lädt die aktualisierte Subscription.
   - **Fan-Out** zwischen mutierender REST-Lambda und SSE-Lambdas läuft über ein **DynamoDB-Event-Log** (`realtime_events`, TTL 1 h). SSE-Lambdas pollen alle 1–2 s.
4. **Rate-Limit etc. weiter möglich?** Ja, mehrstufig:
   - **AWS WAF** (vor CloudFront): IP-Rate-Limit, Geo, Bad-Bot-Listen.
   - **Application-Layer** (DynamoDB-Adapter): Identifier-basiert (Email/Username) und Login-Lockout. Atomares `UpdateItem` mit `ADD` + TTL, lambda-tauglich (kein VPC, kein Connection-Pool).
   - **Body-Limits, CORS-Allowlist, Helmet-Header, JWT-Validierung**: bleiben in Express, lambda-kompatibel.
5. **Codebase reduzieren.** Konkret:
   - **Entfernen**: `server/src/realtime/hub.ts` komplett (durch SSE ersetzt), `WS_*`-Config-Werte in `server/src/config.ts`, `ws`-Dependency in `server/package.json`, Realtime-Hub-Tests.
   - **Reduzieren**: `server/src/security/monitoring.ts` — nur strukturierte JSON-Logs behalten, In-Process-Counter raus (CloudWatch übernimmt).
   - **Bleiben**: JWT/`tokenVersion`/`requireAdmin`/Zod/Body-Limits/CORS/Helmet — alles weiter sinnvoll und lambda-kompatibel.
   - **Verschieben**: `authRateLimit.ts` und `loginFailures` von Map auf `RateLimitStore`-Interface mit Memory- und Dynamo-Adapter.
6. **Backend-Tests anpassen?** Ja:
   - **DB-Helper** (`tests/server/helpers/db.ts`): bleibt funktional gleich (Truncate-basiert), die Test-DB ist jetzt aber Postgres im Docker-Compose-Setup.
   - **Realtime-Tests** (`tests/server/unit/realtimeHub.test.ts`): komplett neu schreiben für SSE-Handler — Lambda-Stream-Mock + DynamoDB-Mock.
   - **Security-Tests** (`tests/server/unit/appSecurity.test.ts`, `securityMonitoring.test.ts`): durch State-Adapter-Refactor verlieren sie ihre Direktbindung an Maps, bleiben aber gegen den Memory-Adapter grün.
   - **Neu**: Integrationstests gegen lokalen Lambda-Stack (SAM CLI + DynamoDB-Local + Docker-Postgres).


## Zielarchitektur

```
                       ┌────────────────────────────┐
                       │          CloudFront         │
                       │ (TLS, WAFv2, CDN, OAC, Routing)│
                       └────┬────────────────┬───────┘
                            │                │
              SPA-Assets    │                │  /api/*
              ─────────────►│                │
                            ▼                ▼
                       ┌─────────┐    ┌──────────────────┐
                       │   S3    │    │ Lambda Function  │
                       │ (privat,│    │     URLs          │
                       │  OAC)    │    │  ┌──────────────┐│
                       └─────────┘    │  │ api (REST)   ││ ◄── /api/*  außer /api/sse
                                      │  └──────────────┘│
                                      │  ┌──────────────┐│
                                      │  │ sse (Stream) ││ ◄── /api/sse
                                      │  └──────────────┘│
                                      └────┬─────────────┘
                                           │
                            ┌──────────────┼──────────────┐
                            ▼              ▼              ▼
                       ┌────────┐    ┌──────────┐   ┌──────────┐
                       │  RDS   │    │ DynamoDB │   │ Secrets  │
                       │Postgres│    │ (events, │   │ Manager  │
                       │  +     │    │ rate-lim,│   └──────────┘
                       │ Proxy  │    │ lockout) │
                       └────────┘    └──────────┘
                                          ▲
                                          │ pollt 1–2 s
                                          │
                                     sse-Lambda
```

### Komponenten im Detail

| Komponente | AWS-Dienst | Zweck |
| ---------- | ---------- | ----- |
| SPA-Hosting | **S3 + CloudFront** | `client/dist` als statisches Hosting; CloudFront cached aggressive |
| REST-API | **Lambda Function URL** (Node.js 22) | Express via `serverless-http`; ein „Monolith"-Lambda für alle `/api/*`-Routes außer SSE; `AuthType: AWS_IAM` mit CloudFront OAC |
| SSE-Realtime | **Lambda Function URL + Response Streaming** | `awslambda.streamifyResponse`; pollt DynamoDB-Event-Log, schreibt SSE-Frames; `AuthType: AWS_IAM` mit CloudFront OAC; `InvokeMode: RESPONSE_STREAM` |
| Datenbank | **RDS PostgreSQL** + **RDS Proxy** | Prisma; Proxy fängt Lambda-Connection-Storms ab |
| Realtime-Bus | **DynamoDB** Tabelle `realtime_events` (TTL 1 h) | Mutationen schreiben Events; SSE-Lambdas pollen mit `tournamentId IN (…) AND ts > lastSeen` |
| State-Storage | **DynamoDB** Tabellen `rate_limit`, `login_lockout` | Atomare Counter, TTL-basierte Auto-Bereinigung |
| Secrets | **AWS Secrets Manager** | `JWT_SECRET`, `INVITE_CODE`, DB-Credentials |
| Edge-Security | **AWS WAFv2** | IP-Rate-Limit (z. B. 2000 req / 5 min / IP), Geo-Block optional, AWS Managed Rules Common |
| DNS / TLS | **Route 53 + ACM** | Custom Domain |
| Beobachtbarkeit | **CloudWatch Logs + Metrics + Alarms** | Strukturierte JSON-Logs aus `security/monitoring.ts` werden via Metric Filter zu Alarms |

### Lambda-Layout

| Lambda | Trigger | Verantwortung |
| ------ | ------- | ------------- |
| `api` | Function URL (alle `/api/*` außer `/api/sse`) | Express via `serverless-http`; gleiche Routes wie heute, mit Postgres-Prisma und Dynamo-Adaptern |
| `sse` | Function URL `/api/sse`, `InvokeMode: RESPONSE_STREAM` | JWT-Auth; pollt `realtime_events`; schreibt `data: {…}\n\n` Frames; läuft bis zu 15 min, dann sauberer Stream-Close |
| `migrate` | Manuell (CLI) oder bei Deploy via Custom Resource | `prisma migrate deploy` einmalig |

> **Cold-Start-Tuning:** `@prisma/client` als Lambda-Layer auslagern, `binaryTargets = ["native", "rhel-openssl-3.0.x"]` setzen, `aws-sdk` v3 modular importieren, ggf. Provisioned Concurrency für `api`-Lambda erwägen.


## Lokale Entwicklung & Tests

Ziel: **`npm run dev` bleibt als schneller Innerloop bestehen**, zusätzlich gibt es einen **echten Lambda-Local-Stack** für Integrationstests, der so nah wie möglich an Produktion ist.

### Zwei Modi nebeneinander

```
┌────────────────────────────────┬──────────────────────────────────────┐
│ Modus A: Express direkt (Dev)  │ Modus B: Lambda lokal (Integration)  │
├────────────────────────────────┼──────────────────────────────────────┤
│ npm run dev                     │ npm run dev:lambda                  │
│ → tsx watch src/index.ts        │ → docker compose up -d              │
│   (Express HTTP + SSE-Endpoint) │   + sam local start-lambda          │
│ Vite proxyt /api → :3001        │   (RIE für api + sse Function URLs) │
│                                 │ Vite proxyt /api → SAM/RIE :3001    │
│ Postgres + DynamoDB-Local       │ Postgres + DynamoDB-Local           │
│ in Docker Compose               │ in Docker Compose                   │
└────────────────────────────────┴──────────────────────────────────────┘
```

Beide Modi nutzen **dieselbe Express-App** (`createApp()` in `server/src/app.ts`) und dieselben Service-Funktionen — der Unterschied ist nur, **wie** der Handler aufgerufen wird.

### Tooling

- **AWS SAM CLI** (`brew install aws-sam-cli`) — startet Lambdas lokal in Docker via Runtime Interface Emulator (RIE). Unterstützt **Response Streaming seit Ende 2023** (RIE ≥ 1.16).
- **AWS CDK Local Bundle** — `cdk synth` produziert das CloudFormation-Template + die Lambda-Pakete; SAM CLI liest dasselbe Template (`cdk.out/<stack>.template.json`) via `sam local start-lambda -t cdk.out/...`.
- **Docker Compose** (`docker-compose.yml` im Repo-Root):
  - `postgres:16-alpine` mit Volumes für persistente Dev-Daten und Init-Skript, das Dev- und Test-DB anlegt.
  - `amazon/dynamodb-local` (Port 8000) mit gemountetem Daten-Volume.
  - Optional `localstack/localstack` (Free Tier) für S3, Secrets Manager, EventBridge, falls nötig.
- **Prisma**: `DATABASE_URL=postgresql://turnier:turnier@localhost:5432/turnier_dev` für Dev, `…/turnier_test` für Tests.
- **DynamoDB-Tabellen lokal anlegen**: kleines Skript `server/scripts/createDynamoTables.ts` (idempotent), führt `CreateTable`-Calls gegen `http://localhost:8000` aus; npm-Skript `npm run dynamo:setup`.
- **Secrets**: lokal nicht aus AWS Secrets Manager, sondern aus `server/.env`. Hinter dem `getSecret(name)`-Interface gekapselt.

### Lambda-spezifische SSE-Tests lokal

- **Daily Loop:** Modus A — Express liefert SSE direkt aus (Express-Handler macht dasselbe DynamoDB-Polling). Vite-Dev-Proxy schickt `/api/sse` an `:3001`. Browser `EventSource` funktioniert ohne Lambda-Wrapper.
- **Vor Cloud-Deploy:** Modus B — `sam local start-lambda` mit der Function URL Konfiguration. Mit `curl -N http://localhost:3001/api/sse?token=…` lässt sich die Stream-Antwort verifizieren. RIE produziert Header + Body chunkweise wie in Lambda.

### Test-Suite

| Test-Typ | Wo / Wie |
| -------- | -------- |
| Unit | Vitest, gegen Memory-Adapter (`MemoryRateLimitStore`, In-Memory-Event-Log). Schnell, kein Docker. |
| Integration (DB) | Vitest gegen die lokale Postgres-Test-DB (`turnier_test`) im Docker Compose. |
| Integration (DynamoDB) | Vitest gegen `amazon/dynamodb-local` im Docker Compose. AWS SDK v3 mit `endpoint: "http://localhost:8000"`. |
| Integration (Lambda-Stack) | `sam local start-lambda` läuft im CI; Vitest oder Playwright ruft echte HTTP-/SSE-Endpunkte auf. Optional, weil SAM-Startup lang dauert. |
| End-to-End (Browser) | Playwright gegen Modus A oder B; bestehende Storybook/Integration-Suite weiterverwenden. |


---

## Status-Legende

- ✅ erledigt
- 🔄 in Arbeit
- ⬜ offen
- ⚠️ blockiert (Bedingung nicht erfüllt — siehe Anmerkung)


## Nächste Schritte

### Phase 0 — Setup & Vorbereitungen

| | Schritt |
| - | ------- |
| ⬜ | AWS-Account dediziert anlegen (eu-central-1), Org-Unit klären, SSO/IAM Identity Center für Entwickler-Login einrichten. |
| ⬜ | CDK-Workspace `infra/` anlegen (`aws-cdk-lib`, `constructs`, `aws-cdk` als devDeps). Initial leere Stacks: `NetworkStack`, `DataStack`, `LambdaStack`, `EdgeStack`. |
| ✅ | Lokale Postgres-Skripte ergänzt: `db:init`, `db:start`, `db:status`, `db:stop` (Cluster unter `data/postgres`, Log unter `data/postgres.log`). |
| ✅ | Docker-Setup für Daily Dev entfernt (`docker-compose.yml` gelöscht); lokale Anleitung auf Homebrew-Postgres umgestellt. |
| ✅ | `npm run dev:lambda`-Pfad nach Docker-Entfernung neu aufgesetzt: `db:start` → `db:deploy` → `sam local start-api` (Template-basiert). |
| ✅ | Diese Datei als Source-of-Truth gepflegt. |

### Phase 1 — Postgres-Migration (lokal, noch keine Cloud)

| | Schritt |
| - | ------- |
| ✅ | `server/prisma/schema.prisma`: `provider = "postgresql"` (Schema bleibt Prisma-portabel; Enums werden Postgres-nativ generiert). |
| ✅ | `server/.env.example`: `DATABASE_URL=postgresql://turnier:turnier@localhost:5432/turnier_dev`. |
| ✅ | `server/.env.test`: `DATABASE_URL=postgresql://turnier:turnier@localhost:5432/turnier_test`. |
| ✅ | DB-Skripte auf Prisma-`db push`-Flow vereinheitlicht (`db:push`, `db:push:test`, `db:deploy`, `test:prepare`). |
| ✅ | Test-DB-Schema anwenden (`npm run db:push:test`) läuft gegen lokale Postgres-Test-DB. |
| ✅ | Tests grün halten (`npm run test`) ist lokal mit laufender Postgres-Instanz möglich (kein Docker-Zwang). |
| ⬜ | `tests/server/helpers/db.ts`: aktuell Truncate-basiert (funktioniert mit Postgres unverändert). Optional in Folge-PR auf Testcontainers umstellen für CI-Parallelisierung. |
| ⬜ | Ansible-Templates (`ansible/roles/turnier_hub/templates/server.env.j2`, `db:deploy`-Aufrufe) als „Legacy" markieren oder entfernen — tun wir gesammelt in Phase 7. |
| ⬜ | **PR-Grenze:** funktioniert lokal end-to-end mit Postgres, alle Tests grün, ohne dass AWS-Code im Repo ist. |

> **Manuelle Schritte für Local Dev (ohne Docker):**
> 1. `brew install postgresql@16`
> 2. `PG_BIN="$(brew --prefix postgresql@16)/bin" npm run db:init`
> 3. `PG_BIN="$(brew --prefix postgresql@16)/bin" npm run db:start`
> 4. `npm run db:push && npm run db:push:test`
> 5. `npm run db:seed`
> 6. `npm run test`
> 7. `npm run dev`

### Phase 2 — State-Adapter einführen + WS→SSE-Umbau (lokal, noch keine Cloud)

| | Schritt |
| - | ------- |
| ✅ | **Rate-Limit-Adapter:** `server/src/state/rateLimitStore.ts` mit `RateLimitStore` Interface + `MemoryRateLimitStore`. `authRateLimit.ts` benutzt jetzt den Store, `setRateLimitStore()` für Lambda-Bootstrap (Phase 5: `DynamoRateLimitStore`). |
| ✅ | **Login-Lockout:** `server/src/state/lockoutStore.ts` mit `LockoutStore` + `MemoryLockoutStore`. `auth.ts` `loginFailures`-Map durch `lockoutStore.registerFailure / getActive / reset` ersetzt. |
| ✅ | **Realtime-Backend ersetzt:** `server/src/realtime/hub.ts` gelöscht. Neuer `server/src/realtime/eventBus.ts` mit Interface `RealtimeEventBus { publish, subscribe }` + `MemoryEventBus`. `notify.ts` publisht jetzt in den Bus. |
| ✅ | **Neuer SSE-Endpoint:** `server/src/realtime/sseEndpoint.ts` (`createSseHandler(bus)`); `app.ts` mountet `GET /api/sse` und wired den Bus über `setRealtimeEventBus`. JWT-Auth via `?token=`, Subscription via `?tournaments=…`, 30 s Heartbeat-Comments, sauberes Cleanup auf `req close`. |
| ✅ | **Client-Realtime auf `EventSource`** umgestellt: `client/src/realtime/realtimeClient.ts` baut SSE-URL mit aktueller Subscription-Set, reconnect bei Subscription-Änderungen wird per `queueMicrotask` gebündelt. `dispatch()`-Hook und externe API (`connect/disconnect/subscribeTournament/unsubscribeTournament`) unverändert. |
| ✅ | **`security/monitoring.ts` reduziert:** keine In-Process-Counter mehr, nur strukturierte JSON-`warn`-Logs für 401/403/429. WS-Telemetrie komplett entfernt. CloudWatch Metric Filter wird in Phase 5 aufgesetzt. |
| ✅ | **Config + Dependencies aufgeräumt:** `WS_*` und `SECURITY_*`-Werte aus `server/src/config.ts` und `server/.env.example` entfernt. `ws` und `@types/ws` aus `server/package.json` entfernt; `package-lock.json` aktualisiert. |
| ✅ | **Tests:** `tests/server/unit/realtimeHub.test.ts` gelöscht. Neu: `tests/server/unit/eventBus.test.ts` (Bus-Logik), `tests/server/unit/sseEndpoint.test.ts` (HTTP-Integration mit `fetch` + Stream-Reader). `securityMonitoring.test.ts` umgeschrieben auf neue Log-Form. `tests/client/unit/realtimeClient.test.ts` auf `EventSource`-Mock umgestellt. |
| ✅ | **Verifikation:** `npx tsc -p server --noEmit` grün; `npm run lint -w client` grün; alle 11 Server-Unit-Tests grün (49 Tests); alle 11 Client-Unit-Tests grün (48 Tests). `vue-tsc --build` zeigt 1 Pre-Existing-Fehler in `client/src/components/admin/AdminSchoolDialog.vue` (unbenutztes `emit`), nicht von Phase 2 verursacht. |
| ⬜ | Manuell verifizieren (ohne Docker): `db:start` + `npm run dev` — Browser öffnen, Login + Match-Score-Update zeigt SSE-Push live. |
| ⬜ | Manuell verifizieren: `npm run test:integration` (Client-Integration-Tests gegen Test-Postgres). |
| ⬜ | **PR-Grenze:** funktioniert lokal end-to-end **ohne `ws`**, mit SSE, mit Memory-Adaptern. |

### Phase 3 — Lambda-Wrapper + lokaler Lambda-Stack

| | Schritt |
| - | ------- |
| ✅ | `serverless-http` (^3.2.0) + `@types/aws-lambda` als Dependencies in `server/`. |
| ✅ | Neuer Ordner `server/src/lambda/`: `httpHandler.ts` (`serverless-http(createApp())` für Function URL → Express), `sseHandler.ts` (`awslambda.streamifyResponse` ruft die Phase-2-`startSseStream`-Helfer auf — gleiches Auth/Bus-Verhalten wie Express-SSE), `awslambda.d.ts` (ambient Types für `awslambda.HttpResponseStream` + `streamifyResponse`). |
| ✅ | **`sseEndpoint.ts` refaktoriert**: `parseSseQuery`, `authenticateSseToken`, `startSseStream` als wiederverwendbare Helfer extrahiert. Express- und Lambda-Pfad teilen jetzt Auth + Frame-Schreiben + Heartbeat + Cleanup. |
| ✅ | **Tests:** `tests/server/unit/lambdaHttpHandler.test.ts` (3 Tests: 401 ohne Token, 404 für unbekannte Routes, Helmet-Security-Header) und `tests/server/unit/lambdaSseHandler.test.ts` (3 Tests: 400 ohne Token, 401 für unbekannten User, 200 + `: connected`-Frame mit `text/event-stream`-Headern). `awslambda` global wird in den Tests über einen `PassThrough`-Stub ersetzt. |
| ✅ | **Hand-written `template.yaml` an der Repo-Wurzel** mit beiden Functions (`ApiFunction` BUFFERED, `SseFunction` RESPONSE_STREAM, beide mit `BuildMethod: esbuild` + Prisma-Client als External). Production-Auth (`AWS_IAM` + CloudFront OAC) wird in Phase 4 vom CDK-Stack überschrieben; bis dahin `AuthType: NONE` für `sam local`. |
| ✅ | `dev:lambda`-Skriptkette ist wieder im Root-`package.json`: `db:start` (lokales Postgres) → `db:deploy` (Schema sync) → `dev:lambda:sam` (`sam local start-api -t template.yaml --port 3001`). Zusätzlich `dev:lambda:invoke` für One-Shot-Tests. |
| ✅ | `.gitignore`: `.aws-sam/` und `cdk.out/` ergänzt. |
| ⚠️ | Manuell verifizieren (SAM CLI ≥ 1.110 + Docker erforderlich): `npm run dev:lambda` startet, `curl http://localhost:3001/api/auth/me` gibt 401 (= Lambda-Pfad funktioniert), `npm run db:seed` + Login-Flow im Browser gegen `http://localhost:3001`. Aktueller Blocker auf diesem Rechner: `sam: command not found` bei `npm run dev:lambda:invoke`. |
| ⬜ | **PR-Grenze:** REST-Lambda läuft lokal über SAM gegen Postgres-Container; SSE-Lambda baut sauber auf, Cross-Lambda-Fan-Out kommt erst mit `DynamoEventBus` in Phase 5 (mit `MemoryEventBus` sieht die SSE-Lambda Events nur, wenn sie im selben Container publiziert werden — Daily-Dev bleibt deshalb auf `npm run dev`/Express-direkt). |

> **SAM-Setup-Hinweise:**
> - Installation: `brew install aws-sam-cli` (macOS) oder via [AWS-Doku](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html). Mindestversion **1.110** für Streaming-Response-Support in RIE.
> - Postgres innerhalb des SAM-Containers wird über `host.docker.internal:5432` erreicht (siehe `Globals.Function.Environment.Variables.DATABASE_URL` im Template).
> - `sam local start-api` puffert SSE-Antworten — der Endpoint kommt durch, aber Streaming sieht man dort nicht. Für echtes Streaming gegen den Lambda-Pfad muss man `sam local invoke SseFunction` mit RIE ≥ 1.16 benutzen oder auf den Cloud-Deploy in Phase 4 warten.

### Phase 4 — CDK-Stacks für Cloud-Deploy

| | Schritt |
| - | ------- |
| ✅ | **CDK-Workspace initialisiert:** neues `infra/`-Workspace mit `aws-cdk-lib`, `constructs`, `aws-cdk`, `typescript`, `ts-node`; Einstieg über `infra/bin/infra.ts`, Konfig über `infra/lib/config.ts` (Stage/Region/Domain via Env). |
| ✅ | **`NetworkStack`**: VPC mit Public + Private-with-egress + Private-isolated Subnets, NAT Gateway (single), Lambda-App-Security-Group. |
| ✅ | **`DataStack`**: RDS PostgreSQL (`db.t4g.micro` Dev), RDS Proxy, DynamoDB-Tabellen (`realtime_events`, `rate_limit`, `login_lockout`), Secrets Manager (`JWT_SECRET`, `INVITE_CODE`) angelegt. |
| ✅ | **`LambdaStack`**: `api`-Lambda + Function URL (`AuthType: AWS_IAM`), `sse`-Lambda + Function URL (`InvokeMode: RESPONSE_STREAM`, `AuthType: AWS_IAM`), `migrate`-Lambda + Custom Resource (aktuell Noop-Placeholder bis `prisma migrate deploy`-Runner in Phase 5) angelegt; alle Lambdas VPC-attached. |
| ✅ | **`EdgeStack` (Basis):** S3-Bucket privat, CloudFront-Distribution mit drei Behaviors (`api/sse`, `api/*`, Default SPA), WAFv2 WebACL, optional Route53-Alias (wenn Domain/HostedZone gesetzt). |
| ⬜ | **Edge-Hardening offen:** CloudFront OAC für Function URLs + SigV4-Origin-Requests, ACM-Zertifikat in `us-east-1`, finale Domain/Route53/Behavior-Feinheiten für SSE-Streaming. |
| ⬜ | CDK-Pipeline (optional): `aws-cdk-lib/pipelines.CodePipeline` mit GitHub-Source. |
| ⬜ | **Manuell verifizieren:** `npm run cdk:synth` (grün), danach in Dev-Account `npm run cdk:deploy` mit gesetzten AWS-Credentials + `TURNIER_HUB_STAGE=dev`; Outputs prüfen (`ApiFunctionUrl`, `SseFunctionUrl`, CloudFront-Domain). |
| ⬜ | **PR-Grenze:** `cdk deploy` baut den vollen Stack in Dev-Account auf, Smoke-Test mit `curl` gegen CloudFront/Custom-Domain liefert Login + SSE. |

### Phase 5 — State-Adapter auf AWS schalten + Observability

| | Schritt |
| - | ------- |
| ✅ | **Runtime-Adapter live:** neue Dynamo-Implementierungen `DynamoRateLimitStore`, `DynamoLockoutStore`, `DynamoEventBus` eingebaut; Runtime-Umschaltung über Env (`RATE_LIMIT_STORE`, `LOCKOUT_STORE`, `EVENT_BUS`) in `server/src/runtime/runtimeAdapters.ts`. `createApp()` und `lambda/sseHandler.ts` nutzen jetzt denselben Resolver (`memory` default, `dynamo` für AWS). |
| 🔄 | **Performance-Test vorbereitet:** `npm run perf:sse` (`server/scripts/sseCapacityProbe.ts`) öffnet standardmäßig 100 parallele `/api/sse`-Verbindungen und hält sie 120 s. Optionaler Publish-Tick pro Sekunde via `PERF_SSE_PUBLISH_URL` möglich. Auswertung über CloudWatch-Metriken `AWS/DynamoDB` (`ConsumedReadCapacityUnits`, `ConsumedWriteCapacityUnits`) zur Entscheidung on-demand vs. provisioned. |
| ✅ | **CloudWatch-Alarms + Security-Metrik:** neuer `infra/lib/observability-stack.ts` erstellt. Enthält Alarme für Lambda Error-Rate (>1%/5m), Lambda Throttles (>0), RDS CPU (>80%), RDS Connections (>80), WAF `BlockedRequests` (CloudFront WebACL), plus `MetricFilter` auf API-Lambda-Logs für `$.category = \"security\"` (`TurnierHub/Security`, `SecuritySignals`) inkl. Alarm. SNS-Topic für Alarm-Fanout als Output. |

> **Perf-Probe Quickstart (Phase 5):**
> 1. API lokal starten (`npm run dev`) **oder** gegen deployed Stage testen (`PERF_BASE_URL=https://<domain>`).
> 2. Sicherstellen, dass Login-Creds gültig sind (`PERF_LOGIN_EMAIL`, `PERF_LOGIN_PASSWORD`; Defaults sind Seed-User).
> 3. Probe ausführen: `npm run perf:sse`.
> 4. Optional 1/s Mutations-Last hinzufügen:
>    - `PERF_SSE_PUBLISH_URL=/api/<dein-mutations-endpoint>`
>    - `PERF_SSE_PUBLISH_METHOD=POST|PATCH`
>    - `PERF_SSE_PUBLISH_BODY='{\"...\":...}'`
> 5. Im CloudWatch/Console oder via CLI die DynamoDB-Tabellenmetriken prüfen (`ConsumedReadCapacityUnits`, `ConsumedWriteCapacityUnits`) und daraus das Zielprofil ableiten (on-demand vs provisioned).
> 6. Entscheidung und Messwerte im Runbook dokumentieren: [`doc/AWS_PERF_CHECKLIST.md`](doc/AWS_PERF_CHECKLIST.md).

### Phase 6 — Frontend & Daten-Cutover

| | Schritt |
| - | ------- |
| 🔄 | Build-Pipeline für SPA vorbereitet: GitHub Action `.github/workflows/spa-deploy.yml` baut `client` und synced `client/dist` nach S3 (`aws s3 sync`), optional inkl. CloudFront-Invalierung. Für produktiven Einsatz fehlen noch AWS-Secrets/Role-Wiring (`AWS_DEPLOY_ROLE_ARN`, `AWS_SPA_BUCKET`, optional `AWS_CLOUDFRONT_DISTRIBUTION_ID`). |
| ✅ | `client/src/api/http.ts`: Base-URL aus `VITE_API_BASE_URL` umgesetzt (`buildApiUrl()`), genutzt für REST + SSE (`client/src/realtime/realtimeClient.ts`). Neues `client/.env.example` dokumentiert den Cutover-Pfad. |
| ✅ | Bestandsdaten-Migration: nicht mehr Teil des aktiven Projekt-Workflows. Das Projekt ist vollständig auf PostgreSQL standardisiert (Seeds/Clear/Test-Clear laufen ausschließlich gegen Postgres). |
| ⬜ | DNS-Cutover: TTL 24 h → 60 s vor Switch, dann Route 53 umstellen. |
| ⬜ | Alte Ansible-VM 14 Tage warmhalten als Rollback. |

### Phase 7 — Aufräumen & Dokumentation

| | Schritt |
| - | ------- |
| ⬜ | `ansible/` archivieren oder löschen. |
| ✅ | `AGENTS.md` aktualisiert — neue lokale DB-Befehle (`db:init`/`db:start`/`db:status`/`db:stop`), SSE- und Infra-Pfade synchronisiert. |
| 🔄 | `README.md` weiter schärfen: Production-Setup final auf CDK/AWS-Credentials zuschneiden (lokaler Dev-Teil ist aktualisiert). |
| ✅ | `server/.env.example` reduziert und geschärft: historische/Phasen-Kommentare entfernt, klare Local-vs-AWS Adapter-Hinweise ergänzt. |
| ✅ | WS-bezogene Dokumentationsteile weitgehend ersetzt; Realtime-Doku basiert auf SSE (`/api/sse`). |

---

### Empfohlene Reihenfolge der ersten konkreten Commits

1. **Diese Datei + `docker-compose.yml` + Phase-0-Konfig** — Setup-Kompass + Voraussetzungen für lokales Entwickeln (✅ in Arbeit).
2. **Phase 1 (Postgres-Provider + Migration-Baseline)** — funktioniert lokal end-to-end, alle Tests grün (🔄 Code-Änderungen committable, manuelle Migration nach Docker-Install).
3. **Phase 2 (State-Adapter + WS→SSE-Umbau)** — größter Code-Umbau, komplett lokal-getestet, **noch ohne Cloud-Code**.
4. **Phase 3 (Lambda-Wrapper + SAM Local)** — `npm run dev:lambda` startet den vollständigen Lambda-Stack lokal.
5. **Phase 4 (CDK-Stacks)** — erst dann gegen Dev-Account deployen.
6. **Phase 5–7** danach iterativ.
