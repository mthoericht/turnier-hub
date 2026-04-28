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
| Lokale Entwicklung | **Lambda lokal lauffähig** via SAM CLI + Docker Compose (Postgres + DynamoDB-Local) |

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
| SQLite | `server/prisma/schema.prisma` (`provider = "sqlite"`) | → RDS PostgreSQL. |
| SPA-Auslieferung | `server/src/app.ts` → `express.static(clientDist)` | Kostet Lambda-Zeit und Geld. → S3 + CloudFront. |
| Secrets via `.env` | `server/src/config.ts`, Ansible `server.env.j2` | → Secrets Manager + Lambda Env-Vars. |
| Long-running Listener | `server/src/index.ts` (`server.listen`, `attachToServer`) | Bleibt im **lokalen Dev-Modus** erhalten; in AWS ersetzt durch Lambda-Handler. |

### Antworten auf die Aufgaben aus dem Brief

1. **AWS-Integration generell.** Möglich. Code ist sauber strukturiert (klare Service-Schicht, dünne Routes), Express-App lässt sich via `serverless-http` quasi unverändert in Lambda packen. Großer Umbau betrifft Realtime-Hub und alle In-Memory-State-Stellen.
2. **Datenbank/Schema übertragen.** Schema ist Prisma-portabel: `provider = "sqlite"` → `provider = "postgresql"` reicht von Prisma-Seite. Prod-Daten müssen einmalig per Skript migriert werden (oder Re-Seed bei kleinem Bestand). **Vorher Prisma-Migration-Baseline einführen** — aktuell wird `db push` verwendet, das ist für Postgres in Prod nicht ratsam.
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
| ✅ | `docker-compose.yml` im Repo-Root angelegt (Postgres + DynamoDB-Local). |
| ✅ | Root-Skripte `docker:up` / `docker:down` ergänzt. |
| ⬜ | `npm run dev:lambda` Skript planen (Stub jetzt, Vollausbau in Phase 3). |
| ✅ | Diese Datei als Source-of-Truth gepflegt. |

### Phase 1 — Postgres-Migration (lokal, noch keine Cloud)

| | Schritt |
| - | ------- |
| ✅ | `server/prisma/schema.prisma`: `provider = "postgresql"` (Schema bleibt Prisma-portabel; Enums werden Postgres-nativ generiert). |
| ✅ | `server/.env.example`: `DATABASE_URL=postgresql://turnier:turnier@localhost:5432/turnier_dev`. |
| ✅ | `server/.env.test`: `DATABASE_URL=postgresql://turnier:turnier@localhost:5432/turnier_test`. |
| ✅ | `server/package.json`: `db:deploy` auf `prisma migrate deploy` umgestellt; neues Skript `db:migrate` für `prisma migrate dev`. |
| ⚠️ | **Initiale Prisma-Migration erzeugen** (`npm run db:migrate -- --name init`). Blockiert: erfordert laufenden Docker-Compose-Postgres. |
| ⚠️ | Test-DB-Schema anwenden (`npm run db:push:test` bzw. neues `db:migrate:test`). Blockiert wie oben. |
| ⚠️ | Tests grün halten (`npm run test`). Blockiert wie oben. |
| ⬜ | `tests/server/helpers/db.ts`: aktuell Truncate-basiert (funktioniert mit Postgres unverändert). Optional in Folge-PR auf Testcontainers umstellen für CI-Parallelisierung. |
| ⬜ | Ansible-Templates (`ansible/roles/turnier_hub/templates/server.env.j2`, `db:deploy`-Aufrufe) als „Legacy" markieren oder entfernen — tun wir gesammelt in Phase 7. |
| ⬜ | **PR-Grenze:** funktioniert lokal end-to-end mit Postgres, alle Tests grün, ohne dass AWS-Code im Repo ist. |

> **Manuelle Schritte für dich, sobald Docker installiert ist:**
> 1. `npm run docker:up` (startet Postgres + DynamoDB-Local)
> 2. `npm run db:migrate -- --name init` (erzeugt erste Migration in `server/prisma/migrations/` und wendet sie auf Dev-DB an)
> 3. `npm run db:push:test` (wendet Schema auf Test-DB an)
> 4. `npm run db:seed` (Demo-Daten in Dev-DB)
> 5. `npm run test` (Backend-Tests gegen lokale Postgres)
> 6. `npm run dev` (Smoke-Test der App)

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
| ⬜ | Manuell verifizieren (Docker erforderlich): `npm run docker:up && npm run dev` — Browser öffnen, Login + Match-Score-Update zeigt SSE-Push live. |
| ⬜ | Manuell verifizieren: `npm run test:integration` (Client-Integration-Tests gegen Test-Postgres). |
| ⬜ | **PR-Grenze:** funktioniert lokal end-to-end **ohne `ws`**, mit SSE, mit Memory-Adaptern. |

### Phase 3 — Lambda-Wrapper + lokaler Lambda-Stack

| | Schritt |
| - | ------- |
| ⬜ | `serverless-http` als Dependency hinzufügen. |
| ⬜ | Neuer Ordner `server/src/lambda/`: `httpHandler.ts` (`serverless-http(createApp())`), `sseHandler.ts` (mit `awslambda.streamifyResponse`), `migrateHandler.ts` (optional). |
| ⬜ | CDK initial: lokale `template.json` über `cdk synth` generieren; SAM-CLI nutzt diese. |
| ⬜ | `npm run dev:lambda` Skript: startet Docker Compose, wartet auf Postgres-Health, läuft `prisma migrate deploy`, startet `sam local start-lambda` parallel. |
| ⬜ | **PR-Grenze:** Lambda-Wrapper laufen lokal über SAM, REST + SSE end-to-end gegen lokale Postgres + DynamoDB-Local. |

### Phase 4 — CDK-Stacks für Cloud-Deploy

| | Schritt |
| - | ------- |
| ⬜ | **`NetworkStack`**: VPC mit private Subnets für RDS + Lambda, NAT Gateway (Single AZ für Kostenkontrolle), Security Groups. |
| ⬜ | **`DataStack`**: RDS PostgreSQL (`db.t4g.micro` Dev), RDS Proxy, DynamoDB-Tabellen (`realtime_events`, `rate_limit`, `login_lockout`), Secrets Manager. |
| ⬜ | **`LambdaStack`**: `api`-Lambda + Function URL (`AuthType: AWS_IAM`), `sse`-Lambda + Function URL (`InvokeMode: RESPONSE_STREAM`, `AuthType: AWS_IAM`), `migrate`-Lambda + Custom Resource. VPC-Attached, IAM-Rollen. |
| ⬜ | **`EdgeStack`**: S3-Bucket (privat, OAC), CloudFront-Distribution mit drei Behaviors (`/api/sse` → SSE-Function-URL mit OAC; `/api/*` → API-Function-URL mit OAC; `/*` → S3 mit SPA-Fallback). WAFv2-WebACL, ACM-Zertifikat in `us-east-1`, Route 53 Alias. |
| ⬜ | CDK-Pipeline (optional): `aws-cdk-lib/pipelines.CodePipeline` mit GitHub-Source. |
| ⬜ | **PR-Grenze:** `cdk deploy` baut den vollen Stack in Dev-Account auf, Smoke-Test mit `curl` gegen Custom Domain liefert Login + SSE. |

### Phase 5 — State-Adapter auf AWS schalten + Observability

| | Schritt |
| - | ------- |
| ⬜ | Lambda-Env: `RATE_LIMIT_STORE=dynamo`, `LOCKOUT_STORE=dynamo`, `EVENT_BUS=dynamo`. |
| ⬜ | Performance-Test: 100 parallele SSE-Verbindungen, 1×/s Polling → DynamoDB Capacity (on-demand vs. provisioned) entscheiden. |
| ⬜ | CloudWatch-Alarms scharfschalten: Lambda Errors > 1 % / 5 min, Lambda Throttles > 0, RDS CPU > 80 %, RDS Connections > 80 % vom Max, WAF blocked > Schwelle, Custom Metric Filter für `category:security`. |

### Phase 6 — Frontend & Daten-Cutover

| | Schritt |
| - | ------- |
| ⬜ | Build-Pipeline für SPA: `npm run build -w client` → S3-Sync via CDK Deploy oder GitHub-Action. |
| ⬜ | `client/src/api/http.ts`: Base-URL aus `VITE_API_BASE_URL`, in Prod auf eigene Domain zeigen. |
| ⬜ | Bestandsdaten-Migration (falls relevant): einmaliges Skript `server/scripts/migrateSqliteToPostgres.ts`. |
| ⬜ | DNS-Cutover: TTL 24 h → 60 s vor Switch, dann Route 53 umstellen. |
| ⬜ | Alte Ansible-VM 14 Tage warmhalten als Rollback. |

### Phase 7 — Aufräumen & Dokumentation

| | Schritt |
| - | ------- |
| ⬜ | `ansible/` archivieren oder löschen. |
| ⬜ | `AGENTS.md` aktualisieren — neue `cdk:*`/`dev:lambda`-Befehle, neue `infra/`-Pfade, WS-Erwähnungen durch SSE ersetzen. |
| ⬜ | `README.md` Production-Setup-Sektion komplett neu schreiben (CDK-Deploy, AWS-Account-Anforderungen). |
| ⬜ | `server/.env.example` final reduzieren. |
| ⬜ | WS-bezogene Dokumentationsteile (WebSocket-Abschnitt, `/api/ws`-Erwähnungen) durch SSE-Pendants ersetzen. |

---

### Empfohlene Reihenfolge der ersten konkreten Commits

1. **Diese Datei + `docker-compose.yml` + Phase-0-Konfig** — Setup-Kompass + Voraussetzungen für lokales Entwickeln (✅ in Arbeit).
2. **Phase 1 (Postgres-Provider + Migration-Baseline)** — funktioniert lokal end-to-end, alle Tests grün (🔄 Code-Änderungen committable, manuelle Migration nach Docker-Install).
3. **Phase 2 (State-Adapter + WS→SSE-Umbau)** — größter Code-Umbau, komplett lokal-getestet, **noch ohne Cloud-Code**.
4. **Phase 3 (Lambda-Wrapper + SAM Local)** — `npm run dev:lambda` startet den vollständigen Lambda-Stack lokal.
5. **Phase 4 (CDK-Stacks)** — erst dann gegen Dev-Account deployen.
6. **Phase 5–7** danach iterativ.
