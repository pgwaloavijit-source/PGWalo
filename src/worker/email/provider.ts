import type { Env } from '../types';

/**
 * Provider adapter with a live escape hatch.
 *
 * One interface, several senders. The active provider is resolved at call time
 * from the environment, so switching is a secret update — no code change and no
 * deploy:
 *
 *   npx wrangler secret put RESEND_API_KEY     # the credential
 *   npx wrangler secret put EMAIL_PROVIDER     # value: resend
 *
 * `EMAIL_PROVIDER` always wins (a secret overrides a var of the same name), so
 * a Cloudflare binding can stay in place while Resend carries the traffic.
 *
 * If the primary sender fails with a quota, auth or availability error — the
 * two ways a new sending domain disappoints — the message is retried through
 * `EMAIL_FALLBACK_PROVIDER` automatically and the outbox records which sender
 * actually delivered it.
 */
export type ProviderName = 'cloudflare' | 'resend' | 'none';

export interface EmailAttachment {
  filename: string;
  /** Base64 payload (no data: prefix). */
  content: string;
  contentType?: string;
}

export interface OutboundMessage {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /**
   * Attachments are supported by the Resend transport and by the Cloudflare
   * send_email binding where the account's plan allows it. A transport that
   * cannot carry one still delivers the message body — an invoice email must
   * never be lost just because its PDF could not travel with it.
   */
  attachments?: EmailAttachment[];
}

export interface SendResult {
  ok: boolean;
  provider: ProviderName;
  id?: string;
  error?: string;
  simulated?: boolean;
  /** True when the primary sender failed and the fallback delivered. */
  failedOver?: boolean;
  /** Set when the primary failed, even if the fallback then succeeded. */
  primaryError?: string;
}

const RESEND_BASE = (env: Env) => (env.RESEND_BASE_URL || 'https://api.resend.com').replace(/\/$/, '');

function normalize(env: Env, value?: string): ProviderName | null {
  const v = String(value || '').toLowerCase();
  if (v === 'cloudflare' || v === 'resend' || v === 'none') return v;
  return null;
}

/** Senders that actually have credentials in this environment. */
export function configuredProviders(env: Env): ProviderName[] {
  const list: ProviderName[] = [];
  if (env.EMAIL) list.push('cloudflare');
  if (env.RESEND_API_KEY) list.push('resend');
  return list;
}

/**
 * The sender used first. An explicit `EMAIL_PROVIDER` (typically a secret) is
 * authoritative; otherwise the first configured sender wins.
 */
export function activeProvider(env: Env): ProviderName {
  const explicit = normalize(env, env.EMAIL_PROVIDER);
  if (explicit) return explicit;
  const configured = configuredProviders(env);
  return configured[0] || 'none';
}

/** The sender used when the primary fails for a reason the other may not share. */
export function fallbackProvider(env: Env): ProviderName {
  const explicit = normalize(env, env.EMAIL_FALLBACK_PROVIDER);
  if (explicit) return explicit;
  const primary = activeProvider(env);
  const other = configuredProviders(env).find((p) => p !== primary);
  return other || 'none';
}

/** The fallback is only a real safety net if something is configured behind it. */
export function failoverReady(env: Env): boolean {
  const fallback = fallbackProvider(env);
  if (fallback === 'none') return false;
  if (fallback === 'resend') return Boolean(env.RESEND_API_KEY);
  if (fallback === 'cloudflare') return Boolean(env.EMAIL);
  return false;
}

export function senderIdentity(env: Env) {
  return {
    email: env.EMAIL_FROM || 'noreply@pgwalo.com',
    name: env.EMAIL_FROM_NAME || 'PGWalo',
    replyTo: env.EMAIL_REPLY_TO || 'support@pgwalo.com',
  };
}

/**
 * Errors worth trying the other sender for: exhausted quota, throttling,
 * rejected credentials, sender not authorised yet, provider outage. A malformed
 * address or a hard 4xx content error is the message's fault — resending it
 * elsewhere just burns the other provider's reputation.
 */
export function isFailoverWorthy(error?: string, status?: number): boolean {
  const text = String(error || '').toLowerCase();
  if (status === 429 || status === 401 || status === 403 || (status !== undefined && status >= 500)) return true;
  return /quota|rate limit|too many|throttl|unauthor|forbidden|not verified|not authorized|suspend|temporarily|unavailable|daily limit|limit exceeded|over capacity/.test(text);
}

async function sendWith(
  env: Env,
  provider: ProviderName,
  msg: OutboundMessage
): Promise<SendResult & { status?: number }> {
  const from = senderIdentity(env);
  const to = String(msg.to || '').trim().toLowerCase();
  if (!to.includes('@')) return { ok: false, provider, error: 'invalid recipient address' };
  const replyTo = msg.replyTo || from.replyTo;

  try {
    if (provider === 'cloudflare') {
      if (!env.EMAIL) return { ok: false, provider, error: 'cloudflare binding not configured' };
      const result = await env.EMAIL.send({
        to,
        from: { email: from.email, name: from.name },
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        replyTo,
        ...(msg.attachments?.length ? { attachments: msg.attachments } : {}),
      } as Parameters<NonNullable<Env['EMAIL']>['send']>[0]);
      const id = typeof result === 'string' ? result : (result as { messageId?: string } | null)?.messageId;
      return { ok: true, provider, id };
    }

    if (provider === 'resend') {
      if (!env.RESEND_API_KEY) return { ok: false, provider, error: 'resend api key not configured' };
      const res = await fetch(`${RESEND_BASE(env)}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${from.name} <${from.email}>`,
          to: [to],
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          reply_to: replyTo,
          ...(msg.attachments?.length
            ? {
                attachments: msg.attachments.map((a) => ({
                  filename: a.filename,
                  content: a.content,
                  content_type: a.contentType || 'application/pdf',
                })),
              }
            : {}),
        }),
      });
      const payload = await res.json().catch(() => ({})) as { id?: string; message?: string; error?: { message?: string } };
      if (!res.ok) {
        return {
          ok: false,
          provider,
          status: res.status,
          error: payload?.message || payload?.error?.message || `HTTP ${res.status}`,
        };
      }
      return { ok: true, provider, id: payload?.id };
    }

    // No sender configured yet: record the send, log it, and report success so
    // product flows never fail while email setup is pending.
    console.log(`[email:simulated] to=${to} subject=${msg.subject}`);
    return { ok: true, provider: 'none', simulated: true };
  } catch (error) {
    return { ok: false, provider, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Deliver one message, falling back to the other configured sender when the
 * primary fails for a reason the fallback might not share.
 */
export async function sendViaProvider(env: Env, msg: OutboundMessage): Promise<SendResult> {
  const primary = activeProvider(env);
  const first = await sendWith(env, primary, msg);
  if (first.ok) return first;

  const fallback = fallbackProvider(env);
  const canFailOver =
    fallback !== 'none' &&
    fallback !== primary &&
    failoverReady(env) &&
    isFailoverWorthy(first.error, first.status);

  if (!canFailOver) return first;

  console.warn(`[email] ${primary} failed (${first.error}); failing over to ${fallback}`);
  const second = await sendWith(env, fallback, msg);
  if (second.ok) {
    return {
      ...second,
      failedOver: true,
      primaryError: `${primary}: ${first.error}`,
    };
  }
  return {
    ...first,
    error: `${primary} failed (${first.error}); ${fallback} failed (${second.error})`,
  };
}

export interface ProviderReadiness {
  provider: ProviderName;
  ready: boolean;
  detail: string;
}

/**
 * Verify a sender BEFORE switching to it — a credential check, not a send.
 * Resend authorises against the /domains endpoint, which also reports whether
 * the sending domain has finished verifying (the usual reason mail silently
 * fails to arrive).
 */
export async function probeProvider(env: Env, provider: ProviderName): Promise<ProviderReadiness> {
  if (provider === 'cloudflare') {
    return env.EMAIL
      ? { provider, ready: true, detail: 'send_email binding present' }
      : { provider, ready: false, detail: 'no send_email binding in this environment' };
  }

  if (provider === 'resend') {
    if (!env.RESEND_API_KEY) return { provider, ready: false, detail: 'RESEND_API_KEY not set' };
    try {
      const res = await fetch(`${RESEND_BASE(env)}/domains`, {
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
      });
      if (res.status === 401 || res.status === 403) {
        // Ambiguous: a fully-invalid key AND a send-only scoped key both look
        // like this. A scoped key can still deliver mail — the definitive
        // check is a real send via POST /api/admin/email/test, whose error
        // (e.g. "domain not verified") is recorded on the outbox row and
        // surfaced by the probe's lastDeliveryError.
        return {
          provider,
          ready: false,
          detail: 'key rejected by the domains API (invalid key, or a send-only scoped key) - run POST /api/admin/email/test for a definitive verdict',
        };
      }
      if (!res.ok) return { provider, ready: false, detail: `domains check HTTP ${res.status}` };
      const body = await res.json().catch(() => ({})) as {
        data?: Array<{ name?: string; status?: string }>;
      };
      const from = senderIdentity(env).email.split('@')[1] || '';
      const domain = (body.data || []).find((d) => d.name === from);
      if (!domain) {
        return { provider, ready: false, detail: `key valid, but ${from} is not added as a sending domain` };
      }
      if (String(domain.status).toLowerCase() !== 'verified') {
        return { provider, ready: false, detail: `domain ${from} status: ${domain.status}` };
      }
      return { provider, ready: true, detail: `key valid, ${from} verified` };
    } catch (error) {
      return { provider, ready: false, detail: error instanceof Error ? error.message : 'probe failed' };
    }
  }

  return { provider: 'none', ready: false, detail: 'no sender selected' };
}

/** What the admin surfaces report about the current mail routing. */
export function emailTransportSummary(env: Env) {
  const from = senderIdentity(env);
  return {
    provider: activeProvider(env),
    fallbackProvider: fallbackProvider(env),
    failoverReady: failoverReady(env),
    configured: configuredProviders(env),
    from: `${from.name} <${from.email}>`,
    replyTo: from.replyTo,
  };
}
