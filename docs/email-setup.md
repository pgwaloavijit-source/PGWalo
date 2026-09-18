# PGWalo transactional email — setup runbook

The engine is **already deployed and recording everything**. Until a sender is
configured, every email is written to `email_outbox` with status `simulated`
(visible at `GET /api/admin/email/stats`) — nothing is lost, nothing is sent.

Follow the steps for your chosen sender. **Do the inbound steps before flipping
MX** so `support@` and `admin@` never stop receiving mail.

---

## Path A — Cloudflare Email Service (chosen)

### 1. Enable Email Routing (this moves the zone's MX — inbound)
1. Cloudflare dashboard → **pgwalo.com** → **Email** → **Email Routing** → Enable.
2. Cloudflare adds its MX records automatically. **Do not remove the Namecheap
   MX records until step 3 is verified** — you can add them back if needed.
3. Under **Destination addresses**, add and verify the inboxes you actually read
   (click the verification link in each email).

### 2. Recreate your existing addresses as routing rules
Add a **Custom address** for each one you use today:

| Address | Action |
| --- | --- |
| `support@pgwalo.com` | Send to your verified destination |
| `admin@pgwalo.com` | Send to your verified destination |
| anything else you use | same |

Then send a test mail to `support@pgwalo.com` and confirm it arrives **before**
removing the old Namecheap forwarding.

### 3. Onboard the sending domain
Email → **Email Sending** → add `pgwalo.com` as a sending domain. Cloudflare
provisions the DKIM + SPF records. Wait for status **Active**.

> Sender identity is already correct in code: `noreply@pgwalo.com` with
> `Reply-To: support@pgwalo.com`.

### 4. Workers Paid plan
Sending to arbitrary recipients requires **Workers Paid** ($5/mo minimum, which
includes 3,000 emails/month; then $0.35 per 1,000). Inbound Email Routing is
unlimited and free.

### 5. Bind it to the Worker and deploy
Uncomment these two lines in `wrangler.toml`:

```toml
[[send_email]]
name = "EMAIL"
```

Then:

```bash
npm run deploy
```

No code change is needed — the provider is auto-detected from the binding.

### 6. Verify
```bash
# as a platform admin, with your JWT:
curl -X POST https://pgwalo.com/api/admin/email/test \
  -H "Authorization: Bearer <ADMIN_JWT>"
curl https://pgwalo.com/api/admin/email/stats \
  -H "Authorization: Bearer <ADMIN_JWT>"
```
`transport.provider` should read `cloudflare`, and new outbox rows should move
from `simulated` to `sent`.

---

## Path B — Resend (no MX change, works today)

If you want real delivery before (or instead of) the MX move:

```bash
npx wrangler secret put RESEND_API_KEY
```

Add the SPF/DKIM/DMARC records Resend shows for `pgwalo.com` in Cloudflare DNS
(MX stays with Namecheap — receiving is untouched), then `npm run deploy`.
The provider auto-detects Resend and nothing else changes.

The two paths are interchangeable at any time: the adapter is behind one secret.

---

## Switching senders at runtime (the escape hatch)

No deploy is needed. Both knobs are secrets, and a secret overrides the
`wrangler.toml` var of the same name, so this takes effect on the next message:

```bash
npx wrangler secret put RESEND_API_KEY            # paste the key
npx wrangler secret put EMAIL_PROVIDER            # value: resend
```

To go back:

```bash
npx wrangler secret put EMAIL_PROVIDER            # value: cloudflare  (or delete the secret)
```

**Check before you flip.** This validates credentials and sending-domain status
without sending mail:

```bash
curl -X POST https://pgwalo.com/api/admin/email/probe \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

It answers with the sender the next message will use, plus a readiness verdict
for every candidate — for Resend that includes whether `pgwalo.com` has finished
DKIM verification, which is the usual reason mail silently never arrives.

### Automatic failover

`EMAIL_FALLBACK_PROVIDER` defaults to the *other* configured sender, so with
both credentials in place a quota, throttling, auth or provider-outage failure
on the primary is retried on the fallback **inside the same send** — no operator
involvement, no lost message:

```
primary (cloudflare quota exhausted)
   └─▶ fallback (resend) delivers
          └─▶ outbox row: provider=resend, failover_from=cloudflare, last_error=<why>
```

Failover is deliberately narrow. Errors that are the *message's* fault — bad
recipient, malformed content, hard 4xx — are not retried elsewhere, because
replaying them only damages the other sender's reputation. Temporary failures
without a usable fallback keep the normal outbox retry schedule instead.

Delivery provenance is queryable:

```bash
curl https://pgwalo.com/api/admin/email/stats -H "Authorization: Bearer <ADMIN_JWT>"
# → transport: { provider, fallbackProvider, failoverReady, configured[] }
# → byProvider: [ { provider, n, failovers } ]
```

The adapter logic is covered by a deterministic test against a stub API —
switching precedence, failover on quota/auth errors, no failover on content
errors, and probe readiness:

```bash
npm run test:email     # 25 checks, no credentials or mail required
```

---

## What is already wired

| Concern | Where |
| --- | --- |
| Provider adapter (`cloudflare` / `resend` / `none`) | `src/worker/email/provider.ts` |
| Durable outbox, retries, dedupe, rate limit, suppression, opt-out | `src/worker/email/outbox.ts` |
| Event catalogue (32 events) + branded HTML/text templates | `src/worker/email/templates.ts` |
| `sendTransactional` / `notifyEvent` public API | `src/worker/email/index.ts` |
| Endpoints: event, preferences, unsubscribe, admin tools | `src/worker/handlers/email.ts` |
| Client fire-and-forget service | `src/services/emailEvents.ts` |
| Cron drain (every 15 min) | `src/worker/index.ts` → `scheduled` |

**Reliability behaviour:** mail is written to D1 first, then delivered inline
(so OTP arrives in seconds); anything that fails retries at 1m/5m/15m/1h/6h and
then parks as `failed` with the error stored. The same event twice = one email
(dedupe key). More than 30 emails to one address in 24h stops (storm guard).
`support@`-style auto-replies are never sent by the system.

**Opt-out:** every non-security email carries a signed unsubscribe link
(`/api/email/unsubscribe?token=…`). Account and security mail — login codes,
payment receipts, KYC decisions — always delivers.

---

## Manual checklist

- [ ] Email Routing enabled, destinations verified
- [ ] `support@` and `admin@` routing rules created and tested
- [ ] `pgwalo.com` onboarded as a sending domain (Active)
- [ ] Workers Paid plan active
- [ ] `[[send_email]]` uncommented + `npm run deploy`
- [ ] `POST /api/admin/email/test` returns `success: true`
