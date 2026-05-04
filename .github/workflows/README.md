# GitHub Workflows

This folder defines **GitHub Actions** workflows for **turnier-hub**. Unless noted, jobs use **GitHub-hosted** `ubuntu-latest` runners.

**CI does not use your AWS account.** Integration tests spin up an **ephemeral PostgreSQL 16 service container** inside the job. The only workflow that can touch AWS is **`spa-deploy.yml`**, and only when the **`deploy_to_aws`** input is `true`.

### Workflow index

| Workflow | When it runs | AWS / repo secrets |
| -------- | ------------ | ------------------ |
| [`client-build.yml`](client-build.yml) | Push / PR to `main` or `master`; `workflow_dispatch` | None |
| [`test.yml`](test.yml) | Push / PR to `main` or `master`; `workflow_dispatch` | None (Postgres + `server/.env.test` are created in the job) |
| [`security-audit.yml`](security-audit.yml) | Push / PR to `main` or `master`; weekly schedule; `workflow_dispatch` | None |
| [`spa-deploy.yml`](spa-deploy.yml) | `workflow_dispatch` only | Optional: OIDC role, S3 bucket, CloudFront distribution (see below) |

### Actions minutes / billing

Each run consumes **GitHub Actions minutes** according to your plan (for example monthly allowances on private repos; public repos typically use standard Linux runners without a per-minute charge subject to [GitHub’s policies](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions)). Service containers (Postgres) run on the same runner as the job and count toward that job’s duration.

---

## `spa-deploy.yml` (manual SPA deploy to AWS)

Builds the Vue client and can optionally deploy the artifact to AWS S3.

### Trigger

- `workflow_dispatch` only (manual run in GitHub Actions UI)

### Inputs

- `environment` (default: `dev`): GitHub Environment name
- `deploy_to_aws` (default: `false`): controls whether AWS deploy steps run
- `invalidate_cloudfront` (default: `true`): controls CloudFront invalidation after upload

`deploy_to_aws` is the main safety switch. If set to `false`, the workflow only builds and does not touch AWS.

### Required AWS setup (only when `deploy_to_aws=true`)

- Repository/Environment secret: `AWS_DEPLOY_ROLE_ARN`
- Repository/Environment secret: `AWS_SPA_BUCKET`
- Optional secret: `AWS_CLOUDFRONT_DISTRIBUTION_ID` (only needed for invalidation)
- Optional variable: `AWS_REGION` (defaults to `eu-central-1`)
- OIDC trust configured in AWS for `aws-actions/configure-aws-credentials`

### Notes

- CloudFront invalidation runs only if:
  - `deploy_to_aws == true`
  - `invalidate_cloudfront == true`
  - `AWS_CLOUDFRONT_DISTRIBUTION_ID` is non-empty

## `security-audit.yml` (dependency security checks)

Runs `npm run security:audit` to detect vulnerable dependencies.

### Triggers

- Push to `main` or `master`
- Pull requests targeting `main` or `master`
- Weekly schedule (`Monday 04:00 UTC`)
- Manual dispatch

## `client-build.yml` (CI client bundle, no AWS)

Runs `npm ci` at the repo root and `npm run build -w client`. The `@turnier-hub/shared` workspace builds during install via its `prepare` script. No credentials, no S3, no CloudFront.

### Triggers

- Push to `main` or `master`
- Pull requests targeting `main` or `master`
- Manual dispatch

### Concurrency

In-progress runs for the same branch are cancelled when a newer commit arrives (`cancel-in-progress: true`).

## `test.yml` (root `npm test`)

Runs the same command as locally: `npm test` → server Vitest, then client Vitest (including Storybook browser tests, which need Chromium).

### Triggers

- Push to `main` or `master`
- Pull requests targeting `main` or `master`
- Manual dispatch

### CI services and setup

- **PostgreSQL 16** service container (`turnier` / `turnier_test`), published to the runner on **`localhost:5432`**
- **`server/.env.test`** is generated in the workflow so `dotenv -e .env.test` matches local test runs
- **`npm run test:prepare -w server`** applies the schema to the test DB (`prisma db push`)
- **`npx playwright install chromium --with-deps`** in `client/` (Playwright dependency lives in the client workspace)

No repository secrets are required for this workflow.
