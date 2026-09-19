# PGWalo QA Test Matrix

Status values are evidence-based: PASS, FAIL, BLOCKED, NOT TESTED, or REVIEW PASS/RISK.

| ID | Area | Test | Type | Priority | Status | Evidence |
|---|---|---|---|---|---|---|
| AUTH-001 | Authentication | Login/session/role downgrade coverage | Review | P0 | NOT TESTED | No dedicated auth test runner found |
| AUTH-002 | Authentication | Invalid/missing/expired/tampered token handling | Review | P0 | REVIEW PASS | `src/worker/middleware/auth.ts`, `src/worker/utils/jwt.ts` |
| TENANT-001 | Tenant isolation | Cross-organization read/write denial | Runtime | P0 | NOT TESTED | Requires seeded multi-org API run |
| BED-001 | Inventory | Occupied/reserved/maintenance bed transitions | Runtime | P0 | NOT TESTED | Existing E2E script available |
| BED-002 | Inventory | Last-bed concurrent reservation race | Runtime | P0 | NOT TESTED | No concurrency harness found |
| PROP-001 | Property lifecycle | Create/edit/publish/archive validation | Runtime | P1 | NOT TESTED | Existing E2E script available |
| LEAD-001 | Leads/CRM | Pipeline transitions and org scoping | Review | P1 | REVIEW PASS | `src/domain/market.ts`, inquiries handlers |
| VISIT-001 | Visits | Schedule/reschedule/cancel/timezone behavior | Review | P1 | NOT TESTED | No dedicated test found |
| PAY-001 | Reservation payment | Provider success timeout/retry idempotency | Runtime | P0 | NOT TESTED | Payment script available; provider config required |
| PAY-002 | Webhooks | Duplicate/replay/amount mismatch handling | Review | P0 | REVIEW RISK | Verify provider signature and unique event constraints |
| BILL-001 | Billing | Proration/rounding/duplicate invoice prevention | Domain | P1 | NOT TESTED | `src/domain/billing.ts` |
| DEPOSIT-001 | Deposits | Settlement/refund invariant | Domain | P1 | NOT TESTED | `src/domain/deposits.ts` |
| RES-001 | Onboarding | Lead to active stay lifecycle | Runtime | P1 | NOT TESTED | Existing E2E script available |
| KYC-001 | KYC | File/privacy/access control | Review | P1 | REVIEW RISK | `src/worker/handlers/media.ts`, KYC schema |
| AGR-001 | Agreements | Signing/version/authorization | Runtime | P1 | NOT TESTED | Existing E2E report claims coverage |
| MOVE-001 | Move-out | Closure, evidence, future reservation handoff | Runtime | P1 | NOT TESTED | Existing E2E report claims coverage |
| MAINT-001 | Maintenance | SLA/status/reopen/org scoping | Review | P2 | NOT TESTED | Maintenance handlers present |
| COMP-001 | Compliance | Expiry/public indicator/source document privacy | Review | P2 | NOT TESTED | Market-ready schema present |
| REV-001 | Reviews | Verified-stay eligibility and XSS | Review | P2 | NOT TESTED | Verified review schema present |
| ADMIN-001 | Admin/RBAC | Admin routes reject non-admin; audit mutations | Runtime | P0 | NOT TESTED | `scripts/test-admin-worker.ts` |
| API-001 | API | Public/protected route inventory and errors | Review | P1 | REVIEW PASS | `src/worker/index.ts` and handlers |
| SEC-001 | Security | Secrets not shipped in client/config | Static | P0 | NOT TESTED | Search required |
| PERF-001 | Performance | Build/bundle and bounded data loading | Static | P1 | NOT TESTED | Build plus code review |
| SCALE-001 | Scalability | Load/concurrency profiles | Runtime | P1 | BLOCKED | No load tool/config and no approved environment |
| OPS-001 | Operations | Migration/config/backup/recovery readiness | Review | P1 | REVIEW RISK | Wrangler/D1/R2 config present; backup evidence absent |
