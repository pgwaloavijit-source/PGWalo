# PGWalo Scalability Report

## Tested scale
- Domain invariants: deterministic in-memory checks passed.
- Admin handler: deterministic in-memory D1 checks passed 20/20.
- Production-like load profiles A-E: BLOCKED; no approved load environment or harness.
- Synthetic datasets of 1,000 properties, 10,000 beds, and 100,000 invoices: NOT TESTED.

## Observed architecture
- Cloudflare Worker + D1 + R2 + KV configuration is present.
- D1 indexes exist for organization/property/status/date access in core schema and market migrations.
- Email outbox and scheduled SLA sweep introduce asynchronous work that should be monitored for retries and duplicate execution.

## Next bottlenecks to measure
- First-of-month invoice generation and payment/webhook bursts.
- Public search/detail traffic and large owner bootstrap payloads.
- Last-bed reservation contention and unbounded admin exports.

## Mitigation roadmap
- Add authenticated load tests with bounded fixtures.
- Record p95 latency, Worker CPU, D1 query time, 5xx rate, and queue/outbox depth.
- Enforce pagination and idempotency at every high-volume mutation before scaling beyond a single-operator launch.
