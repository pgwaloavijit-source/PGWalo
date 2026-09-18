import { Env } from '../types';
import {
  sendViaProvider,
  activeProvider,
  emailTransportSummary,
  probeProvider,
  type ProviderName,
  type EmailAttachment,
} from './provider';
import {
  drainOutbox,
  enqueueEmail,
  ensureEmailTables,
  unsubscribeToken,
} from './outbox';
import { renderEvent, type EmailContent } from './templates';

export { ensureEmailTables, drainOutbox, emailStats, getPreferences, setPreferences, suppressEmail, verifyUnsubscribeToken, unsubscribeToken } from './outbox';
export type { EmailAttachment } from './provider';
export {
  activeProvider,
  fallbackProvider,
  failoverReady,
  configuredProviders,
  emailTransportSummary,
  probeProvider,
  isFailoverWorthy,
  senderIdentity,
  type ProviderName,
  type ProviderReadiness,
} from './provider';
export { renderEvent, isKnownEvent, EVENTS } from './templates';

/**
 * Structural stand-in for the Workers `ExecutionContext`, so this module also
 * type-checks under the client tsconfig (which has no Workers globals).
 */
export interface WaitUntilContext {
  waitUntil: (promise: Promise<unknown>) => void;
}

/**
 * Send one transactional email.
 *
 * Written to the outbox first, then attempted immediately so security mail
 * (OTP) still arrives in seconds; the cron drains anything that failed.
 */
export async function sendTransactional(
  env: Env,
  msg: {
    to: string;
    toName?: string;
    subject: string;
    html: string;
    text: string;
    category: string;
    security?: boolean;
    replyTo?: string;
    dedupeKey?: string;
    attachments?: EmailAttachment[];
    ctx?: WaitUntilContext;
  }
): Promise<boolean> {
  const result = await enqueueEmail(env, msg);
  if (!result.queued) return result.reason === 'duplicate';

  const deliverable = activeProvider(env) !== 'none';
  // A configured sender is necessary but not sufficient: an unverified sending
  // domain or a revoked key makes every send fail, and callers (OTP) must know
  // that so they can fall back. The drain pass just updated the row — read its
  // verdict back when a real sender attempted delivery.
  // Oldest-first, so a backlog of earlier failures could starve this fresh
  // row out of a small batch — take enough to always include it.
  const drain = drainOutbox(env, 25);
  if (msg.ctx) {
    msg.ctx.waitUntil(drain);
    if (!deliverable) return false;
    // waitUntil: cannot read synchronously without awaiting, so optimistically
    // trust a configured sender here; failures retry via cron and the probe
    // surfaces the exact error.
    return true;
  }
  await drain;
  if (!deliverable) return false;
  try {
    const row = await env.DB.prepare(
      `SELECT status FROM email_outbox WHERE id = ?`
    )
      .bind(result.id)
      .first<{ status: string }>();
    // `sent` = provider accepted it. `queued`/`failed` = it did not deliver;
    // report that so the OTP path hands out its fallback code instead of
    // silently dropping the signup.
    return row?.status === 'sent';
  } catch {
    return deliverable;
  }
}

export interface NotifyContext {
  to: string;
  toName?: string;
  userId?: string;
  orgId?: string;
  propertyId?: string;
  entityId?: string;
  data?: Record<string, unknown>;
  dedupeKey?: string;
  /** e.g. the invoice PDF for a successful payment. */
  attachments?: EmailAttachment[];
  ctx?: WaitUntilContext;
}

/**
 * Render a declared event and queue it, wiring an unsubscribe link for the
 * recipient automatically. Returns the reason when nothing was queued so
 * callers can log suppressed/opted-out mail without failing the request.
 */
export async function notifyEvent(
  env: Env,
  event: string,
  ctx: NotifyContext
): Promise<{ queued: boolean; reason?: string; event: string }> {
  const unsubscribeUrl = ctx.userId
    ? `${ctx.data?.appUrl ? String(ctx.data.appUrl) : 'https://pgwalo.com'}/api/email/unsubscribe?token=${encodeURIComponent(await unsubscribeToken(env, ctx.userId, ctx.to))}`
    : undefined;

  const content: EmailContent | null = renderEvent(event, { ...(ctx.data || {}), recipientName: ctx.toName }, { unsubscribeUrl });
  if (!content) {
    console.warn(`[email] unknown event: ${event}`);
    return { queued: false, reason: 'unknown_event', event };
  }

  const result = await enqueueEmail(env, {
    to: ctx.to,
    toName: ctx.toName,
    subject: content.subject,
    html: content.html,
    text: content.text,
    category: content.category,
    security: content.security,
    dedupeKey: ctx.dedupeKey,
    orgId: ctx.orgId,
    propertyId: ctx.propertyId,
    entityId: ctx.entityId,
    attachments: ctx.attachments,
    payload: { event, ...(ctx.data || {}) },
  });

  if (result.queued) {
    const drain = drainOutbox(env, 8);
    if (ctx.ctx) ctx.ctx.waitUntil(drain); else await drain;
  }

  return { queued: result.queued, reason: result.reason, event };
}

/**
 * Backwards-compatible helper: the codebase already calls
 * `deliverEmail(env, to, subject, html, text)` from OTP, complaint and visit
 * flows. Routing it through the engine gives all of them retries and logs.
 */
export async function deliverEmail(
  env: Env,
  toEmail: string,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  return sendTransactional(env, {
    to: toEmail,
    subject,
    html,
    text,
    category: 'transactional',
    security: true,
  });
}

/**
 * Readiness of every candidate sender, so the escape hatch can be verified
 * before it is pulled. Credential checks only — nothing is sent.
 */
export async function probeEmailProviders(env: Env) {
  const candidates: ProviderName[] = ['cloudflare', 'resend'];
  const results = await Promise.all(candidates.map((provider) => probeProvider(env, provider)));
  // The most recent REAL (non-simulated) delivery attempt says more than any
  // probe: "domain not verified", quota, suppression, etc. Surface it so the
  // operator sees the actual reason mail is not arriving.
  let lastDeliveryError: string | null = null;
  try {
    const row = await env.DB.prepare(
      `SELECT last_error, created_at FROM email_outbox
       WHERE provider != 'none' AND last_error IS NOT NULL AND last_error != ''
       ORDER BY created_at DESC LIMIT 1`
    ).first<{ last_error: string; created_at: string }>();
    lastDeliveryError = row ? `${row.last_error} (at ${row.created_at})` : null;
  } catch {
    /* outbox table may not exist yet */
  }
  return {
    transport: emailTransportSummary(env),
    providers: results,
    /** The sender the very next message would use. */
    nextSendUses: activeProvider(env),
    lastDeliveryError,
  };
}

export async function sendTestEmail(
  env: Env,
  to: string,
  ctx?: WaitUntilContext
): Promise<{ ok: boolean; provider: ProviderName; simulated?: boolean; failedOver?: boolean; error?: string }> {
  // Routed through the durable outbox like every other message: the outcome —
  // including the provider's exact failure, e.g. an unverified sending
  // domain — is recorded on the outbox row and surfaced here and by the probe.
  const simulated = activeProvider(env) === 'none';
  const delivered = await sendTransactional(env, {
    to,
    subject: 'PGWalo email test',
    html: '<p>Email delivery is wired correctly. Nothing to do.</p>',
    text: 'Email delivery is wired correctly.',
    category: 'transactional',
    security: true,
  });
  const result: { ok: boolean; provider: ProviderName; simulated?: boolean; failedOver?: boolean; error?: string } = {
    ok: delivered,
    provider: activeProvider(env),
    simulated: simulated || undefined,
  };
  if (!delivered && !simulated) {
    // Read back the row the drain just updated for the precise reason.
    try {
      const row = await env.DB.prepare(
        `SELECT status, last_error FROM email_outbox
         WHERE LOWER(to_email) = ? ORDER BY created_at DESC LIMIT 1`
      )
        .bind(to.trim().toLowerCase())
        .first<{ status: string; last_error: string | null }>();
      result.error = row?.last_error || `outbox status: ${row?.status || 'unknown'}`;
    } catch {
      result.error = 'delivery failed (see GET /api/admin/email/stats)';
    }
  }
  if (result.ok && !simulated) await ensureEmailTables(env);
  if (ctx) ctx.waitUntil(Promise.resolve());
  return {
    ok: result.ok,
    provider: result.provider,
    simulated: result.simulated,
    failedOver: result.failedOver,
    error: result.error,
  };
}
