import { Env, User } from '../types';
import { authMiddleware } from '../middleware/auth';
import { isPlatformAdmin } from '../utils/platformAdmin';
import { resolveCorsOrigin } from '../utils/security';

/**
 * Near-real-time push for tickets and notifications.
 *
 * SSE from a Worker: the handler polls D1 on a short interval for up to ~25 s
 * (just under the ~30 s edge buffering limit), emitting an event the moment a
 * change is detected. The client's EventSource/fetch stream then reconnects
 * automatically, so from the browser's point of view changes arrive within
 * ~1-2 s while costing the database one cheap `MAX(updated_at)` per table
 * every few seconds — far lighter than the 25 s full-payload polling it
 * replaces.
 *
 * Auth note: the browser EventSource API cannot send an Authorization header,
 * so the JWT is accepted via `?token=` (validated by the same authMiddleware).
 */

const TICK_INTERVAL_MS = 2000; // D1 poll cadence while the stream is open
const MAX_DURATION_MS = 25_000; // close just before the ~30 s edge limit
const KEEPALIVE_COMMENT = ': ping\n\n';

type StreamKind = 'tickets' | 'notifications' | 'inquiries' | 'data';

function sseHeaders(request: Request): Headers {
  const headers = new Headers({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  headers.set('Access-Control-Allow-Origin', resolveCorsOrigin(request, 'production'));
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-organization-id, x-user-id');
  headers.set('Vary', 'Origin');
  return headers;
}

async function watermark(env: Env, user: User, kind: StreamKind): Promise<string> {
  if (kind === 'tickets') {
    const row = await env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM maintenance_tickets WHERE requester_id = ? OR resident_id = ?) AS mine,
         (SELECT COALESCE(MAX(updated_at), '') FROM maintenance_tickets
           WHERE requester_id = ? OR resident_id = ?) AS touched`
    ).bind(user.id, user.id, user.id, user.id).first<{ mine: number; touched: string }>();
    return `${row?.mine || 0}|${row?.touched || ''}`;
  }

  // Notifications: count + latest id is enough; content is fetched separately
  // via GET /api/notifications so no message payload flows while idle.
  if (kind === 'notifications') {
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS n, COALESCE(MAX(id), '') AS last_id
         FROM broadcast_notifications
        WHERE recipient_id IS NULL OR recipient_id = ?`
    ).bind(user.id).first<{ n: number; last_id: string }>();
    return `${row?.n || 0}|${row?.last_id || ''}`;
  }

  if (kind === 'inquiries') {
    // Booking/visit requests relevant to this viewer. Platform admins see the
    // whole queue; owners see requests against their own properties; tenants
    // only their own (so one applicant's approval never pings another).
    if (isPlatformAdmin(user.role)) {
      const row = await env.DB.prepare(
        `SELECT COUNT(*) AS n, COALESCE(MAX(created_at), '') AS touched FROM booking_requests`
      ).first<{ n: number; touched: string }>();
      return `${row?.n || 0}|${row?.touched || ''}`;
    }
    if (user.role === 'owner') {
      const row = await env.DB.prepare(
        `SELECT COUNT(*) AS n, COALESCE(MAX(created_at), '') AS touched
           FROM booking_requests
          WHERE property_id IN (SELECT id FROM properties WHERE owner_user_id = ?)`
      ).bind(user.id).first<{ n: number; touched: string }>();
      return `${row?.n || 0}|${row?.touched || ''}`;
    }
    const email = (user.email || '').toLowerCase();
    if (email) {
      const row = await env.DB.prepare(
        `SELECT COUNT(*) AS n, COALESCE(MAX(created_at), '') AS touched
           FROM booking_requests WHERE LOWER(email) = ?`
      ).bind(email).first<{ n: number; touched: string }>();
      return `${row?.n || 0}|${row?.touched || ''}`;
    }
    return '0|';
  }

  // 'data': generic collection watermark over the operational tables the
  // dashboards render. A disable/enable by the Super Admin, an approval, an
  // allocation — any INSERT/UPDATE here lands on every dashboard within ~2 s.
  const row = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM properties) AS p,
       (SELECT COALESCE(MAX(updated_at), '') FROM properties) AS pt,
       (SELECT COUNT(*) FROM beds) AS b,
       (SELECT COUNT(*) FROM residents) AS r,
       (SELECT COUNT(*) FROM rent_agreements) AS a,
       (SELECT COUNT(*) FROM stays) AS s,
       (SELECT COUNT(*) FROM staff_members) AS st`
  ).first<{ p: number; pt: string; b: number; r: number; a: number; s: number; st: number }>();
  return [row?.p, row?.pt, row?.b, row?.r, row?.a, row?.s, row?.st].join('|');
}

export async function eventsHandler(request: Request, env: Env): Promise<Response> {
  // SSE readers cannot set headers — accept the JWT from the query string.
  const url = new URL(request.url);
  const auth = await authMiddleware(request, env, url.searchParams.get('token') || undefined);
  if (!auth.success || !auth.user) {
    return new Response(JSON.stringify({ error: auth.error || 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const user = auth.user;

  const kindParam = url.searchParams.get('kind') || 'tickets';
  const ALL_KINDS: StreamKind[] = ['tickets', 'notifications', 'inquiries', 'data'];
  const kinds: StreamKind[] =
    kindParam === 'all' ? ALL_KINDS :
    kindParam.split(',').filter((k): k is StreamKind => (ALL_KINDS as string[]).includes(k));
  if (!kinds.length) kinds.push('tickets');

  const encoder = new TextEncoder();
  let closed = false;
  request.signal.addEventListener('abort', () => { closed = true; });

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: string) => {
        if (!closed) {
          try { controller.enqueue(encoder.encode(payload)); } catch { closed = true; }
        }
      };

      const previous = new Map<StreamKind, string>();
      try {
        for (const kind of kinds) previous.set(kind, await watermark(env, user, kind));

        send(KEEPALIVE_COMMENT);
        send(`event: ready\ndata: ${JSON.stringify({ kinds })}\n\n`);

        const deadline = Date.now() + MAX_DURATION_MS;
        while (!closed && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, TICK_INTERVAL_MS));
          if (closed) break;

          for (const kind of kinds) {
            const current = await watermark(env, user, kind);
            if (current !== previous.get(kind)) {
              previous.set(kind, current);
              send(`event: changed\ndata: ${JSON.stringify({ kind, at: new Date().toISOString() })}\n\n`);
            }
          }
          send(KEEPALIVE_COMMENT);
        }
      } catch (error) {
        console.error('SSE stream error:', error);
      } finally {
        if (!closed) {
          try { controller.close(); } catch { /* already closed */ }
        }
      }
    },
    cancel() { closed = true; },
  });

  return new Response(stream, { status: 200, headers: sseHeaders(request) });
}
