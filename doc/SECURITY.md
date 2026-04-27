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

## Security Checklist

Practical checklist for improving security posture in `turnier-hub`.

### P0 - High Priority

- [x] Add auth rate limiting for `POST /api/auth/login` and `POST /api/auth/signup`.
- [x] Restrict CORS to an explicit allowlist (`CORS_ALLOWED_ORIGINS`).
- [x] Add baseline security headers with `helmet`.
- [x] Add configurable JSON request size limit (`JSON_BODY_LIMIT`).
- [x] Make proxy trust explicit (`TRUST_PROXY`) so `req.ip` is reliable behind reverse proxies.
- [ ] Verify production `TRUST_PROXY` value with real deployment path (for many setups: `1` behind Nginx).

### P1 - Medium Priority

- [x] Add progressive backoff / temporary lockout for repeated failed login attempts.
- [x] Add websocket connection/message rate limits and maximum subscriptions per client.
- [x] Ensure all mutating API routes use strict request validation (field lengths, enums, allowed characters).
- [x] Review JWT lifecycle:
  - [x] Set and document token expiry policy.
  - [x] Define secret rotation process.
  - [x] Define invalidation strategy for critical events (e.g. password reset).
- [x] Add structured monitoring/alerts for spikes in `401`, `403`, `429`, and websocket connection counts.

### P2 - Ongoing Hardening

- [x] Enable regular dependency security updates (Dependabot/Renovate).
- [x] Add CI security checks (`npm audit` policy, fail threshold for critical issues).
- [x] Add a short operations runbook section for incident response (auth abuse, blocked IPs, secret rotation).

### Quick Verification Checklist (Production)

- [ ] `CORS_ALLOWED_ORIGINS` contains only real frontend origins.
- [ ] `TRUST_PROXY` matches the actual proxy hop topology.
- [ ] `JWT_SECRET` and `INVITE_CODE` are strong and injected from secret management.
- [ ] Auth rate limits trigger `429` and include `Retry-After`.
- [ ] Reverse proxy forwards websocket upgrade headers for `/api/ws`.

---

## Security Runbook

Operational playbook for production security checks and incident response.

### Quick Response (5 Minutes)

Use this when active abuse or suspicious auth behavior is ongoing.

1. **Contain**
   - Tighten `AUTH_LOGIN_MAX_REQUESTS`, `AUTH_IDENTIFIER_MAX_REQUESTS`, `LOGIN_LOCKOUT_*`.
   - Tighten websocket limits (`WS_CONNECT_*`, `WS_MESSAGE_*`, `WS_MAX_SUBSCRIPTIONS_PER_CLIENT`).
   - Add temporary reverse-proxy / WAF blocks for abusive sources.
2. **Verify**
   - Confirm `401` -> `429` behavior on `/api/auth/login`.
   - Confirm websocket rate-limit events appear in logs.
   - Confirm `TRUST_PROXY` still matches topology.
3. **Recover**
   - If account compromise is suspected, trigger `POST /api/auth/revoke-sessions` for affected users.
   - If secret exposure is suspected, rotate `JWT_SECRET` and restart all instances.
4. **Follow-up**
   - Keep stricter limits until traffic stabilizes.
   - Document what happened and which controls were changed.
   - Revisit thresholds to avoid recurring incidents.

### Scope and Usage

- Use this document for go-live checks, routine hardening reviews, and security incidents.
- Keep the checklist section in this file updated as backlog/source of truth.
- Re-run relevant sections after infrastructure changes (proxy/CDN/load balancer, auth settings, websocket topology).

### Go-Live Minimum Checklist

- `JWT_SECRET` and `INVITE_CODE` come from secret management.
- `CORS_ALLOWED_ORIGINS` contains only real frontend origins.
- `TRUST_PROXY` matches real proxy hop topology.
- Auth protection returns `429` + `Retry-After` on repeated failed attempts.
- WebSocket path `/api/ws` works behind reverse proxy (upgrade headers intact).
- Security telemetry logs for HTTP (`401`/`403`/`429`) and websocket spikes are visible.

### JWT and Session Model

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

### Secret Rotation Playbook

#### JWT secret rotation

1. Generate a new strong secret in the secret manager.
2. Deploy all app instances with new `JWT_SECRET`.
3. Verify new login flow works.
4. Communicate expected session invalidation impact.
5. Monitor `401` spikes post-rollout and ensure recovery.

Note: current implementation uses single-key verification. Rotation invalidates existing tokens globally. For seamless rotation, add multi-key verification (`kid` + active/previous secrets).

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
2. Tighten `AUTH_LOGIN_MAX_REQUESTS`, `AUTH_IDENTIFIER_MAX_REQUESTS`, and `LOGIN_LOCKOUT_*`.
3. Add temporary edge blocks/rate limits on reverse proxy or WAF.
4. Verify `TRUST_PROXY` remains correct during mitigation.

#### WebSocket abuse / connection flood

1. Confirm websocket spike/rate-limit events in logs.
2. Tighten `WS_CONNECT_*`, `WS_MESSAGE_*`, `WS_MAX_SUBSCRIPTIONS_PER_CLIENT`.
3. Apply additional reverse-proxy limits specifically for `/api/ws` if needed.

### Monitoring and Alert Signals

- HTTP auth-related spikes: `401`, `403`, `429`.
- WebSocket signals: connection spikes, WS rate-limit triggers (`connect`, `message`, `subscription`).
- Alert on sustained spikes, not single events, to reduce noise.

### Automated Coverage (Security Tests)

Current automated tests that cover core security controls:

- `tests/server/unit/appSecurity.test.ts`
  - verifies baseline `helmet` headers
  - validates CORS allowlist behavior (allowed and blocked origins)
  - checks JSON body-size limit enforcement
- `tests/server/unit/realtimeHub.test.ts`
  - verifies WS message/connect abuse protections and max subscriptions
- `tests/server/unit/securityMonitoring.test.ts`
  - validates monitoring event emission for HTTP auth-status spikes and WS signals
  - verifies WS window handling and non-negative connection counters
- `tests/server/unit/configSecurityGuards.test.ts`
  - validates production config guards (`JWT_SECRET`, `INVITE_CODE`, CORS wildcard rejection)
- `tests/client/integration/auth.api.test.ts`
  - validates login/signup rate limiting and progressive login lockout (`429` + `Retry-After`)
  - validates session revocation (`POST /api/auth/revoke-sessions`)

### Production Verification Log

Use this short template to record final go-live checks and support checklist closure.

Checklist:

- `CORS_ALLOWED_ORIGINS` contains only real frontend origins.
- `TRUST_PROXY` matches actual proxy hop topology.
- `JWT_SECRET` and `INVITE_CODE` are strong and injected via secret management.
- Auth rate limits trigger `429` and include `Retry-After`.
- Reverse proxy forwards websocket upgrade headers for `/api/ws`.

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
