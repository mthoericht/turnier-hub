# AWS Edge Cutover Checklist

Use this checklist for the final Route53/domain and SSE edge validation in the dev/prod cutover.

## 1) Pre-flight

- [ ] AWS context is set (`AWS_PROFILE` or `CDK_DEFAULT_ACCOUNT`/`CDK_DEFAULT_REGION`).
- [ ] `TURNIER_HUB_STAGE` is set (`dev`/`staging`/`prod`).
- [ ] Domain vars are set:
  - [ ] `TURNIER_HUB_DOMAIN_NAME`
  - [ ] `TURNIER_HUB_HOSTED_ZONE_DOMAIN`
- [ ] Certificate source chosen:
  - [ ] Existing cert ARN via `TURNIER_HUB_ACM_CERTIFICATE_ARN`, or
  - [ ] Auto-create certificate stack (DNS validated, `us-east-1`).

## 2) Deploy order

- [ ] `npm run cdk:synth` succeeds.
- [ ] `npm run cdk:diff` shows expected changes.
- [ ] `npm run cdk:deploy` succeeds for all stacks.
- [ ] Capture outputs:
  - [ ] CloudFront domain
  - [ ] API Function URL output
  - [ ] SSE Function URL output

## 3) Route53 / DNS cutover

- [ ] 24h before switch: reduce DNS record TTL to `60`.
- [ ] Verify current record + rollback target are documented.
- [ ] Switch alias/CNAME to new CloudFront distribution.
- [ ] Verify propagation from at least 2 networks.

## 4) Runtime validation (post-switch)

- [ ] `GET /api/auth/me` returns expected auth response (401 unauthenticated / 200 authenticated).
- [ ] Login flow works from browser on target domain.
- [ ] SSE is healthy:
  - [ ] `GET /api/sse?...` returns `text/event-stream`
  - [ ] events are received after catalog/tournament mutations
  - [ ] reconnect after browser refresh/network flap works
- [ ] CORS behaves correctly with deployed frontend origin.

## 5) Observability checks

- [ ] CloudWatch alarms are in `OK` state after smoke tests.
- [ ] WAF metrics show traffic (and no unexpected block spike).
- [ ] Lambda error/throttle alarms remain stable.
- [ ] Security metric filter receives expected auth signals.

## 6) Rollback readiness

- [ ] Previous DNS target is still available.
- [ ] Rollback command/steps are written and tested.
- [ ] Team knows trigger conditions for rollback.
