import { Env } from '../types';
import {
  sendViaProvider,
  activeProvider,
  emailTransportSummary,
  probeProvider,
  type ProviderName,
} from './provider';
import {
  drainOutbox,
  enqueueEmail,
  ensureEmailTables,
  unsubscribeToken,
} from './outbox';
import { renderEvent, type EmailContent } from './templates';

export { ensureEmailTables, drainOutbox, emailStats, getPreferences, setPreferences, suppressEmail, verifyUnsubscribeToken, unsubscribeToken } from './outbox';
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
  msg: { to: string; toName?: string; subject: string; html: string; text: string; category: string; security?: boolean; replyTo?: string; dedupeKey?: string; ctx?: WaitUntilContext }
): Promise<boolean> {
  const result = await enqueueEmail(env, msg);
  if (!result.queued) return result.reason === 'duplicate';

  // Still record the attempt so the outbox is a truthful audit trail, but the
  // return value means "actually delivered" — with no sender configured the
  // callers (e.g. OTP) must keep their local fallback behaviour.
  const deliverable = activeProvider(env) !== 'none';
  const drain = drainOutbox(env, 5);
  if (msg.ctx) {
    msg.ctx.waitUntil(drain);
    return deliverable;
  }
  await drain;
  return deliverable;
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
  return {
    transport: emailTransportSummary(env),
    providers: results,
    /** The sender the very next message would use. */
    nextSendUses: activeProvider(env),
  };
}

export async function sendTestEmail(
  env: Env,
  to: string,
  ctx?: WaitUntilContext
): Promise<{ ok: boolean; provider: ProviderName; simulated?: boolean; failedOver?: boolean; error?: string }> {
  const result = await sendViaProvider(env, {
    to,
    subject: 'PGWalo email test',
    html: '<p>Email delivery is wired correctly. Nothing to do.</p>',
    text: 'Email delivery is wired correctly.',
  });
  if (result.ok && !result.simulated) await ensureEmailTables(env);
  if (ctx) ctx.waitUntil(Promise.resolve());
  return {
    ok: result.ok,
    provider: result.provider,
    simulated: result.simulated,
    failedOver: result.failedOver,
    error: result.error,
  };
}
