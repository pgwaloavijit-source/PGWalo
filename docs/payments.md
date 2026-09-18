# PGWalo publishing payments — setup runbook

Owners pay a **one-time publishing fee** to make a PG live. The flow is:
pricing page (`Lite` / `Air` / `Ocean`) → gateway checkout → listing published
and badged with the plan → tax invoice PDF emailed. A failed attempt emails the
owner the **same resumable payment link and the amount**, and the "Pay & publish"
button reappears on the property card.

Everything is already deployed and working in **simulation mode**: with no
gateway credentials the order is created, the checkout shows a test panel
("Simulate successful payment" / "Simulate a failed payment"), the listing is
published, the badge is applied and the invoice email is recorded in
`email_outbox`. Nothing is charged.

---

## Plans

| Plan | Price (one-time) | Validity | Badge | Reach |
| --- | --- | --- | --- | --- |
| Lite | ₹499 | 30 days | `Lite` | live listing, full details |
| Air | ₹999 | 90 days | `Air` | + priority placement, featured on home |
| Ocean | ₹1,999 | 180 days | `Ocean` | + top of the featured strip, onboarding |

The catalogue lives in `src/domain/pricing.ts` and is served from
`GET /api/payments/plans`, so the page, the gateway charge and the invoice can
never disagree. Prices are server-authoritative: the browser cannot influence an
amount.

---

## Going live (Razorpay)

Razorpay carries the payment (UPI, cards, netbanking). Three steps:

```bash
npx wrangler secret put RAZORPAY_KEY_ID          # rzp_live_... (or rzp_test_...)
npx wrangler secret put RAZORPAY_KEY_SECRET
npx wrangler secret put RAZORPAY_WEBHOOK_SECRET  # recommended
npm run deploy                                   # only needed for the webhook URL
```

1. **Keys** — Razorpay dashboard → Settings → API keys. The moment both are set,
   `activePaymentProvider()` returns `razorpay`: the test panel disappears, real
   checkout opens, and signature verification is enforced. Simulation is refused
   by the Worker as soon as keys exist, so a test payment can never be marked
   paid on a live account.
2. **Webhook** — Razorpay dashboard → Settings → Webhooks → add
   `https://pgwalo.com/api/payments/webhook`, secret = `RAZORPAY_WEBHOOK_SECRET`,
   events `payment.captured`, `payment.failed`, `order.paid`.
   The webhook is a safety net: the browser already verifies and fulfils on
   checkout success, and fulfilment is idempotent (`listing_payments.status`), so
   a duplicate or late callback changes nothing.
3. **No MX/DNS change is needed** — Razorpay is a redirect/JS checkout.

`GET /api/payments/plans` reports readiness under `transport`
(`provider`, `configured`, `simulated`), which the pricing page uses to decide
between the real checkout and the test panel.

---

## Database

`database/payments.sql` creates `listing_payments` and `payment_events`; the
`properties` columns (`pg_number`, `plan_tier`, `plan_expires_at`) are added by
the interactive runner because SQLite has no `ADD COLUMN IF NOT EXISTS`:

```bash
npm run db:migrate          # local
npm run db:migrate:remote   # production (probes first, safe to re-run)
```

---

## What the owner sees

| State | Property card | Badge |
| --- | --- | --- |
| Saved, no plan | `Payment pending` + **Pay & publish** | — |
| Payment failed | `Payment pending` + **Pay & publish** (link also emailed) | — |
| Paid | live, no pay button | `Lite` / `Air` / `Ocean` |

A listing with no paid plan is **not** in the public catalog
(`GET /api/listings` only serves `status = 'Active'`), but its own owner always
sees it — including the `PGwalo<number>- ` name — so they can pay for it from any
device. The server forces `Payment Pending` on every new listing, so the gate
cannot be bypassed with a hand-rolled request.

---

## Tests

```bash
E2E_BASE=http://127.0.0.1:8787 npm run test:payments   # 39 checks
E2E_BASE=http://127.0.0.1:8787 npm run test:e2e       # full regression
```

The payments suite covers pricing, the badged public name, the RBAC boundary
(another owner / tenant / anonymous cannot pay for a listing), the failure email
carrying the link and the amount, idempotent fulfilment, invoice number and the
PDF attachment on the outbox row.
