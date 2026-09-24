import { Env, User } from '../types';
import { addCorsHeaders } from '../utils/cors';
import { authMiddleware } from '../middleware/auth';
import { isPlatformAdmin } from '../utils/platformAdmin';
import { rowToBookingRequest, rowToPayment, rowToSupportTicket, rowToUserAccount } from '../utils/rowMap';
import type { WaitUntilContext } from '../email';

function json(data: unknown, status = 200) {
  return addCorsHeaders(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  }));
}

async function requireAdmin(request: Request, env: Env): Promise<{ user: User } | Response> {
  const auth = await authMiddleware(request, env);
  if (!auth.success || !auth.user) return json({ error: auth.error || 'Authentication required' }, 401);
  if (!isPlatformAdmin(auth.user.role)) return json({ error: 'Forbidden' }, 403);
  return { user: auth.user };
}

/**
 * Deliver an in-app notification to the person who raised a support ticket.
 * Without this a status change only existed in the admin's own browser tab —
 * the requester was never told anything.
 */
async function notifyTicketRequester(
  env: Env,
  ticketId: string,
  title: string,
  message: string
) {
  try {
    const ticket = await env.DB.prepare(
      'SELECT requester_id, title FROM support_tickets WHERE id = ?'
    ).bind(ticketId).first<{ requester_id: string | null; title: string | null }>();
    if (!ticket?.requester_id) return;

    await env.DB.prepare(`
      INSERT INTO broadcast_notifications
        (id, title, message, category, target, timestamp, sender, read, created_at, recipient_id)
      VALUES (?, ?, ?, 'Event', 'All Residents', ?, 'PGWalo Support', 0, ?, ?)
    `).bind(
      `bc-ticket-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      message,
      new Date().toISOString(),
      new Date().toISOString(),
      ticket.requester_id
    ).run();
  } catch (error) {
    // The notification column/table may predate this deploy — never fail the
    // ticket mutation because of it.
    console.error('ticket notification', error);
  }
}

async function writeAudit(env: Env, user: User, action: string, entity: string, entityId: string, details: string) {
  try {
    await env.DB.prepare(`
      INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, timestamp, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      user.id,
      user.name || 'Super Admin',
      user.role,
      action,
      entity,
      entityId,
      new Date().toISOString(),
      details
    ).run();
  } catch (error) {
    console.error('admin audit', error);
  }
}

async function countQuery(env: Env, sql: string, params: unknown[] = []) {
  try {
    const row = await env.DB.prepare(sql).bind(...params).first<{ n: number }>();
    return Number(row?.n || 0);
  } catch {
    return 0;
  }
}

const parseIntParam = (value: string | null, fallback: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
};

// ---------- Support ticket <-> client shape ----------

function ensureSupportTicketsTable(env: Env) {
  return env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      requester_id TEXT NOT NULL,
      requester_name TEXT NOT NULL,
      requester_role TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'General',
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT,
      status TEXT NOT NULL DEFAULT 'Raised',
      admin_note TEXT,
      assigned_to TEXT,
      property_id TEXT,
      booking_id TEXT,
      messages TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
}

export async function adminHandler(request: Request, env: Env, ctx?: WaitUntilContext): Promise<Response> {
  const gated = await requireAdmin(request, env);
  if (gated instanceof Response) return gated;
  const user = gated.user;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '');
  const parts = path.split('/').filter(Boolean);

  // ---------------- Overview ----------------
  if (path === '/api/admin/overview' && request.method === 'GET') {
    const [
      users, owners, tenants, pgs, rooms, occupied, pendingListings,
      activeBookings, openTickets, pendingAgreements, revenue, pendingPayments,
    ] = await Promise.all([
      countQuery(env, 'SELECT COUNT(*) as n FROM users'),
      countQuery(env, `SELECT COUNT(*) as n FROM users WHERE role = 'owner'`),
      countQuery(env, `SELECT COUNT(*) as n FROM users WHERE role IN ('resident', 'public')`),
      countQuery(env, 'SELECT COUNT(*) as n FROM properties'),
      countQuery(env, 'SELECT COUNT(*) as n FROM beds'),
      countQuery(env, `SELECT COUNT(*) as n FROM beds WHERE status IN ('Occupied', 'Notice Period')`),
      countQuery(env, 'SELECT COUNT(*) as n FROM properties WHERE verified = 0'),
      countQuery(env, `SELECT COUNT(*) as n FROM booking_requests WHERE status = 'Pending'`),
      countQuery(env, `SELECT COUNT(*) as n FROM maintenance_tickets WHERE status NOT IN ('Resolved', 'Closed')`),
      countQuery(env, `SELECT COUNT(*) as n FROM residents WHERE agreement_state IN ('Pending', 'Unknown')`),
      countQuery(env, `SELECT COALESCE(SUM(amount), 0) as n FROM payments WHERE status IN ('Verified', 'Success', 'Paid')`),
      countQuery(env, `SELECT COUNT(*) as n FROM payments WHERE status = 'Pending'`),
    ]);
    return json({
      users, owners, tenants, pgs, rooms, occupied,
      available: Math.max(0, rooms - occupied),
      pendingListings, activeBookings, openTickets, pendingAgreements, revenue, pendingPayments,
    });
  }

  // ---------------- Users (search + pagination) ----------------
  if (path === '/api/admin/users' && request.method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim();
    const role = (url.searchParams.get('role') || '').trim();
    const status = (url.searchParams.get('status') || '').trim();
    const page = parseIntParam(url.searchParams.get('page'), 1, 10000);
    const pageSize = parseIntParam(url.searchParams.get('pageSize'), 50, 200);

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (q) {
      const like = `%${q.toLowerCase()}%`;
      conditions.push(`(LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR phone LIKE ? OR LOWER(role) LIKE ?)`);
      params.push(like, like, like, like);
    }
    if (role && role !== 'all') {
      conditions.push('role = ?');
      params.push(role);
    }
    if (status && status !== 'all') {
      conditions.push(`COALESCE(status, 'Active') = ?`);
      params.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;

    try {
      const total = await countQuery(env, `SELECT COUNT(*) as n FROM users ${where}`, params);
      const { results } = await env.DB.prepare(`
        SELECT id, organization_id, name, email, phone, role, status, created_at, city, property_id, property_name, avatar
        FROM users ${where}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).bind(...params, pageSize, offset).all();
      return json({
        users: (results || []).map((row) => rowToUserAccount(row as Record<string, unknown>)),
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    } catch (error) {
      console.error('admin users', error);
      return json({ users: [], page: 1, pageSize, total: 0, totalPages: 1 }, 500);
    }
  }

  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'users' && parts[3] && request.method === 'PATCH') {
    const body = await request.json() as { status?: string };
    const allowed = ['Active', 'Disabled', 'Suspended', 'Pending Verification'];
    if (!body.status || !allowed.includes(body.status)) return json({ error: 'Invalid status' }, 400);
    if (parts[3] === user.id || parts[3] === 'superadmin') {
      return json({ error: 'The Super Admin account cannot disable itself' }, 400);
    }
    try {
      const result = await env.DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(body.status, parts[3]).run();
      if (!result.meta || result.meta.changes === 0) return json({ error: 'User not found' }, 404);
    } catch {
      return json({ error: 'Could not update user' }, 500);
    }
    await writeAudit(env, user, 'Account status changed', 'User', parts[3], body.status);

    // The affected account must learn what happened and what to do about it.
    // Their live sessions die on the next request (auth middleware checks
    // status), so this notice is how they discover the reactivation path.
    if (body.status === 'Disabled' || body.status === 'Suspended' || body.status === 'Active') {
      try {
        const target = await env.DB.prepare('SELECT email, name FROM users WHERE id = ? LIMIT 1')
          .bind(parts[3]).first<{ email: string | null; name: string | null }>();
        if (body.status === 'Active') {
          await env.DB.prepare(`
            INSERT INTO broadcast_notifications
              (id, title, message, category, target, timestamp, sender, read, created_at, recipient_id)
            VALUES (?, ?, ?, 'Event', 'All Residents', ?, 'PGWalo Support', 0, ?, ?)
          `).bind(
            `bc-adm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            'Your account has been reactivated',
            'The Super Admin has restored your account access. You can sign in and use PGWalo as normal again.',
            new Date().toISOString(),
            new Date().toISOString(),
            parts[3]
          ).run();
          if (target?.email?.includes('@')) {
            const { notifyEvent } = await import('../email');
            await notifyEvent(env, 'account.reactivated', {
              to: target.email,
              toName: target.name || 'there',
              userId: parts[3],
              data: {},
              dedupeKey: `acct-${body.status.toLowerCase()}-${parts[3]}`,
              ctx,
            });
          }
        } else {
          const isSuspended = body.status === 'Suspended';
          await env.DB.prepare(`
            INSERT INTO broadcast_notifications
              (id, title, message, category, target, timestamp, sender, read, created_at, recipient_id)
            VALUES (?, ?, ?, 'Event', 'All Residents', ?, 'PGWalo Support', 0, ?, ?)
          `).bind(
            `bc-adm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            isSuspended ? 'Your account has been suspended' : 'Your account has been disabled',
            isSuspended
              ? 'The Super Admin has suspended your account. Your data is preserved but access is paused. Raise a reactivation request from the sign-in screen to restore access.'
              : 'The Super Admin has disabled your account. Your data is preserved but everything is read-only. Raise a reactivation request from the sign-in screen to restore access.',
            new Date().toISOString(),
            new Date().toISOString(),
            parts[3]
          ).run();
          if (target?.email?.includes('@')) {
            const { notifyEvent } = await import('../email');
            await notifyEvent(env, 'account.disabled', {
              to: target.email,
              toName: target.name || 'there',
              userId: parts[3],
              data: { status: body.status },
              dedupeKey: `acct-${body.status.toLowerCase()}-${parts[3]}`,
              ctx,
            });
          }
        }
      } catch (error) {
        console.error('admin user notify', error);
      }
    }
    return json({ ok: true });
  }

  // ---------------- Bookings (filters + pagination) ----------------
  if (path === '/api/admin/bookings' && request.method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim();
    const status = (url.searchParams.get('status') || '').trim();
    const propertyId = (url.searchParams.get('propertyId') || '').trim();
    const from = (url.searchParams.get('from') || '').trim();
    const to = (url.searchParams.get('to') || '').trim();
    const page = parseIntParam(url.searchParams.get('page'), 1, 100000);
    const pageSize = parseIntParam(url.searchParams.get('pageSize'), 100, 500);

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (q) {
      const like = `%${q.toLowerCase()}%`;
      conditions.push(`(LOWER(applicant_name) LIKE ? OR LOWER(property_name) LIKE ? OR LOWER(email) LIKE ? OR phone LIKE ?)`);
      params.push(like, like, like, like);
    }
    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }
    if (propertyId && propertyId !== 'all') {
      conditions.push('property_id = ?');
      params.push(propertyId);
    }
    if (from) {
      conditions.push(`DATE(request_date) >= DATE(?)`);
      params.push(from);
    }
    if (to) {
      conditions.push(`DATE(request_date) <= DATE(?)`);
      params.push(to);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;

    try {
      const total = await countQuery(env, `SELECT COUNT(*) as n FROM booking_requests ${where}`, params);
      const { results } = await env.DB.prepare(`
        SELECT * FROM booking_requests ${where}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).bind(...params, pageSize, offset).all();
      // The console reads camelCase (applicantName, propertyName, requestDate…).
      return json({
        bookings: (results || []).map((row) => rowToBookingRequest(row as Record<string, unknown>)),
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    } catch (error) {
      console.error('admin bookings', error);
      return json({ bookings: [], page: 1, pageSize, total: 0, totalPages: 1 }, 500);
    }
  }

  // ---------------- Payments (filters + pagination) ----------------
  if (path === '/api/admin/payments' && request.method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim();
    const status = (url.searchParams.get('status') || '').trim();
    const propertyId = (url.searchParams.get('propertyId') || '').trim();
    const from = (url.searchParams.get('from') || '').trim();
    const to = (url.searchParams.get('to') || '').trim();
    const page = parseIntParam(url.searchParams.get('page'), 1, 100000);
    const pageSize = parseIntParam(url.searchParams.get('pageSize'), 100, 500);

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (q) {
      const like = `%${q.toLowerCase()}%`;
      conditions.push(`(LOWER(transaction_reference) LIKE ? OR LOWER(method) LIKE ? OR resident_id IN (
        SELECT id FROM residents WHERE LOWER(name) LIKE ?
      ))`);
      params.push(like, like, like);
    }
    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }
    if (propertyId && propertyId !== 'all') {
      conditions.push('property_id = ?');
      params.push(propertyId);
    }
    if (from) {
      conditions.push(`DATE(submitted_at) >= DATE(?)`);
      params.push(from);
    }
    if (to) {
      conditions.push(`DATE(submitted_at) <= DATE(?)`);
      params.push(to);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;

    try {
      const [
        total, txns, revenue, pending, failed,
      ] = await Promise.all([
        countQuery(env, `SELECT COUNT(*) as n FROM payments ${where}`, params),
        countQuery(env, 'SELECT COUNT(*) as n FROM payments'),
        countQuery(env, `SELECT COALESCE(SUM(amount), 0) as n FROM payments WHERE status IN ('Verified', 'Success', 'Paid')`),
        countQuery(env, `SELECT COUNT(*) as n FROM payments WHERE status = 'Pending'`),
        countQuery(env, `SELECT COUNT(*) as n FROM payments WHERE status IN ('Failed', 'Refunded', 'Rejected')`),
      ]);
      const { results } = await env.DB.prepare(`
        SELECT * FROM payments ${where}
        ORDER BY submitted_at DESC
        LIMIT ? OFFSET ?
      `).bind(...params, pageSize, offset).all();
      return json({
        payments: (results || []).map((row) => rowToPayment(row as Record<string, unknown>)), page, pageSize, total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        stats: { transactions: txns, revenue, pending, failed },
      });
    } catch (error) {
      console.error('admin payments', error);
      return json({ payments: [], page: 1, pageSize, total: 0, totalPages: 1, stats: { transactions: 0, revenue: 0, pending: 0, failed: 0 } }, 500);
    }
  }

  // ---------------- Support tickets (admin list) ----------------
  if (path === '/api/admin/support-tickets' && request.method === 'GET') {
    await ensureSupportTicketsTable(env).catch(() => undefined);
    const q = (url.searchParams.get('q') || '').trim();
    const status = (url.searchParams.get('status') || '').trim();
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (q) {
        const like = `%${q.toLowerCase()}%`;
        conditions.push(`(LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(requester_name) LIKE ?)`);
        params.push(like, like, like);
      }
      if (status && status !== 'all') {
        conditions.push('status = ?');
        params.push(status);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { results } = await env.DB.prepare(`
        SELECT * FROM support_tickets ${where}
        ORDER BY created_at DESC
        LIMIT 300
      `).bind(...params).all();
      return json((results || []).map((row) => rowToSupportTicket(row as Record<string, unknown>)));
    } catch (error) {
      console.error('admin support tickets', error);
      return json([]);
    }
  }

  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'support-tickets' && parts[3]) {
    await ensureSupportTicketsTable(env).catch(() => undefined);
    const ticketId = parts[3];

    if (request.method === 'PATCH') {
      const body = await request.json() as { status?: string; assignedTo?: string | null; adminNote?: string | null };
      const statusAllowed = ['Raised', 'Open', 'Resolved', 'Closed'];
      if (body.status && !statusAllowed.includes(body.status)) return json({ error: 'Invalid status' }, 400);
      try {
        const result = await env.DB.prepare(`
          UPDATE support_tickets
          SET status = COALESCE(?, status),
              assigned_to = COALESCE(?, assigned_to),
              admin_note = COALESCE(?, admin_note),
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(body.status || null, body.assignedTo || null, body.adminNote || null, ticketId).run();
        if (!result.meta || result.meta.changes === 0) {
          // Ticket may only exist client-side (raised before this table existed).
          return json({ ok: false, error: 'Ticket not found in database' }, 404);
        }
      } catch (error) {
        console.error('admin ticket patch', error);
        return json({ error: 'Could not update ticket' }, 500);
      }
      await writeAudit(env, user, 'Ticket updated', 'Ticket', ticketId, `${body.status || ''} ${body.assignedTo || ''}`.trim());
      if (body.status) {
        await notifyTicketRequester(
          env,
          ticketId,
          'Support ticket updated',
          `Your ticket status is now "${body.status}".${body.adminNote ? ` Note: ${body.adminNote}` : ''}`
        );
      }
      return json({ ok: true });
    }

    if (request.method === 'POST') {
      // Append an admin reply to the ticket conversation.
      const body = await request.json() as { authorName?: string; body?: string };
      const text = (body.body || '').trim();
      if (!text) return json({ error: 'Reply body required' }, 400);
      try {
        const row = await env.DB.prepare('SELECT messages FROM support_tickets WHERE id = ?').bind(ticketId)
          .first<{ messages: string | null }>();
        if (!row) return json({ ok: false, error: 'Ticket not found in database' }, 404);
        let messages: unknown[] = [];
        try {
          messages = row.messages ? JSON.parse(row.messages) : [];
        } catch {
          messages = [];
        }
        messages.push({
          id: `msg-${Date.now()}`,
          authorId: user.id,
          authorName: body.authorName || user.name || 'Super Admin',
          authorRole: user.role,
          body: text,
          createdAt: new Date().toISOString(),
        });
        await env.DB.prepare(`
          UPDATE support_tickets
          SET messages = ?, status = CASE WHEN status = 'Raised' THEN 'Open' ELSE status END,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(JSON.stringify(messages), ticketId).run();
      } catch (error) {
        console.error('admin ticket reply', error);
        return json({ error: 'Could not save reply' }, 500);
      }
      await writeAudit(env, user, 'Ticket reply added', 'Ticket', ticketId, text.slice(0, 120));
      await notifyTicketRequester(
        env,
        ticketId,
        'New reply on your support ticket',
        text.slice(0, 180)
      );
      return json({ ok: true });
    }
  }

  // ---------------- Properties ----------------
  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'properties' && parts[3] && request.method === 'PATCH') {
    const body = await request.json() as {
      action?: 'approve' | 'reject' | 'disable';
      name?: string;
      tagline?: string;
      description?: string;
      reason?: string;
    };
    if (body.name || body.tagline || body.description) {
      try {
        const result = await env.DB.prepare('UPDATE properties SET name = COALESCE(?, name), tagline = COALESCE(?, tagline), description = COALESCE(?, description) WHERE id = ?')
          .bind(body.name || null, body.tagline || null, body.description || null, parts[3]).run();
        if (!result.meta || result.meta.changes === 0) return json({ error: 'Property not found' }, 404);
      } catch {
        return json({ error: 'Could not edit property' }, 500);
      }
      await writeAudit(env, user, 'Listing edit', 'Property', parts[3], body.name || '');
      return json({ ok: true });
    }
    const map = {
      approve: { verified: 1, status: 'Active' },
      reject: { verified: 0, status: 'Restricted' },
      disable: { verified: 0, status: 'Archived' },
    } as const;
    const next = body.action ? map[body.action] : null;
    if (!next) return json({ error: 'Invalid action' }, 400);
    if (body.action === 'approve') {
      const current = await env.DB.prepare('SELECT plan_expires_at FROM properties WHERE id = ?')
        .bind(parts[3]).first<{ plan_expires_at: string | null }>();
      if (current?.plan_expires_at && !Number.isNaN(Date.parse(current.plan_expires_at)) && Date.parse(current.plan_expires_at) <= Date.now()) {
        return json({ error: 'This publishing plan has expired. The owner must renew it before the property can be relisted.' }, 409);
      }
    }
    try {
      const columns = await env.DB.prepare('PRAGMA table_info(properties)').all<{ name: string }>();
      const names = new Set((columns.results || []).map((c) => c.name));
      const assignments = ['verified = ?', 'status = ?'];
      const params: Array<string | number | null> = [next.verified, next.status];
      if (names.has('unlist_reason')) { assignments.push('unlist_reason = ?'); params.push(body.reason || (body.action === 'disable' ? 'admin_enforcement' : null)); }
      if (names.has('unlisted_at')) { assignments.push('unlisted_at = ?'); params.push(body.action === 'approve' ? null : new Date().toISOString()); }
      if (names.has('unlisted_by')) { assignments.push('unlisted_by = ?'); params.push(body.action === 'approve' ? null : 'superadmin'); }
      const result = await env.DB.prepare(`UPDATE properties SET ${assignments.join(', ')} WHERE id = ?`)
        .bind(...params, parts[3]).run();
      if (!result.meta || result.meta.changes === 0) return json({ error: 'Property not found' }, 404);
    } catch {
      return json({ error: 'Could not update property' }, 500);
    }
    await writeAudit(env, user, `Listing ${body.action}`, 'Property', parts[3], next.status);

    // The owner must learn their listing was taken down (or restored) — and
    // that the archive is read-only until they appeal via a reactivation ticket.
    if (body.action === 'disable' || body.action === 'reject' || body.action === 'approve') {
      try {
        const { resolveOwnerEmail } = await import('./email');
        const owner = await resolveOwnerEmail(env, parts[3]);
        const propName = await env.DB.prepare('SELECT name FROM properties WHERE id = ?')
          .bind(parts[3]).first<{ name: string | null }>();
        const name = propName?.name || 'Your listing';
        if (owner?.email?.includes('@')) {
          const { notifyEvent } = await import('../email');
          const event = body.action === 'approve' ? 'listing.approved' : 'listing.rejected';
          await notifyEvent(env, event, {
            to: owner.email,
            toName: owner.name,
            propertyId: parts[3],
            userId: undefined,
            data: {
              propertyName: name,
              reason: body.action === 'disable'
                ? `Disabled by the Super Admin${body.reason ? `: ${body.reason}` : ''}. The listing is read-only; raise a reactivation request to restore it.`
                : body.action === 'reject' ? 'Rejected by the Super Admin after review.' : 'Approved by the Super Admin.',
            },
            dedupeKey: `listing-${body.action}-${parts[3]}`,
            ctx,
          });
        }
        if (body.action === 'disable') {
          // In-app notice too: the owner's dashboard banner links here.
          const prop = await env.DB.prepare('SELECT owner_user_id, organization_id FROM properties WHERE id = ?')
            .bind(parts[3]).first<{ owner_user_id: string | null; organization_id: string | null }>();
          let ownerId = prop?.owner_user_id || null;
          if (!ownerId && prop?.organization_id) {
            const org = await env.DB.prepare('SELECT owner_user_id FROM organizations WHERE id = ?')
              .bind(prop.organization_id).first<{ owner_user_id: string | null }>();
            ownerId = org?.owner_user_id || null;
          }
          if (ownerId) {
            await env.DB.prepare(`
              INSERT INTO broadcast_notifications
                (id, title, message, category, target, timestamp, sender, read, created_at, recipient_id)
              VALUES (?, ?, ?, 'Event', 'All Residents', ?, 'PGWalo Support', 0, ?, ?)
            `).bind(
              `bc-adm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              'Your listing was disabled',
              `${name} has been disabled by the Super Admin. The listing is read-only; raise a reactivation request to restore it.`,
              new Date().toISOString(),
              new Date().toISOString(),
              ownerId
            ).run();
          }
        }
      } catch (error) {
        console.error('admin property notify', error);
      }
    }
    return json({ ok: true });
  }

  if (path === '/api/admin/logout' && request.method === 'POST') {
    await writeAudit(env, user, 'Logout', 'Session', user.id, 'Super Admin signed out');
    return json({ ok: true });
  }

  return json({ error: 'Unknown admin endpoint' }, 404);
}
