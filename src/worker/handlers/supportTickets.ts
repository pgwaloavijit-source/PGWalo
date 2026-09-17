import { Env } from '../types';
import { addCorsHeaders } from '../utils/cors';
import { authMiddleware } from '../middleware/auth';
import { rowToSupportTicket } from '../utils/rowMap';

function json(data: unknown, status = 200) {
  return addCorsHeaders(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  }));
}

/** Keep media references intact; only refuse absurdly large inline blobs. */
function clampImageRef(value: string): string | null {
  if (value.startsWith('data:')) return value.length <= 400_000 ? value : null;
  return value.slice(0, 2048);
}

function ensureTable(env: Env) {
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

// User-facing support tickets. Anyone signed in can raise a ticket; the
// requester is taken from the JWT, never from the body.
export async function supportTicketsHandler(request: Request, env: Env): Promise<Response> {
  const auth = await authMiddleware(request, env);
  if (!auth.success || !auth.user) return json({ error: auth.error || 'Authentication required' }, 401);
  const user = auth.user;

  await ensureTable(env).catch(() => undefined);

  if (request.method === 'GET') {
    try {
      const { results } = await env.DB.prepare(
        `SELECT * FROM support_tickets WHERE requester_id = ? ORDER BY created_at DESC LIMIT 100`
      ).bind(user.id).all();
      return json((results || []).map((row) => rowToSupportTicket(row as Record<string, unknown>)));
    } catch (error) {
      console.error('support tickets get', error);
      return json([]);
    }
  }

  if (request.method === 'POST') {
    const body = await request.json() as Record<string, unknown>;
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const type = String(body.type || 'General').slice(0, 60);
    const propertyId = body.propertyId ? String(body.propertyId) : null;
    if (!title || !description) return json({ error: 'Title and description are required' }, 400);

    // Accept the id the client already rendered so its optimistic ticket and
    // the durable row stay the same record (admin replies then actually land on
    // the copy the user is looking at).
    const proposedId = String(body.id || '').trim();
    const id = /^support-[A-Za-z0-9_-]{1,64}$/.test(proposedId) ? proposedId : `support-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    try {
      await env.DB.prepare(`
        INSERT INTO support_tickets (
          id, organization_id, requester_id, requester_name, requester_role,
          type, title, description, image_url, property_id, booking_id,
          status, messages, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Raised', '[]', ?, ?)
      `).bind(
        id,
        user.organizationId || null,
        user.id,
        user.name || 'User',
        user.role,
        type,
        title.slice(0, 200),
        description.slice(0, 4000),
        // An R2/media URL is short; an inline data URL from the file picker can
        // be large. Truncating at 500 chars silently corrupted every attachment.
        body.imageUrl ? clampImageRef(String(body.imageUrl)) : null,
        propertyId,
        body.bookingId ? String(body.bookingId) : null,
        now,
        now
      ).run();

      // ---- routing -------------------------------------------------------
      // A ticket about the application itself (billing, technical, access)
      // belongs to the PGWalo superadmin queue. A ticket about a specific
      // property (room, food, staff, agreement) is routed to that property's
      // owner org. The requester still gets superadmin resolution either way —
      // routing only decides who is notified and who works the ticket.
      const PROPERTY_TYPES = ['Room allocation', 'Agreement', 'Property'];
      const isPropertyTicket = PROPERTY_TYPES.includes(type) && !!propertyId;
      try {
        const recipients: { id: string; role: string }[] = [];
        if (isPropertyTicket) {
          const ownerOrg = await env.DB.prepare(
            `SELECT o.id AS org_id
               FROM properties p
               JOIN organizations o ON o.owner_user_id = p.owner_user_id
              WHERE p.id = ?
              LIMIT 1`
          ).bind(propertyId!).first<{ org_id: string }>();
          if (ownerOrg?.org_id) {
            const ownerRows = await env.DB.prepare(
              `SELECT u.id, u.role
                 FROM users u
                WHERE u.organization_id = ? AND u.role IN ('owner', 'manager')
                LIMIT 10`
            ).bind(ownerOrg.org_id).all<{ id: string; role: string }>();
            recipients.push(...(ownerRows.results || []));
          }
        }
        // Application tickets — and property tickets with no resolvable owner —
        // always reach the superadmin desk.
        if (!recipients.length) {
          const adminRows = await env.DB.prepare(
            `SELECT id, role FROM users WHERE role IN ('superadmin', 'admin') LIMIT 10`
          ).all<{ id: string; role: string }>();
          recipients.push(...(adminRows.results || []));
        }
        const nowIso = new Date().toISOString();
        const stmts = recipients
          .filter((r) => r.id && r.id !== user.id)
          .map((r) => env.DB.prepare(`
            INSERT INTO broadcast_notifications
              (id, title, message, category, target, timestamp, sender, read, created_at, recipient_id)
            VALUES (?, ?, ?, 'Support', 'All Users', ?, 'PGWalo Support', 0, ?, ?)
          `).bind(
            `bc-support-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${r.id}`,
            `New ${isPropertyTicket ? 'property' : 'app'} ticket: ${title.slice(0, 120)}`,
            `${user.name || 'A user'} (${user.role}) reported a ${type.toLowerCase()} issue${isPropertyTicket ? ' on their property' : ''} — open the support desk to respond.`,
            nowIso,
            nowIso,
            r.id
          ));
        if (stmts.length) await env.DB.batch(stmts);
      } catch (error) {
        console.error('support ticket routing notification', error);
      }

      return json({ success: true, id }, 201);
    } catch (error) {
      console.error('support tickets post', error);
      return json({ error: 'Could not save ticket' }, 500);
    }
  }

  return json({ error: 'Method not allowed' }, 405);
}
