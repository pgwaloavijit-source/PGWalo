import { Env } from '../types';
import { activeProvider, sendViaProvider, type EmailAttachment } from './provider';

/**
 * Durable outbox.
 *
 * Every email is written to D1 first, then a drain pass attempts delivery.
 * That gives us retries with backoff, an audit trail, idempotency (dedupe
 * keys), suppression handling, per-recipient rate limiting and a dev mode that
 * never spams real inboxes — all without a queue product.
 */
const MAX_ATTEMPTS = 5;
const RETRY_MINUTES = [1, 5, 15, 60, 360];
const RECIPIENT_DAILY_CAP = 30;

export interface EnqueueInput {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
  category: string;
  security?: boolean;
  replyTo?: string;
  dedupeKey?: string;
  orgId?: string;
  propertyId?: string;
  entityId?: string;
  payload?: unknown;
  attachments?: EmailAttachment[];
}

export interface EnqueueResult {
  queued: boolean;
  id: string;
  reason?: 'suppressed' | 'preference' | 'rate_limited' | 'duplicate' | 'invalid';
}

const nowIso = () => new Date().toISOString();

let tablesReady = false;

export async function ensureEmailTables(env: Env): Promise<void> {
  if (tablesReady) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS email_outbox (
      id TEXT PRIMARY KEY,
      dedupe_key TEXT,
      to_email TEXT NOT NULL,
      to_name TEXT,
      subject TEXT NOT NULL,
      html TEXT NOT NULL,
      text TEXT NOT NULL,
      reply_to TEXT,
      category TEXT,
      org_id TEXT,
      property_id TEXT,
      entity_id TEXT,
      payload TEXT,
      attachments TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      provider TEXT,
      provider_message_id TEXT,
      next_attempt_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sent_at TEXT
    )`),
    env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_email_outbox_dedupe
      ON email_outbox(dedupe_key) WHERE dedupe_key IS NOT NULL`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_email_outbox_drain
      ON email_outbox(status, next_attempt_at)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_email_outbox_recipient
      ON email_outbox(to_email, created_at)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS email_preferences (
      user_id TEXT PRIMARY KEY,
      email_enabled INTEGER NOT NULL DEFAULT 1,
      disabled_categories TEXT,
      updated_at TEXT
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS email_suppressions (
      email TEXT PRIMARY KEY,
      reason TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    )`),
  ]);

  // Failover provenance is added separately so an already-created outbox table
  // (any environment predating it) still gains the column.
  const cols = await env.DB.prepare('PRAGMA table_info(email_outbox)').all<{ name: string }>();
  const columnNames = (cols.results || []).map((c) => c.name);
  if (!columnNames.includes('failover_from')) {
    await env.DB.prepare('ALTER TABLE email_outbox ADD COLUMN failover_from TEXT').run();
  }
  // Invoice PDFs travel as attachments; pre-existing outboxes gain the column.
  if (!columnNames.includes('attachments')) {
    await env.DB.prepare('ALTER TABLE email_outbox ADD COLUMN attachments TEXT').run();
  }

  tablesReady = true;
}

async function isSuppressed(env: Env, email: string): Promise<boolean> {
  const row = await env.DB.prepare('SELECT email FROM email_suppressions WHERE email = ? LIMIT 1')
    .bind(email).first<{ email: string }>();
  return Boolean(row);
}

export async function suppressEmail(env: Env, email: string, reason: string, note?: string): Promise<void> {
  await ensureEmailTables(env);
  await env.DB.prepare(
    `INSERT INTO email_suppressions (email, reason, note, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET reason = excluded.reason, note = excluded.note`
  ).bind(email.trim().toLowerCase(), reason, note || null, nowIso()).run();
}

interface PreferenceRow {
  email_enabled: number;
  disabled_categories: string | null;
}

export async function getPreferences(env: Env, userId: string) {
  await ensureEmailTables(env);
  const row = await env.DB.prepare(
    'SELECT email_enabled, disabled_categories FROM email_preferences WHERE user_id = ? LIMIT 1'
  ).bind(userId).first<PreferenceRow>();
  let disabled: string[] = [];
  try {
    disabled = row?.disabled_categories ? JSON.parse(row.disabled_categories) : [];
  } catch {
    disabled = [];
  }
  return { emailEnabled: row ? row.email_enabled === 1 : true, disabledCategories: disabled };
}

export async function setPreferences(
  env: Env,
  userId: string,
  prefs: { emailEnabled?: boolean; disabledCategories?: string[] }
): Promise<void> {
  await ensureEmailTables(env);
  const current = await getPreferences(env, userId);
  const enabled = prefs.emailEnabled ?? current.emailEnabled;
  const disabled = prefs.disabledCategories ?? current.disabledCategories;
  await env.DB.prepare(
    `INSERT INTO email_preferences (user_id, email_enabled, disabled_categories, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       email_enabled = excluded.email_enabled,
       disabled_categories = excluded.disabled_categories,
       updated_at = excluded.updated_at`
  ).bind(userId, enabled ? 1 : 0, JSON.stringify(disabled), nowIso()).run();
}

/** Resolve the user behind an address so opt-out can be honoured. */
async function userIdForEmail(env: Env, email: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1')
    .bind(email).first<{ id: string }>();
  return row?.id || null;
}

export async function enqueueEmail(env: Env, input: EnqueueInput): Promise<EnqueueResult> {
  await ensureEmailTables(env);
  const to = String(input.to || '').trim().toLowerCase();
  const id = `em-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (!to.includes('@')) return { queued: false, id, reason: 'invalid' };

  if (await isSuppressed(env, to)) return { queued: false, id, reason: 'suppressed' };

  // Opt-out only ever silences non-security mail.
  if (!input.security) {
    const userId = await userIdForEmail(env, to);
    if (userId) {
      const prefs = await getPreferences(env, userId);
      if (!prefs.emailEnabled || prefs.disabledCategories.includes(input.category)) {
        return { queued: false, id, reason: 'preference' };
      }
    }
  }

  const recent = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM email_outbox WHERE to_email = ? AND created_at > ?'
  ).bind(to, new Date(Date.now() - 86_400_000).toISOString()).first<{ n: number }>();
  if ((recent?.n || 0) >= RECIPIENT_DAILY_CAP) return { queued: false, id, reason: 'rate_limited' };

  const ts = nowIso();
  try {
    await env.DB.prepare(
      `INSERT INTO email_outbox
        (id, dedupe_key, to_email, to_name, subject, html, text, reply_to, category,
         org_id, property_id, entity_id, payload, attachments, status, attempts, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?)`
    ).bind(
      id,
      input.dedupeKey || null,
      to,
      input.toName || null,
      input.subject,
      input.html,
      input.text,
      input.replyTo || null,
      input.category,
      input.orgId || null,
      input.propertyId || null,
      input.entityId || null,
      input.payload ? JSON.stringify(input.payload) : null,
      input.attachments?.length ? JSON.stringify(input.attachments) : null,
      ts,
      ts
    ).run();
  } catch (error) {
    // Unique dedupe_key collision → this exact mail was already queued.
    const message = error instanceof Error ? error.message : String(error);
    if (/unique|constraint/i.test(message)) return { queued: false, id, reason: 'duplicate' };
    throw error;
  }

  return { queued: true, id };
}

interface OutboxRow {
  id: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  html: string;
  text: string;
  reply_to: string | null;
  attempts: number;
  attachments: string | null;
}

function parseAttachments(raw: string | null): EmailAttachment[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? (parsed as EmailAttachment[]) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Attempt delivery for due rows. Called inline right after enqueue (so most
 * mail leaves within a second) and by the 15-minute cron as the safety net.
 */
export async function drainOutbox(env: Env, limit = 10): Promise<{ sent: number; failed: number; simulated: number }> {
  await ensureEmailTables(env);
  const due = await env.DB.prepare(
    `SELECT id, to_email, to_name, subject, html, text, reply_to, attempts, attachments
       FROM email_outbox
      WHERE status = 'queued' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
      ORDER BY created_at ASC
      LIMIT ?`
  ).bind(nowIso(), limit).all<OutboxRow>();

  let sent = 0;
  let failed = 0;
  let simulated = 0;

  for (const row of due.results || []) {
    const result = await sendViaProvider(env, {
      to: row.to_email,
      toName: row.to_name || undefined,
      subject: row.subject,
      html: row.html,
      text: row.text,
      replyTo: row.reply_to || undefined,
      attachments: parseAttachments(row.attachments),
    });
    const ts = nowIso();

    if (result.ok) {
      if (result.simulated) simulated += 1; else sent += 1;
      await env.DB.prepare(
        `UPDATE email_outbox SET status = ?, attempts = attempts + 1, provider = ?,
           provider_message_id = ?, sent_at = ?, updated_at = ?, last_error = ?,
           failover_from = ?
         WHERE id = ?`
      ).bind(
        result.simulated ? 'simulated' : 'sent',
        result.provider,
        result.id || null,
        ts,
        ts,
        result.primaryError ? result.primaryError.slice(0, 500) : null,
        result.failedOver ? (result.primaryError || '').split(':')[0] || null : null,
        row.id
      ).run();
      continue;
    }

    const attempts = row.attempts + 1;
    const backoff = RETRY_MINUTES[Math.min(attempts - 1, RETRY_MINUTES.length - 1)];
    const exhausted = attempts >= MAX_ATTEMPTS;
    failed += 1;
    await env.DB.prepare(
      `UPDATE email_outbox SET status = ?, attempts = ?, last_error = ?, provider = ?,
         next_attempt_at = ?, updated_at = ?
       WHERE id = ?`
    ).bind(
      exhausted ? 'failed' : 'queued',
      attempts,
      (result.error || 'unknown error').slice(0, 500),
      result.provider,
      exhausted ? null : new Date(Date.now() + backoff * 60_000).toISOString(),
      ts,
      row.id
    ).run();
  }

  return { sent, failed, simulated };
}

/**
 * Outbox summary for the admin console. `filter.to` answers the support
 * question "did that invoice actually go out, and with the PDF?" without
 * having to read the whole table.
 */
export async function emailStats(env: Env, filter?: { to?: string }) {
  await ensureEmailTables(env);
  const counts = await env.DB.prepare(
    'SELECT status, COUNT(*) AS n FROM email_outbox GROUP BY status'
  ).all<{ status: string; n: number }>();
  // Which sender actually delivered, and how often we had to fail over.
  const byProvider = await env.DB.prepare(
    `SELECT COALESCE(provider, 'unknown') AS provider,
            COUNT(*) AS n,
            SUM(CASE WHEN failover_from IS NOT NULL THEN 1 ELSE 0 END) AS failovers
       FROM email_outbox
      WHERE status IN ('sent', 'simulated')
      GROUP BY provider`
  ).all<{ provider: string; n: number; failovers: number }>();
  // `payload` (the event name and its data) and `attachments` are included so an
  // operator can answer "what did we actually send, and what was attached?"
  // without reading the full HTML body.
  const columns = `id, to_email, subject, category, status, attempts, last_error, created_at, sent_at,
       attachments, payload, entity_id, provider, provider_message_id, failover_from`;
  const to = String(filter?.to || '').trim().toLowerCase();
  const recent = to
    ? await env.DB.prepare(
        `SELECT ${columns} FROM email_outbox WHERE LOWER(to_email) = ? ORDER BY created_at DESC LIMIT 25`
      ).bind(to).all()
    : await env.DB.prepare(
        `SELECT ${columns} FROM email_outbox ORDER BY created_at DESC LIMIT 25`
      ).all();
  return {
    provider: activeProvider(env),
    recipient: to || undefined,
    counts: counts.results || [],
    byProvider: byProvider.results || [],
    recent: recent.results || [],
  };
}

/** HMAC-signed opt-out link so unsubscribe can't be forged for another user. */
export async function unsubscribeToken(env: Env, userId: string, email: string): Promise<string> {
  const payload = `${userId}:${email.toLowerCase()}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.JWT_SECRET || 'pgwalo-email-unsubscribe'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.${b64}`;
}

export async function verifyUnsubscribeToken(env: Env, token: string): Promise<{ userId: string; email: string } | null> {
  try {
    const [rawPayload, sig] = token.split('.');
    if (!rawPayload || !sig) return null;
    const payload = atob(rawPayload.replace(/-/g, '+').replace(/_/g, '/'));
    const [userId, email] = payload.split(':');
    if (!userId || !email) return null;
    const expected = await unsubscribeToken(env, userId, email);
    return expected.split('.')[1] === sig ? { userId, email } : null;
  } catch {
    return null;
  }
}

