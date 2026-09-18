import { Env } from '../types';
import { addCorsHeaders } from '../utils/cors';
import { authMiddleware } from '../middleware/auth';
import {
  drainOutbox,
  emailStats,
  emailTransportSummary,
  ensureEmailTables,
  getPreferences,
  isKnownEvent,
  notifyEvent,
  probeEmailProviders,
  sendTestEmail,
  setPreferences,
  verifyUnsubscribeToken,
  type WaitUntilContext,
} from '../email';

function json(data: unknown, status = 200) {
  return addCorsHeaders(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  }));
}

function html(body: string, status = 200) {
  return addCorsHeaders(new Response(`<!doctype html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>PGWalo email preferences</title></head>
<body style="margin:0;padding:40px 16px;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
    ${body}
  </div>
</body></html>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  }));
}

interface AccountRow {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
}

async function accountFor(env: Env, userId: string): Promise<AccountRow | null> {
  try {
    return await env.DB.prepare('SELECT id, email, name, role FROM users WHERE id = ? LIMIT 1')
      .bind(userId).first<AccountRow>();
  } catch {
    return null;
  }
}

/** Property → the owner's address, preferring the owner account over the listing contact. */
export async function resolveOwnerEmail(env: Env, propertyId: string | null): Promise<{ email: string; name: string } | null> {
  if (!propertyId) return null;
  const prop = await env.DB.prepare(
    'SELECT organization_id, owner_user_id, owner_name, contact_email FROM properties WHERE id = ? LIMIT 1'
  ).bind(propertyId).first<{
    organization_id: string | null; owner_user_id: string | null;
    owner_name: string | null; contact_email: string | null;
  }>();
  if (!prop) return null;

  let ownerUserId = prop.owner_user_id;
  if (!ownerUserId && prop.organization_id) {
    const org = await env.DB.prepare('SELECT owner_user_id FROM organizations WHERE id = ? LIMIT 1')
      .bind(prop.organization_id).first<{ owner_user_id: string | null }>();
    ownerUserId = org?.owner_user_id || null;
  }
  if (ownerUserId) {
    const owner = await env.DB.prepare('SELECT email, name FROM users WHERE id = ? LIMIT 1')
      .bind(ownerUserId).first<{ email: string | null; name: string | null }>();
    if (owner?.email?.includes('@')) return { email: owner.email, name: owner.name || prop.owner_name || 'Owner' };
  }
  if (prop.contact_email?.includes('@')) return { email: prop.contact_email, name: prop.owner_name || 'Owner' };
  return null;
}

async function resolveResidentEmail(env: Env, residentId?: string, residentEmail?: string) {
  if (residentId) {
    const row = await env.DB.prepare('SELECT email, name FROM residents WHERE id = ? LIMIT 1')
      .bind(residentId).first<{ email: string | null; name: string | null }>();
    if (row?.email?.includes('@')) return { email: row.email, name: row.name || 'Resident' };
  }
  if (residentEmail?.includes('@')) {
    const row = await env.DB.prepare('SELECT email, name FROM residents WHERE LOWER(email) = ? LIMIT 1')
      .bind(residentEmail.trim().toLowerCase()).first<{ email: string | null; name: string | null }>();
    if (row?.email?.includes('@')) return { email: row.email, name: row.name || 'Resident' };
  }
  return null;
}

/** The support/verification desk. */
async function resolveAdminEmail(env: Env): Promise<{ email: string; name: string } | null> {
  if (env.SUPERADMIN_EMAIL?.includes('@')) return { email: env.SUPERADMIN_EMAIL, name: 'PGWalo Desk' };
  const row = await env.DB.prepare(
    `SELECT email, name FROM users WHERE role IN ('superadmin', 'admin') AND email IS NOT NULL AND email != '' LIMIT 1`
  ).first<{ email: string; name: string | null }>();
  return row?.email?.includes('@') ? { email: row.email, name: row.name || 'PGWalo Desk' } : null;
}

/**
 * Property-scoped sends require the caller to be the property's owner, the
 * owner of its organisation, or a member of that organisation (platform staff
 * always pass). Scope comes from the JWT + DB — never the request body.
 *
 * Property ownership is checked first because listings can carry an
 * organisation id that predates their current owner.
 */
async function canActForProperty(env: Env, auth: AuthedCaller, propertyId: string): Promise<boolean> {
  if (auth.role === 'admin' || auth.role === 'superadmin') return true;

  const prop = await env.DB.prepare(
    'SELECT organization_id, owner_user_id FROM properties WHERE id = ? LIMIT 1'
  ).bind(propertyId).first<{ organization_id: string | null; owner_user_id: string | null }>();
  if (!prop) return false;

  if (prop.owner_user_id && prop.owner_user_id === auth.id) return true;
  if (auth.organizationId && prop.organization_id === auth.organizationId) return true;

  if (prop.organization_id) {
    const org = await env.DB.prepare('SELECT owner_user_id FROM organizations WHERE id = ? LIMIT 1')
      .bind(prop.organization_id).first<{ owner_user_id: string | null }>();
    if (org?.owner_user_id && org.owner_user_id === auth.id) return true;
  }
  return false;
}

interface AuthedCaller {
  id: string;
  role: string;
  organizationId?: string;
  email?: string;
  name?: string;
}

async function requireAuth(request: Request, env: Env): Promise<AuthedCaller | null> {
  const result = await authMiddleware(request, env);
  if (!result.success || !result.user) return null;
  const user = result.user as { id: string; role: string; organizationId?: string; email?: string; name?: string };
  return { ...user, email: user.email, name: user.name };
}

export async function emailHandler(request: Request, env: Env, ctx: WaitUntilContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // ---- public: one-click opt-out from an email footer ----------------------
  if (path === '/api/email/unsubscribe') {
    const token = url.searchParams.get('token') || '';
    await ensureEmailTables(env);
    const verified = await verifyUnsubscribeToken(env, token);
    if (!verified) {
      return html('<h1 style="font-size:18px;color:#0f172a;margin:0 0 8px">Link expired</h1><p style="color:#475569;font-size:14px;margin:0">This opt-out link is no longer valid. Open the PGWalo app to manage your notification preferences.</p>', 400);
    }
    const prefs = await getPreferences(env, verified.userId);
    await setPreferences(env, verified.userId, {
      disabledCategories: prefs.disabledCategories,
      emailEnabled: false,
    });
    return html(`<h1 style="font-size:18px;color:#0f172a;margin:0 0 8px">Email updates turned off</h1>
      <p style="color:#475569;font-size:14px;margin:0 0 12px">We will stop sending you update emails at <strong>${verified.email}</strong>.</p>
      <p style="color:#64748b;font-size:13px;margin:0">Account and security emails — like login codes and payment receipts — will still be delivered.</p>`);
  }

  // ---- admin: delivery visibility + manual controls ------------------------
  if (path.startsWith('/api/admin/email/')) {
    const auth = await requireAuth(request, env);
    if (!auth) return json({ error: 'Unauthorized' }, 401);
    if (auth.role !== 'admin' && auth.role !== 'superadmin') return json({ error: 'Forbidden' }, 403);

    if (path === '/api/admin/email/stats' && request.method === 'GET') {
      const stats = await emailStats(env);
      return json({ success: true, transport: emailTransportSummary(env), ...stats });
    }
    if (path === '/api/admin/email/drain' && request.method === 'POST') {
      const result = await drainOutbox(env, 25);
      return json({ success: true, ...result });
    }
    if (path === '/api/admin/email/test' && request.method === 'POST') {
      const body = await request.json().catch(() => ({})) as { to?: string };
      const account = await accountFor(env, auth.id);
      const to = body.to || account?.email || '';
      if (!to?.includes('@')) return json({ error: 'No recipient address available' }, 400);
      const result = await sendTestEmail(env, to, ctx);
      return json({ success: result.ok, to, ...result, transport: emailTransportSummary(env) });
    }
    // Verify every candidate sender (credentials + domain status) WITHOUT
    // sending anything — run this before flipping EMAIL_PROVIDER.
    if (path === '/api/admin/email/probe' && (request.method === 'GET' || request.method === 'POST')) {
      return json({ success: true, ...(await probeEmailProviders(env)) });
    }
    return json({ error: 'Not found' }, 404);
  }

  // ---- authenticated: preferences ----------------------------------------
  if (path === '/api/notifications/preferences') {
    const auth = await requireAuth(request, env);
    if (!auth) return json({ error: 'Unauthorized' }, 401);

    if (request.method === 'GET') {
      const prefs = await getPreferences(env, auth.id);
      return json({ success: true, ...prefs, transport: emailTransportSummary(env) });
    }
    if (request.method === 'PUT' || request.method === 'POST') {
      const body = await request.json().catch(() => ({})) as {
        emailEnabled?: boolean; disabledCategories?: string[];
      };
      await setPreferences(env, auth.id, {
        emailEnabled: typeof body.emailEnabled === 'boolean' ? body.emailEnabled : undefined,
        disabledCategories: Array.isArray(body.disabledCategories) ? body.disabledCategories.slice(0, 20) : undefined,
      });
      const prefs = await getPreferences(env, auth.id);
      return json({ success: true, ...prefs });
    }
    return json({ error: 'Method not allowed' }, 405);
  }

  // ---- authenticated: fire an event email --------------------------------
  if (path === '/api/notify/event') {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const auth = await requireAuth(request, env);
    if (!auth) return json({ error: 'Unauthorized' }, 401);

    const body = await request.json().catch(() => ({})) as {
      event?: string;
      to?: 'self' | 'owner' | 'admin' | 'resident';
      propertyId?: string;
      residentId?: string;
      residentEmail?: string;
      data?: Record<string, unknown>;
      dedupeKey?: string;
    };

    const event = String(body.event || '');
    if (!isKnownEvent(event)) return json({ success: false, error: 'Unknown event' }, 400);
    if (body.dedupeKey && String(body.dedupeKey).length > 160) {
      return json({ success: false, error: 'dedupeKey too long' }, 400);
    }

    const target = body.to || 'self';
    const account = await accountFor(env, auth.id);
    let recipient: { email: string; name: string } | null = null;

    if (target === 'self') {
      if (!account?.email?.includes('@')) return json({ success: false, error: 'No email on your account' }, 400);
      recipient = { email: account.email, name: account.name || auth.name || 'there' };
    } else if (target === 'admin') {
      recipient = await resolveAdminEmail(env);
    } else if (target === 'owner') {
      if (!body.propertyId) return json({ success: false, error: 'propertyId is required' }, 400);
      if (!(await canActForProperty(env, auth, body.propertyId))) return json({ error: 'Forbidden' }, 403);
      recipient = await resolveOwnerEmail(env, body.propertyId);
    } else if (target === 'resident') {
      if (!body.propertyId) return json({ success: false, error: 'propertyId is required' }, 400);
      if (!(await canActForProperty(env, auth, body.propertyId))) return json({ error: 'Forbidden' }, 403);
      recipient = await resolveResidentEmail(env, body.residentId, body.residentEmail);
    } else {
      return json({ success: false, error: 'Unsupported target' }, 400);
    }

    if (!recipient?.email) {
      return json({ success: false, queued: false, reason: 'no_recipient' });
    }

    const result = await notifyEvent(env, event, {
      to: recipient.email,
      toName: recipient.name,
      userId: target === 'self' ? auth.id : undefined,
      orgId: auth.organizationId,
      propertyId: body.propertyId,
      entityId: body.residentId || body.propertyId,
      data: body.data || {},
      dedupeKey: body.dedupeKey,
      ctx,
    });

    return json({ success: true, ...result, to: recipient.email });
  }

  return json({ error: 'Not found' }, 404);
}
