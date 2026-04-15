# Security TODO

Practical checklist for improving security posture in `turnier-hub`.

## P0 - High Priority

- [x] Add auth rate limiting for `POST /api/auth/login` and `POST /api/auth/signup`.
- [x] Restrict CORS to an explicit allowlist (`CORS_ALLOWED_ORIGINS`).
- [x] Add baseline security headers with `helmet`.
- [x] Add configurable JSON request size limit (`JSON_BODY_LIMIT`).
- [x] Make proxy trust explicit (`TRUST_PROXY`) so `req.ip` is reliable behind reverse proxies.
- [ ] Verify production `TRUST_PROXY` value with real deployment path (for many setups: `1` behind Nginx).

## P1 - Medium Priority

- [ ] Add progressive backoff / temporary lockout for repeated failed login attempts.
- [ ] Add websocket connection/message rate limits and maximum subscriptions per client.
- [ ] Ensure all mutating API routes use strict request validation (field lengths, enums, allowed characters).
- [ ] Review JWT lifecycle:
  - [ ] Set and document token expiry policy.
  - [ ] Define secret rotation process.
  - [ ] Define invalidation strategy for critical events (e.g. password reset).
- [ ] Add structured monitoring/alerts for spikes in `401`, `403`, `429`, and websocket connection counts.

## P2 - Ongoing Hardening

- [ ] Enable regular dependency security updates (Dependabot/Renovate).
- [ ] Add CI security checks (`npm audit` policy, fail threshold for critical issues).
- [ ] Add a short operations runbook section for incident response (auth abuse, blocked IPs, secret rotation).

## Quick Verification Checklist (Production)

- [ ] `CORS_ALLOWED_ORIGINS` contains only real frontend origins.
- [ ] `TRUST_PROXY` matches the actual proxy hop topology.
- [ ] `JWT_SECRET` and `INVITE_CODE` are strong and injected from secret management.
- [ ] Auth rate limits trigger `429` and include `Retry-After`.
- [ ] Reverse proxy forwards websocket upgrade headers for `/api/ws`.
