# AWS Performance Checklist (SSE + DynamoDB)

This checklist standardizes the Phase-5 load probe for SSE fan-out and gives practical decision rules for DynamoDB capacity mode.

## Scope

- Target: `DynamoEventBus` with `EVENT_BUS=dynamo`
- Probe shape: 100 concurrent SSE connections, 1-second polling, optional 1/s mutation traffic
- Goal: decide whether to stay on DynamoDB **on-demand** or switch to **provisioned + auto scaling**

## 1) Preconditions

- Infrastructure deployed (`cdk deploy`) with:
  - `REALTIME_EVENTS_TABLE`
  - `RATE_LIMIT_TABLE`
  - `LOGIN_LOCKOUT_TABLE`
- Runtime env in Lambda:
  - `EVENT_BUS=dynamo`
  - `RATE_LIMIT_STORE=dynamo`
  - `LOCKOUT_STORE=dynamo`
- A valid login user for the target environment
- CloudWatch permissions to read metrics/logs

## 2) Baseline probe (no synthetic writes)

Run against local or deployed API:

```bash
PERF_BASE_URL="https://<your-domain>" \
PERF_LOGIN_EMAIL="<email>" \
PERF_LOGIN_PASSWORD="<password>" \
npm run perf:sse
```

Defaults (if not provided):

- `PERF_SSE_CONNECTIONS=100`
- `PERF_SSE_DURATION_SEC=120`
- `PERF_SSE_POLL_INTERVAL_MS` is implicit in backend via `EVENT_BUS_POLL_MS` (default 1000 ms)

Capture summary output:

- `connections_connected`
- `connection_errors`
- `events_total`
- `heartbeats_total`

## 3) Write-pressure probe (1 event/sec)

To model ongoing tournament activity while subscribers are connected:

```bash
PERF_BASE_URL="https://<your-domain>" \
PERF_LOGIN_EMAIL="<email>" \
PERF_LOGIN_PASSWORD="<password>" \
PERF_SSE_PUBLISH_URL="/api/<mutation-endpoint>" \
PERF_SSE_PUBLISH_METHOD="POST" \
PERF_SSE_PUBLISH_BODY='{"example":"payload"}' \
PERF_SSE_PUBLISH_INTERVAL_MS=1000 \
npm run perf:sse
```

Notes:

- Use an idempotent/safe mutation endpoint in non-production test data.
- Run at least 2 cycles to reduce cold-start noise.

## 4) Metrics to inspect

For all three DynamoDB tables (especially `REALTIME_EVENTS_TABLE`):

- `AWS/DynamoDB`:
  - `ConsumedReadCapacityUnits` (sum / min)
  - `ConsumedWriteCapacityUnits` (sum / min)
  - `ReadThrottleEvents`
  - `WriteThrottleEvents`
- Lambda:
  - `Duration` (p95/p99) for `api`, `sse`
  - `Throttles`
  - `Errors`

Recommended observation window: probe duration + 5 minutes.

## 5) Decision rules (on-demand vs provisioned)

Stay on **on-demand** when all are true:

- `ReadThrottleEvents == 0` and `WriteThrottleEvents == 0`
- load profile is bursty/unpredictable
- average consumed capacity is well below expected peak budget

Move to **provisioned + auto scaling** when one or more apply:

- sustained traffic with predictable peaks (e.g. fixed tournament windows)
- repeated high consumed capacity with cost pressure vs on-demand
- any throttling under expected load even after retry/backoff tuning

Practical threshold guideline for migrating to provisioned (starting point):

- If p95 `ConsumedReadCapacityUnits` or `ConsumedWriteCapacityUnits` remains high and steady for multiple runs, and daily profile is predictable, provisioned + target tracking usually becomes cheaper.

## 6) Capacity planning output (record this)

After each probe, store:

- run timestamp / environment / commit SHA
- probe config (connections, duration, publish interval)
- key CloudWatch metrics (read/write consumed, throttles)
- recommendation: `on-demand` or `provisioned`
- if provisioned: initial RCU/WCU and target tracking policy

## 7) Exit criteria for Phase 5 performance item

- Probe executed with 100 concurrent SSE connections
- Optional write-pressure scenario executed at 1 event/sec
- DynamoDB metrics collected and documented
- Explicit capacity mode decision documented for `REALTIME_EVENTS_TABLE`
