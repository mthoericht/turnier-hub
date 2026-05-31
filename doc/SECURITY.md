# Security

Central security reference for `turnier-hub`.

This file combines:

- the prioritized security backlog/checklist (formerly `SECURITY_TODO.md`)
- the operational runbook (formerly `SECURITY_RUNBOOK.md`)

## Contents

- [Security Checklist](#security-checklist)
- [Security Runbook](#security-runbook)
- [Automated Coverage (Security Tests)](#automated-coverage-security-tests)
- [Production Verification Log](#production-verification-log)
- [Dependency Risk Triage (Current)](#dependency-risk-triage-current)

---

## Trust Boundary and Deployment Model

`turnier-hub` is designed for **single-instance deployment within a trusted cohort** (typically one school or a small group of schools).

### Key assumptions

- **Not multi-tenant isolated.** All authenticated users share the full catalog (classes, players, tournaments). There is no per-school or per-user data isolation beyond creator attribution.
- **Invite-code gate.** Signup requires a shared invite code. If the code leaks, anyone can register. Keep it strong, rotate it when the cohort changes, and treat it as a shared secret.
- **Shared editing.** Any authenticated user may create, read, update, and delete catalog entries and tournament data. The `createdBy` field is informational only.
- **Admin role.** Admin-only operations (school management, user role/school assignment) are gated by the `ADMIN` role. Regular users cannot access `/api/admin` endpoints.

### Deployment guidance

- Deploy behind **TLS** (HTTPS) at all times. The app does not enforce HSTS itself; configure it at the reverse proxy.
- Run as a **single Node.js process** (or switch to shared state backends in distributed setups). In-memory rate limiting, lockout counters, and monitoring state are not shared across processes.
- Do **not** expose the app directly to the public internet without a reverse proxy.
- Treat all authenticated users as trusted collaborators within the deployment scope.

### Auth backend and realtime transport (read first)

- **Pluggable auth (`AUTH_VERIFIER`).** The JWT lifecycle, login lockout, auth
  rate limiting, `tokenVersion`, and `POST /api/auth/revoke-sessions` described
  below apply to the **`local`** verifier (dev, tests, legacy single-VM). In the
  AWS deployment (`AUTH_VERIFIER=cognito`) password hashing, brute-force/lockout
  protection, token issuance, refresh, and revocation are **Cognito-managed**;
  the invite-code gate moves to the Cognito PreSignUp Lambda. See
  [`AUTH_MIGRATION.md`](AUTH_MIGRATION.md).
- **Realtime is SSE, not WebSocket.** The legacy `ws` hub (and its `WS_*` limits)
  was **removed** in the AWS migration (Phase 2). Realtime now uses
  **Server-Sent Events** on `GET /api/sse` — a normal long-lived HTTP response
  authenticated via the same token verifier (`?token=<token>`). WebSocket-specific
  guidance in older revisions no longer applies; the SSE equivalents are noted below.

---

## Security Checklist

Practical checklist for improving security posture in `turnier-hub`.

### P0 - High Priority

- [x] Add auth rate limiting for `POST /api/auth/login` and `POST /api/auth/signup`.
- [x] Restrict CORS to an explicit allowlist (`CORS_ALLOWED_ORIGINS`).
- [x] Add baseline security headers with `helmet`.
- [x] Add configurable JSON request size limit (`JSON_BODY_LIMIT`).
- [x] Make proxy trust explicit (`TRUST_PROXY`) so `req.ip` is reliable behind reverse proxies.
- [ ] Verify production `TRUST_PROXY` value with real deployment path (for many setups: `1` behind Nginx).
- [x] SSE endpoint (`GET /api/sse`) authenticates the token via the active verifier (same as HTTP auth) and cleans up listeners on disconnect.
- [x] ~~WebSocket upgrade validates `tokenVersion` / Origin / fails closed~~ — obsolete: the `ws` hub was removed (realtime is SSE).

### P1 - Medium Priority

- [x] Add progressive backoff / temporary lockout for repeated failed login attempts (`local` verifier; Cognito handles this in AWS).
- [x] Ensure all mutating API routes use strict request validation (field lengths, enums, allowed characters).
- [x] Review JWT lifecycle (`local` verifier):
  - [x] Set and document token expiry policy.
  - [x] Define secret rotation process.
  - [x] Define invalidation strategy for critical events (e.g. password reset).
- [x] Add structured monitoring/alerts for spikes in `401`, `403`, `429` (JSON security logs → CloudWatch Metric Filters in AWS).

### P2 - Ongoing Hardening

- [x] Enable regular dependency security updates (Dependabot/Renovate).
- [x] Add CI security checks (`npm audit` policy, fail threshold for critical issues).
- [x] Add a short operations runbook section for incident response (auth abuse, blocked IPs, secret rotation).

### Quick Verification Checklist (Production)

- [ ] `CORS_ALLOWED_ORIGINS` contains only real frontend origins.
- [ ] `TRUST_PROXY` matches the actual proxy hop topology.
- [ ] `JWT_SECRET` (local mode) and `INVITE_CODE` are strong and injected from secret management.
- [ ] Auth rate limits trigger `429` and include `Retry-After` (local-auth routes).
- [ ] Reverse proxy / CDN forwards `GET /api/sse` as a long-lived response (no buffering, no early timeout).

---

## Security Runbook

Operational playbook for production security checks and incident response.

### Quick Response (5 Minutes)

Use this when active abuse or suspicious auth behavior is ongoing.

1. **Contain**
   - Local auth: tighten `AUTH_LOGIN_MAX_REQUESTS`, `AUTH_IDENTIFIER_MAX_REQUESTS`, `LOGIN_LOCKOUT_*`.
   - Cognito (AWS): tighten the WAF rate-based rules at CloudFront and, if needed, Cognito advanced-security settings.
   - Add temporary reverse-proxy / WAF blocks for abusive sources.
2. **Verify**
   - Confirm `401` -> `429` behavior on `/api/auth/login` (local auth).
   - Confirm security signal logs (`401`/`403`/`429`) appear and `TRUST_PROXY` still matches topology.
3. **Recover**
   - Local auth: if account compromise is suspected, trigger `POST /api/auth/revoke-sessions`; if `JWT_SECRET` exposure is suspected, rotate it and restart all instances.
   - Cognito (AWS): sign out the user globally / reset credentials in the user pool; rotate Cognito app-client settings if needed.
4. **Follow-up**
   - Keep stricter limits until traffic stabilizes.
   - Document what happened and which controls were changed.
   - Revisit thresholds to avoid recurring incidents.

### Scope and Usage

- Use this document for go-live checks, routine hardening reviews, and security incidents.
- Keep the checklist section in this file updated as backlog/source of truth.
- Re-run relevant sections after infrastructure changes (proxy/CDN/load balancer, auth settings).

### Go-Live Minimum Checklist

- `JWT_SECRET` (local mode) and `INVITE_CODE` come from secret management (Secrets Manager in AWS).
- `CORS_ALLOWED_ORIGINS` contains only real frontend origins.
- `TRUST_PROXY` matches real proxy hop topology.
- Auth protection returns `429` + `Retry-After` on repeated failed attempts (local auth) / Cognito + WAF limits active in AWS.
- SSE path `GET /api/sse` works behind reverse proxy / CDN (long-lived response, not buffered).
- Security telemetry logs for HTTP (`401`/`403`/`429`) are visible.

### JWT and Session Model

> Applies to the **`local`** verifier. With `AUTH_VERIFIER=cognito`, token
> issuance/expiry/refresh and revocation are managed by Cognito, not by the
> fields below.

#### Current policy

- Access token validity is `7d` (see `server/src/auth/token.ts`).
- JWT payload includes `tv` (`tokenVersion`).
- `authMiddleware` validates token `tv` against DB `User.tokenVersion`.

#### Session invalidation (critical events)

- Endpoint: `POST /api/auth/revoke-sessions`.
- Behavior: increments `tokenVersion`, returns a fresh token.
- Effect: all previously issued tokens for that user become invalid immediately.

#### Recommended usage

- Revoke sessions after password reset or confirmed account compromise.
- To force full re-authentication on all devices, do not adopt the newly returned token on the initiating device.

#### SSE token transport

- SSE connections authenticate via the token passed as a query parameter (`GET /api/sse?token=<token>`), because `EventSource` cannot set custom headers.
- **Caveat:** query strings may appear in reverse proxy access logs, CDN logs, and browser history.
- **Mitigation:**
  - Configure the reverse proxy / CDN to **not log query strings** for the `/api/sse` path.
  - Ensure TLS is enforced end-to-end so tokens are not exposed in transit.
  - The SSE handler verifies the token via the active verifier on connect; with the `local` verifier the `tokenVersion` check rejects revoked tokens (same as HTTP auth).

### Secret Rotation Playbook

#### JWT secret rotation (local verifier)

1. Generate a new strong secret in the secret manager.
2. Deploy all app instances with new `JWT_SECRET`.
3. Verify new login flow works.
4. Communicate expected session invalidation impact.
5. Monitor `401` spikes post-rollout and ensure recovery.

Note: the `local` verifier uses single-key verification. Rotation invalidates existing tokens globally. For seamless rotation, add multi-key verification (`kid` + active/previous secrets). With `AUTH_VERIFIER=cognito`, key rotation is handled by Cognito's JWKS; no app-side `JWT_SECRET` rotation is required.

### Reverse Proxy and `TRUST_PROXY` Verification

Run this before go-live and after any proxy topology change.

#### Required forwarding headers

- `X-Forwarded-For: $proxy_add_x_forwarded_for`
- `X-Forwarded-Proto: $scheme`
- `Host: $host`

#### Verification steps

1. Set `TRUST_PROXY` to real hop count (typical `1` for Nginx directly in front of Node).
2. Restart the app.
3. Send repeated invalid login attempts to `/api/auth/login`.
4. Confirm:
   - first attempts return `401`,
   - repeated attempts return `429` with `Retry-After`,
   - server-side client IP attribution matches external source addresses.

#### Troubleshooting

- If all requests appear as localhost/proxy IP, fix headers and `TRUST_PROXY` first.
- If limits are too strict/too weak, re-check hop count and upstream layers (CDN/LB).
- Repeat verification after adding/removing proxy layers.

### Incident Playbooks

#### Auth abuse / brute-force

1. Confirm spikes in `401`/`429` and failed login patterns.
2. Local auth: tighten `AUTH_LOGIN_MAX_REQUESTS`, `AUTH_IDENTIFIER_MAX_REQUESTS`, and `LOGIN_LOCKOUT_*`. Cognito (AWS): tighten WAF rate rules / advanced security.
3. Add temporary edge blocks/rate limits on reverse proxy or WAF.
4. Verify `TRUST_PROXY` remains correct during mitigation.

#### SSE abuse / connection flood

1. Confirm spikes in `GET /api/sse` connection counts in proxy/CDN/Lambda logs.
2. Apply reverse-proxy / WAF connection and rate limits specifically for the `/api/sse` path.
3. SSE listeners are cleaned up on disconnect; persistent floods are best mitigated at the edge.

### Monitoring and Alert Signals

- HTTP auth-related spikes: `401`, `403`, `429` (structured JSON security logs; `recordHttpSecurityStatus`).
- SSE signals: sustained growth in concurrent `/api/sse` connections at the edge.
- Alert on sustained spikes, not single events, to reduce noise.

### Automated Coverage (Security Tests)

Current automated tests that cover core security controls:

- `tests/server/unit/appSecurity.test.ts`
  - verifies baseline `helmet` headers (X-Content-Type-Options, X-Frame-Options, X-DNS-Prefetch-Control, X-Download-Options)
  - validates CORS allowlist behavior (allowed origins get `204`; blocked origins get `403`)
  - checks JSON body-size limit enforcement (`413`)
  - verifies no stack trace leakage on internal errors
- `tests/server/unit/sseEndpoint.test.ts`
  - verifies SSE auth, frame routing, and listener cleanup on disconnect over a real HTTP server
- `tests/server/unit/securityMonitoring.test.ts`
  - validates structured security-log emission for HTTP auth-status codes (`401`/`403`/`429`)
- `tests/server/unit/configSecurityGuards.test.ts`
  - validates production config guards (`JWT_SECRET`, `INVITE_CODE`, CORS wildcard rejection)
- `tests/server/unit/cognitoPreSignUp.test.ts` / `cognitoPostConfirmation.test.ts` / `cognitoTokenVerifier.test.ts`
  - validate the Cognito invite-code gate, RDS user provisioning, and access-token → internal-user mapping
- `tests/client/integration/auth.api.test.ts`
  - validates login/signup rate limiting and progressive login lockout (`429` + `Retry-After`), local verifier
  - validates session revocation (`POST /api/auth/revoke-sessions`)

### Production Verification Log

Use this short template to record final go-live checks and support checklist closure.

Checklist:

- `CORS_ALLOWED_ORIGINS` contains only real frontend origins.
- `TRUST_PROXY` matches actual proxy hop topology.
- `JWT_SECRET` (local mode) and `INVITE_CODE` are strong and injected via secret management.
- Auth rate limits trigger `429` and include `Retry-After` (local auth) / Cognito + WAF limits active in AWS.
- Reverse proxy / CDN serves `GET /api/sse` as a long-lived, unbuffered response.

Record:

- Date:
- Environment:
- Verified by:
- Notes:

### Dependency Risk Triage (Current)

Use this section after running `npm run security:audit`.

#### Priority A - Update as soon as possible

- **`vite` (high):** dev server file-read/path-traversal advisories. Update to a patched version via regular dependency update flow.
- **`prisma` / `@prisma/config` / `effect` (high, transitive):** update Prisma toolchain to pull patched transitive dependency versions.
- **`defu` / `path-to-regexp` (high, transitive):** pick up through lockfile refresh and dependency updates.
- **`postcss` (moderate):** update to patched version in normal dependency maintenance.

#### Priority B - No upstream fix available (`xlsx`)

- `xlsx` currently reports high advisories without an npm fix available.
- Mitigate operationally:
  - accept only expected XLS/XLSX formats (already enforced in app workflow),
  - keep import payload sizes constrained,
  - treat imported files as untrusted user input,
  - monitor project advisories for available patched versions.
- Re-evaluate on each weekly dependency review / Dependabot cycle.

#### Execution Order

1. Run `npm audit fix` in a branch and review lockfile/package updates.
2. Explicitly upgrade direct dependencies with known advisories (`vite`, Prisma stack, `postcss`) if needed.
3. Run full checks: `npm run test:integration`, `npm run build`, `npm run security:audit`.
4. If `xlsx` remains unresolved, keep mitigation notes and exception rationale in this runbook.
