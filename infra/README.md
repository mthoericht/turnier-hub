# Infra (AWS CDK) – Turnier-Hub

Zentrale Anleitung für AWS/CDK: Architektur, Deployment, Post-Deploy-Smoke-Tests,
DNS-Cutover und Performance-Probes. Cognito-Details (Adapter, Trigger, Cutover-Phasen):
[`doc/AUTH_MIGRATION.md`](../doc/AUTH_MIGRATION.md).

## Architektur (Kurz)

```
Browser (SPA)
    │  HTTPS
    ▼
CloudFront (+ WAF)
    ├── /*           → S3 (SPA, privat + OAC)
    ├── /api/*       → api-Lambda Function URL (Express via serverless-http)
    └── /api/sse     → sse-Lambda Function URL (Response Streaming, SSE)

api/sse-Lambdas (VPC) ──► RDS PostgreSQL + RDS Proxy (Prisma)
                       ──► DynamoDB (realtime_events, rate_limit)
                       ──► Secrets Manager (DB, INVITE_CODE, JWT_SECRET)

Signup/Login ──► Cognito User Pool (+ PreSignUp / PostConfirmation Trigger-Lambdas)
                 ──► RDS User-Zeile (cognitoSub, Rolle in Postgres)
```

| Entscheidung | Wert |
| ------------ | ---- |
| IaC | AWS CDK (TypeScript), Workspace `infra/` |
| Region | `eu-central-1` (Frankfurt) |
| Edge | CloudFront + S3, **kein** API Gateway |
| API | Lambda Function URLs + CloudFront OAC (SigV4) |
| Realtime | SSE (`GET /api/sse`), kein WebSocket |
| DB | RDS PostgreSQL 16 + RDS Proxy |
| Auth (AWS) | Cognito; App-Rollen weiter in Postgres (`User.role`) |
| Lokale Entwicklung | Express + lokales Postgres (`npm run dev`), Auth `local` |

Stack-Reihenfolge: `network` → `data` → `cognito` → `lambda` → `edge` → `observability`
(optional `certificate` in `us-east-1` bei Custom Domain).

## Stacks (`bin` / `lib`)

| Stack | Inhalt |
| ----- | ------ |
| `network` | VPC (public / private-app / private-db), NAT, App-SG (`*-lambda-sg`) |
| `data` | RDS + Proxy, DynamoDB (`realtime-events`, `rate-limit`), Secrets (JWT, Invite, DB) |
| `cognito` | User Pool, SPA-Client, PreSignUp + PostConfirmation Lambdas |
| `lambda` | `api`, `sse`, `migrate` (Placeholder) + Function URLs |
| `edge` | S3 Site-Bucket, CloudFront, WAF, optional Route53 |
| `observability` | CloudWatch Alarme, SNS, Security-Metric-Filter |
| `certificate` | optional ACM in `us-east-1` für CloudFront-Custom-Domain |

Details pro Datei: `bin/infra.ts`, `lib/*.ts`.

## Voraussetzungen

- Node.js `>=22`, `npm install` im **Repo-Root**
- AWS CLI + **Session Manager Plugin** (für RDS-Port-Forward)
- CDK-Bootstrap (einmalig je Account/Region):
  - `eu-central-1` (Hauptregion)
  - `us-east-1` nur bei neuem ACM-Zertifikat für CloudFront

## Umgebungsvariablen (CDK)

Minimal:

```bash
export AWS_PROFILE=turnier-dev          # oder CDK_DEFAULT_ACCOUNT + CDK_DEFAULT_REGION
export CDK_DEFAULT_REGION=eu-central-1
export TURNIER_HUB_STAGE=dev            # dev | staging | prod
```

Optional Custom Domain:

- `TURNIER_HUB_DOMAIN_NAME`, `TURNIER_HUB_HOSTED_ZONE_DOMAIN`
- `TURNIER_HUB_ACM_CERTIFICATE_ARN` (bestehendes Cert statt Neuerstellung)

Optional Secret-Namen:

- `TURNIER_HUB_JWT_SECRET_NAME` (Default: `/turnier-hub/dev/jwt-secret`)
- `TURNIER_HUB_INVITE_CODE_SECRET_NAME` (Default: `/turnier-hub/dev/invite-code`)

Ressourcen: `turnier-hub-<stage>-<layer>` (`TURNIER_HUB_PROJECT` default `turnier-hub`).

---

## 1) CDK deployen

```bash
npm install
export AWS_PROFILE=turnier-dev
export TURNIER_HUB_STAGE=dev
export CDK_DEFAULT_REGION=eu-central-1

npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/eu-central-1
# bei neuem ACM für CloudFront zusätzlich us-east-1 bootstrappen

npm run cdk:check
npm run cdk:synth
npm run cdk:diff
npm run cdk:deploy
```

### Stack-Outputs

Nach Deploy: `npm run smoke:outputs` (oder CloudFormation-Konsole).

| Output | Stack | Verwendung |
| ------ | ----- | ---------- |
| `UserPoolIdOutput` | cognito | SPA `VITE_COGNITO_USER_POOL_ID`, Lambda `COGNITO_USER_POOL_ID` |
| `UserPoolClientIdOutput` | cognito | SPA `VITE_COGNITO_CLIENT_ID`, Lambda `COGNITO_CLIENT_ID` |
| `CloudFrontDomain` | edge | SPA `VITE_API_BASE_URL` |
| `SiteBucketName` | edge | `smoke:deploy-spa`, GitHub SPA-Workflow |
| `CloudFrontDistributionId` | edge | CloudFront-Invalidierung |
| `DbProxyEndpoint` | data | Schema-Apply, `smoke:database-url` |
| `DatabaseSecretArn` | data | `smoke:database-url` |
| `ApiFunctionUrlOutput` / `SseFunctionUrlOutput` | lambda | Direkt-Tests (optional) |
| `AlarmTopicArn` | observability | Alarm-Fanout |

api/sse-Lambdas laufen mit `AUTH_VERIFIER=cognito` und erhalten Cognito-IDs aus dem Cognito-Stack.

---

## 2) Post-Deploy: Smoke-Hilfsskripte

Alle Befehle vom **Repo-Root** (gleiche AWS-Env wie §1).

| Befehl | Zweck |
| ------ | ----- |
| `npm run smoke:preflight` | Stacks, Outputs, Invite-Secret prüfen |
| `npm run smoke:preflight -- --probe` | zusätzlich HTTP: CloudFront `/` + `/api/auth/schools` |
| `npm run smoke:outputs` | Cognito-IDs, CloudFront-URL, S3-Bucket |
| `npm run smoke:outputs -- --write-env` | schreibt `client/.env.production.local` |
| `npm run smoke:outputs -- --json` | JSON-Ausgabe |
| `npm run smoke:invite` | Einladungscode aus Secrets Manager |
| `npm run smoke:database-url` | `DATABASE_URL` für Prisma |
| `npm run smoke:port-forward-cmd -- --instance-id i-xxx` | SSM-Tunnel-Befehl zum RDS Proxy |
| `npm run smoke:build-spa` | Cognito-Env + Client-Build |
| `npm run smoke:deploy-spa -- --yes` | S3-Sync + CloudFront-Invalidierung |
| `npm run db:promote-admin -- --email user@example.com --yes` | Admin-Rolle setzen |

**Typischer Ablauf:**

```bash
npm run smoke:preflight -- --probe
npm run smoke:invite
# → §3 RDS-Schema (SSM-Tunnel)
npm run smoke:build-spa
npm run smoke:deploy-spa -- --yes
# → §5 Auth-Smoke im Browser
npm run db:promote-admin -- --email 'admin@example.com' --yes
```

Skripte: `scripts/aws-smoke-*.mjs`. SPA alternativ via `.github/workflows/spa-deploy.yml`
(`deploy_to_aws=true`, Secrets siehe [`.github/workflows/README.md`](../.github/workflows/README.md)).

---

## 3) RDS-Schema anwenden (einmalig, blockierend)

Die **`migrate`-Lambda ist ein No-Op-Placeholder** — ohne manuelles Schema schlägt
`PostConfirmation` fehl.

RDS ist privat; vom Laptop per **SSM Port-Forward** (kein Bastion im CDK):

### Jump Host (einmalig pro Stage)

1. IAM-Rolle: `AmazonSSMManagedInstanceCore`
2. EC2 (Amazon Linux 2023, `t4g.micro`):
   - VPC: `VpcId` aus `turnier-hub-<stage>-network`
   - Subnet: **`private-app`**
   - Security Group: **`turnier-hub-<stage>-lambda-sg`**
3. Instanz in SSM als **Online** warten

### Tunnel + Schema

```bash
# Terminal 1 (blockiert bis Ctrl+C):
npm run smoke:port-forward-cmd -- --instance-id i-0123456789abcdef0

# Terminal 2:
npm run smoke:database-url
DATABASE_URL="postgresql://USER:PASS@127.0.0.1:15432/turnier?schema=public&sslmode=require" \
  npm run db:deploy
```

Optional: `psql "$DATABASE_URL" -c '\dt'`. Gleicher Tunnel für `db:promote-admin`.

**SSM-Tunnel Troubleshooting**

| Symptom | Ursache |
| ------- | ------- |
| `Target not connected` | SSM noch nicht online / fehlende IAM-Rolle |
| `db:deploy` timeout | Tunnel nicht aktiv, falsches `LOCAL_PORT`, falsches Subnet/SG |
| SSL-Fehler | `sslmode=require` beibehalten (Proxy erzwingt TLS) |

Alternativ: `prisma db push` aus einer One-off-Task in der VPC (nicht skriptiert).

**Schools:** Erster Signup braucht keine vorbefüllte Schule — `PostConfirmation` legt
`defaultSchool` an. Für benannte Schulen im Dropdown vorher `School`-Zeilen anlegen.

---

## 4) SPA bauen und ausliefern

```bash
npm run smoke:build-spa
npm run smoke:deploy-spa -- --yes
```

SPA und API unter **derselben CloudFront-Domain** (Same-Origin). Amplify spricht Cognito
direkt an — kein CORS-Problem für den Auth-Flow.

Build-Env aus `smoke:outputs`: `VITE_AUTH_PROVIDER=cognito`, `VITE_COGNITO_*`,
`VITE_API_BASE_URL=https://<CloudFrontDomain>`.

---

## 5) Auth-Smoke-Test (Browser)

`https://<CloudFrontDomain>` — in dieser Reihenfolge:

1. **Signup** — frische E-Mail, Passwort (≥8, Groß/Klein/Ziffer), Invite-Code
   (`smoke:invite`), Username.
   - Falscher Code → „Ungültiger Einladungscode" (PreSignUp-Lambda)
   - Gültiger Code → Bestätigungsschritt
2. **Confirm** — E-Mail-Code → Auto-Login
3. **Login** — Logout, erneut anmelden → Token in `localStorage` (`turnier_hub_token`),
   `/api/auth/me` liefert Profil
4. **RDS-User** (mit Tunnel + `psql`):
   ```sql
   SELECT id, email, username, "cognitoSub", "schoolId", role
   FROM "User" WHERE email = '<test-email>';
   ```
   Erwartung: Zeile mit `cognitoSub`, `role = USER`
5. **SSE** — zweiter Tab: Turnier anlegen → erster Tab aktualisiert live
6. **Admin** — `db:promote-admin` → Re-Login → `/admin` in der Navigation

Der „Mindestens ein Admin"-Schutz in `routes/admin.ts` verhindert Demotion des letzten Admins.

---

## 6) DNS / Custom-Domain-Cutover

Voraussetzungen vor Deploy:

- `TURNIER_HUB_DOMAIN_NAME`, `TURNIER_HUB_HOSTED_ZONE_DOMAIN` gesetzt
- Zertifikat: `TURNIER_HUB_ACM_CERTIFICATE_ARN` **oder** auto ACM in `us-east-1`

**Cutover:**

1. **24 h vorher:** DNS-TTL auf `60` reduzieren; Rollback-Ziel dokumentieren
2. `npm run cdk:deploy` mit Domain-Env
3. Route53-Alias auf neue CloudFront-Distribution (CDK legt Record an, wenn Zone gesetzt)
4. Propagation von mindestens zwei Netzwerken prüfen

**Validierung nach Switch:**

- `GET /api/auth/me` (401/200)
- Login im Browser auf Zieldomain
- SSE: `text/event-stream`, Events nach Mutationen, Reconnect nach Refresh
- CloudWatch-Alarme `OK`, WAF-Traffic ohne Block-Spike, Security-Metric-Filter aktiv

**Rollback:** DNS auf vorheriges Ziel zurück; altes Ziel bis Stabilisierung warm halten.

---

## 7) SSE-Performance / DynamoDB-Kapazität

Ziel: Entscheidung **on-demand** vs. **provisioned** für `realtime_events`.

Voraussetzungen: `EVENT_BUS=dynamo`, `RATE_LIMIT_STORE=dynamo` in Lambda; gültiger Login-User.

**Baseline (100 parallele SSE-Verbindungen, 120 s):**

```bash
PERF_BASE_URL="https://<CloudFrontDomain>" \
PERF_LOGIN_EMAIL="<email>" \
PERF_LOGIN_PASSWORD="<password>" \
npm run perf:sse
```

**Mit Schreiblast (1 Mutation/s):**

```bash
PERF_BASE_URL="https://<domain>" \
PERF_LOGIN_EMAIL="<email>" PERF_LOGIN_PASSWORD="<password>" \
PERF_SSE_PUBLISH_URL="/api/<safe-mutation-endpoint>" \
PERF_SSE_PUBLISH_METHOD="POST" \
PERF_SSE_PUBLISH_BODY='{}' \
PERF_SSE_PUBLISH_INTERVAL_MS=1000 \
npm run perf:sse
```

CloudWatch prüfen (`realtime_events`, ggf. `rate_limit`):

- `ConsumedReadCapacityUnits` / `ConsumedWriteCapacityUnits`
- `ReadThrottleEvents` / `WriteThrottleEvents`
- Lambda `Duration` p95/p99, `Errors`, `Throttles`

**On-demand** wenn keine Throttles und bursty/unvorhersehbar. **Provisioned + Auto Scaling**
bei planbaren Peaks, wiederholter hoher Last oder Throttling trotz Tuning.

Ergebnis protokollieren: Timestamp, Stage, Connections/Duration, Metriken, Empfehlung.

---

## Migrations-Status (Stand Codebase)

| Bereich | Status |
| ------- | ------ |
| Postgres lokal + Tests | ✅ |
| WS → SSE, Memory/Dynamo-Adapter | ✅ |
| Lambda-Handler, CDK-Stacks | ✅ |
| Secrets Bootstrap, Cognito | ✅ |
| `migrate`-Lambda / Auto-Schema | ⬜ Placeholder |
| Dynamo SSE Fan-Out in Cloud | 🔄 Code da, Verifikation offen |
| GitHub SPA-Deploy | 🔄 Workflow da, Secrets setzen |

Lokal: **`npm run dev`**. Optional: **`npm run dev:lambda`** (SAM, siehe Root-`README.md`).

---

## Häufige Probleme

| Symptom | Prüfen |
| ------- | ------ |
| `Unable to resolve AWS account` | `AWS_PROFILE` / `CDK_DEFAULT_*` |
| Signup: Invite-Fehler | `smoke:invite`; Logs `/aws/lambda/turnier-hub-<stage>-cognito-pre-signup` |
| Confirm OK, kein DB-User | Schema §3; Logs `...-cognito-post-confirmation` |
| `/api/auth/me` 401 | Cognito-IDs Lambda vs. SPA (`smoke:outputs`) |
| SSE verbindet nicht | CF Behavior `api/sse`, sse `RESPONSE_STREAM` |
| `db:deploy` timeout | SSM-Tunnel §3 |

---

## Teardown (Throwaway-Stages)

```bash
cd infra && npx cdk destroy --all
```

S3-Bucket (`RETAIN`) und RDS (`SNAPSHOT`) ggf. manuell löschen.

---

## CDK-Befehle (Referenz)

| Befehl | Beschreibung |
| ------ | ------------ |
| `npm run cdk:check` | Preflight |
| `npm run cdk:synth` | Synth + Bundling |
| `npm run cdk:diff` | Diff |
| `npm run cdk:deploy` | Deploy aller Stacks |
