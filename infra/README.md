# Infra (AWS CDK) – Turnier-Hub

Diese Dokumentation beschreibt den Inhalt des `infra/`-Workspaces und zeigt Schritt für Schritt, wie du die Infrastruktur in AWS bereitstellst.

## Überblick

Der CDK-Teil erzeugt die Zielarchitektur für:

- CloudFront + S3 (SPA-Auslieferung)
- Lambda Function URLs (REST + SSE)
- RDS PostgreSQL + RDS Proxy
- DynamoDB (Realtime/Rate-Limit/Lockout)
- WAF + CloudWatch Alarme
- optional Route53 + ACM (Custom Domain)

## Struktur (`bin` / `lib`)

- `bin/infra.ts`
  - Einstiegspunkt der CDK-App.
  - Lädt Umgebungswerte über `loadConfig()`.
  - Instanziiert und verbindet alle Stacks in sinnvoller Reihenfolge.

- `lib/config.ts`
  - Zentrale Konfigurationsauflösung aus Env-Variablen.
  - Enthält Projekt-/Stage-/Region-/Domain-/Secret-Namen.

- `lib/network-stack.ts`
  - VPC (public/private/isolated Subnets), NAT Gateway, App Security Group.

- `lib/data-stack.ts`
  - RDS PostgreSQL + RDS Proxy.
  - DynamoDB-Tabellen (`realtime-events`, `rate-limit`, `login-lockout`).
  - Secrets Manager Secrets (JWT, Invite-Code, DB-Credentials).

- `lib/lambda-stack.ts`
  - App-Lambdas (`api`, `sse`, `migrate`).
  - Function URLs + Runtime-Env.
  - IAM-/Permission-Wiring für CloudFront→Function URL Zugriff.

- `lib/edge-stack.ts`
  - CloudFront Distribution + S3-Bucket + WAF.
  - Behaviors für `/api/*` und `/api/sse`.
  - Origin Access Control (S3 + Lambda Function URL SigV4).
  - optional DNS-Record in Route53.

- `lib/certificate-stack.ts`
  - Optionales ACM-Zertifikat in `us-east-1` für CloudFront-Custom-Domain.
  - DNS-Validierung über Hosted Zone.

- `lib/observability-stack.ts`
  - CloudWatch Alarme (Lambda, RDS, WAF, Security-Metric-Filter).
  - SNS Topic für Alarm-Fanout.

## Voraussetzungen

- Node.js `>=22`
- npm Workspaces (Install im Repo-Root)
- AWS CLI konfiguriert (z. B. via `AWS_PROFILE`)
- CDK-Bootstrap im Zielaccount/Region(en):
  - `eu-central-1` (Hauptregion)
  - `us-east-1` (nur wenn ACM-Cert für CloudFront erzeugt wird)

## Wichtige Env-Variablen

Minimal:

- `TURNIER_HUB_STAGE` (z. B. `dev`, `staging`, `prod`)
- `AWS_PROFILE` **oder** `CDK_DEFAULT_ACCOUNT` + `CDK_DEFAULT_REGION`

Optional (Custom Domain):

- `TURNIER_HUB_DOMAIN_NAME` (z. B. `turnier.example.com`)
- `TURNIER_HUB_HOSTED_ZONE_DOMAIN` (z. B. `example.com`)
- `TURNIER_HUB_ACM_CERTIFICATE_ARN` (falls bestehendes Cert genutzt werden soll)

Optional (Secrets-Namen):

- `TURNIER_HUB_JWT_SECRET_NAME`
- `TURNIER_HUB_INVITE_CODE_SECRET_NAME`

## Beispiel-Env (Copy/Paste)

Minimal (ohne Custom Domain):

```bash
export AWS_PROFILE=turnier-dev
export CDK_DEFAULT_REGION=eu-central-1
export TURNIER_HUB_STAGE=dev
```

Mit Custom Domain + automatischem ACM in `us-east-1`:

```bash
export AWS_PROFILE=turnier-dev
export CDK_DEFAULT_REGION=eu-central-1
export TURNIER_HUB_STAGE=dev
export TURNIER_HUB_DOMAIN_NAME=turnier.example.com
export TURNIER_HUB_HOSTED_ZONE_DOMAIN=example.com
```

Mit bestehendem ACM-Zertifikat:

```bash
export AWS_PROFILE=turnier-dev
export CDK_DEFAULT_REGION=eu-central-1
export TURNIER_HUB_STAGE=dev
export TURNIER_HUB_DOMAIN_NAME=turnier.example.com
export TURNIER_HUB_HOSTED_ZONE_DOMAIN=example.com
export TURNIER_HUB_ACM_CERTIFICATE_ARN=arn:aws:acm:us-east-1:<account-id>:certificate/<id>
```

## Schritt-für-Schritt Deployment (AWS)

1. **Dependencies installieren (Repo-Root):**

```bash
npm install
```

2. **AWS-Kontext setzen (Beispiel):**

```bash
export AWS_PROFILE=turnier-dev
export TURNIER_HUB_STAGE=dev
export CDK_DEFAULT_REGION=eu-central-1
```

3. **(Einmalig je Account/Region) CDK bootstrap:**

```bash
npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/eu-central-1
```

Wenn du ein neues ACM-Zertifikat für CloudFront erstellen möchtest, zusätzlich:

```bash
npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/us-east-1
```

4. **Optional Domain-Konfiguration setzen:**

```bash
export TURNIER_HUB_DOMAIN_NAME=turnier.example.com
export TURNIER_HUB_HOSTED_ZONE_DOMAIN=example.com
```

5. **Synthese prüfen:**

```bash
npm run cdk:synth
```

6. **Preflight + Änderungen prüfen:**

```bash
npm run cdk:check
npm run cdk:diff
```

7. **Deployment ausführen:**

```bash
npm run cdk:deploy
```

8. **Outputs prüfen:**

- CloudFront Domain
- API/SSE Function URL Outputs
- Alarm Topic ARN

9. **Nachgelagert:**

- SPA deployen (`.github/workflows/spa-deploy.yml`)
- Edge-/DNS-Cutover gemäß `doc/AWS_EDGE_CUTOVER_CHECKLIST.md`

## Häufige Probleme

- **`Unable to resolve AWS account to use`**
  - `AWS_PROFILE` oder `CDK_DEFAULT_ACCOUNT`/`CDK_DEFAULT_REGION` fehlt.

- **`cdk diff/deploy` ohne Berechtigung**
  - Rolle/Policy für CloudFormation, IAM, Lambda, RDS, DynamoDB, WAF, Route53/ACM prüfen.

- **Domain/Cert wird nicht erstellt**
  - `TURNIER_HUB_DOMAIN_NAME` + `TURNIER_HUB_HOSTED_ZONE_DOMAIN` prüfen.
  - Hosted Zone muss im gleichen AWS-Account auffindbar sein.
