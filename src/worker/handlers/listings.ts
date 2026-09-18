import { Env } from '../types';
import { addCorsHeaders } from '../utils/cors';
import { authMiddleware } from '../middleware/auth';
import { isPlatformAdmin } from '../utils/platformAdmin';
import { propertyToRow, rowToProperty } from '../utils/propertyMap';

const CITY_GROUPS = [
  ['bengaluru', 'bangalore', 'blr', 'bengalooru'],
  ['mumbai', 'bombay'],
  ['delhi', 'new delhi', 'ncr', 'delhi ncr'],
  ['gurugram', 'gurgaon'],
  ['hyderabad', 'hyd'],
  ['chennai', 'madras'],
  ['pune', 'puna'],
  ['kolkata', 'calcutta'],
];

function citySearchTerms(city: string) {
  const value = city.trim().toLowerCase();
  const group = CITY_GROUPS.find((g) => g.includes(value));
  return group || (value ? [value] : []);
}

function json(data: unknown, status = 200) {
  return addCorsHeaders(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  }));
}

export async function listingsHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const city = (url.searchParams.get('city') || '').trim();
    const location = (url.searchParams.get('location') || url.searchParams.get('q') || '').trim();
    const conditions = [`(status IS NULL OR status = 'Active')`];
    const params: unknown[] = [];

    // A signed-in owner always sees their own listings — including the ones
    // still waiting for a publishing payment, which must never be public but
    // must be visible to their owner so "Pay & publish" can be pressed again.
    const ownerAuth = await authMiddleware(request, env);
    const ownerId =
      ownerAuth.success && (ownerAuth.user!.role === 'owner' || isPlatformAdmin(ownerAuth.user!.role))
        ? ownerAuth.user!.id
        : '';
    if (ownerId) {
      conditions[0] = `((status IS NULL OR status = 'Active') OR owner_user_id = ?)`;
      params.push(ownerId);
    }
    if (city && city !== 'All') {
      const terms = citySearchTerms(city);
      conditions.push(`(${terms.map(() => 'LOWER(city) LIKE ?').join(' OR ')})`);
      terms.forEach((term) => params.push(`%${term}%`));
    }
    if (location) {
      const like = `%${location.toLowerCase()}%`;
      conditions.push(`(LOWER(name) LIKE ? OR LOWER(locality) LIKE ? OR LOWER(city) LIKE ? OR LOWER(address) LIKE ? OR LOWER(IFNULL(place_label,'')) LIKE ?)`);
      params.push(like, like, like, like, like);
    }
    try {
      const sql = `SELECT * FROM properties WHERE ${conditions.join(' AND ')} ORDER BY featured DESC, created_at DESC LIMIT 200`;
      const stmt = env.DB.prepare(sql);
      const { results } = params.length ? await stmt.bind(...params).all() : await stmt.all();
      return json((results || []).map((row) => rowToProperty(row as Record<string, unknown>)));
    } catch (error) {
      console.error('listings get', error);
      try {
        const { results } = await env.DB.prepare(
          `SELECT * FROM properties WHERE status = 'Active' OR status IS NULL LIMIT 200`
        ).all();
        return json((results || []).map((row) => rowToProperty(row as Record<string, unknown>)));
      } catch {
        return json({ error: 'Could not load listings' }, 500);
      }
    }
  }

  if (request.method === 'POST') {
    const auth = await authMiddleware(request, env);
    const body = await request.json() as Record<string, unknown>;
    if (!auth.success) {
      return json({ error: 'Sign in as the owner to publish a listing' }, 401);
    }
    if (auth.user!.role !== 'owner' && !isPlatformAdmin(auth.user!.role)) {
      return json({ error: 'Only owners can publish listings' }, 403);
    }
    if (!body?.name || !body.city || !body.locality) {
      return json({ error: 'Name, city and locality are required' }, 400);
    }
    const propertiesColumns = await env.DB.prepare('PRAGMA table_info(properties)').all<{ name: string }>()
      .then(({ results }) => (results || []).map((c) => c.name))
      .catch(() => [] as string[]);

    const property = {
      ...body,
      id: String(body.id || `prop-${Date.now()}`),
      ownerUserId: auth.user!.id,
      organizationId: auth.user!.organizationId || body.organizationId || `org-${auth.user!.id}`,
      // A listing stays pending until its publishing plan is paid for; an
      // already-live listing keeps its status when it is edited.
      status: String(body.status || 'Payment Pending'),
      planTier: propertiesColumns.includes('plan_tier') ? body.planTier : undefined,
    };
    const row = propertyToRow(property) as Record<string, unknown>;

    // Existing rows are the source of truth for the things a client must never
    // be able to lose: its PGWalo number, its paid plan and its live status.
    // An edit from the wizard therefore cannot renumber, un-publish or de-verify
    // a PG that is already live.
    const existing = await env.DB.prepare(
      'SELECT pg_number, plan_tier, plan_expires_at, status, verified FROM properties WHERE id = ?'
    ).bind(row.id).first<{
      pg_number: number | null;
      plan_tier: string | null;
      plan_expires_at: string | null;
      status: string | null;
      verified: number | null;
    }>();

    if (!propertiesColumns.includes('pg_number')) {
      delete row.pg_number;
    } else if (existing?.pg_number) {
      row.pg_number = existing.pg_number;
    } else if (!row.pg_number) {
      const next = await env.DB.prepare('SELECT COALESCE(MAX(pg_number), 0) + 1 AS n FROM properties')
        .first<{ n: number }>();
      row.pg_number = Number(next?.n) || 1;
    }

    if (!propertiesColumns.includes('plan_expires_at')) delete row.plan_expires_at;
    if (propertiesColumns.includes('plan_tier')) {
      if (!row.plan_tier && existing?.plan_tier) row.plan_tier = existing.plan_tier;
      if (!row.plan_expires_at && existing?.plan_expires_at) row.plan_expires_at = existing.plan_expires_at;
      if (row.plan_tier) row.status = 'Active';
    }
    if (existing) {
      // A listing the Super Admin disabled/rejected is frozen: only the Super
      // Admin's own PATCH (admin handler) can restore it. An owner edit — or a
      // publishing payment — cannot resurrect an archived/restricted listing.
      if (existing.status === 'Active') row.status = 'Active';
      if (existing.status === 'Archived' || existing.status === 'Restricted') {
        row.status = existing.status;
        row.verified = 0;
      }
      if (existing.verified) row.verified = 1;
    } else if (!isPlatformAdmin(auth.user!.role)) {
      // A brand-new listing can only go live by paying for a publishing plan —
      // the payment handler is what flips this to 'Active' (and an admin may
      // publish directly). A client-supplied `status: 'Active'` is ignored, so
      // the gate cannot be bypassed with a hand-rolled request.
      row.status = 'Payment Pending';
    }

    const values = Object.values(row).map((v) => (v === undefined ? null : v));
    try {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO organizations (id, name, owner_user_id, account_state, subscription_plan)
         VALUES (?, ?, ?, 'Active', 'Starter')`
      ).bind(
        String(row.organization_id),
        `${String(body.name || 'PG')} operator`,
        String(row.owner_user_id || 'unknown')
      ).run();
      await env.DB.prepare(
        `INSERT OR REPLACE INTO properties (${Object.keys(row).join(', ')}) VALUES (${Object.keys(row).map(() => '?').join(', ')})`
      ).bind(...(values as (string | number | null)[])).run();
      if (env.CACHE) {
        try {
          const keys = await env.CACHE.list({ prefix: 'search:' });
          await Promise.all((keys.keys || []).map((k) => env.CACHE!.delete(k.name)));
        } catch {
          /* ignore cache bust */
        }
      }
      return json({ success: true, property: rowToProperty(row as unknown as Record<string, unknown>) }, 201);
    } catch (error) {
      console.error('listings save', error);
      return json({ error: 'Could not publish listing', detail: error instanceof Error ? error.message : String(error) }, 500);
    }
  }

  return json({ error: 'Method not allowed' }, 405);
}
