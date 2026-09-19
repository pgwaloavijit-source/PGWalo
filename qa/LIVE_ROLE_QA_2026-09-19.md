# Live Role QA - 2026-09-19

Target: `https://pgwalo.com`

## Executed live checks

| Check | Result | Evidence |
|---|---|---|
| Health | PASS | `/api/health` -> 200 |
| Public stats | PASS | `/api/stats` -> 200 |
| Public listings/data contract | PASS | `/api/listings` -> 200, 30 listings, id/org/rooms present |
| Publishing plans | PASS | `/api/payments/plans` -> 200, 3 plans |
| Protected bootstrap/resident/property/admin surfaces | PASS | all unauthenticated requests -> 401 |
| Market visits/reservations/payment-intents | PASS | unauthenticated requests -> 401 |
| Maintenance/support/agreement surfaces | PASS | unauthenticated requests -> 401 |
| CORS preflight | PASS | OPTIONS health -> 204 |
| Super-admin escalation attempt | PASS | invalid verification registration -> 400 |
| OTP entry points | PASS | owner/resident/tenant/staff/manager/warden/accountant/admin/superadmin OTP requests -> 200, delivered=true |

## Blocked manual role-flow checks

Production OTP intentionally returns no fallback code. Without access to the QA mailbox/phone or an existing authorized admin session, the following cannot be truthfully marked passed:

- account creation and login for each role
- owner creates/manages property and staff
- tenant booking/reservation/onboarding
- staff operational dashboard and maintenance updates
- finance billing/payment/deposit interchange
- admin review, approval, audit, and cross-organization isolation
- end-to-end data handoff across roles

No production client data, real payment, refund, or destructive mutation was used. No live product defect was reproduced by the checks that were executable.

## Required next test input

Use a dedicated QA mailbox/phone capable of receiving production OTPs and a short-lived QA admin credential. Then run the authenticated role matrix before onboarding clients.
