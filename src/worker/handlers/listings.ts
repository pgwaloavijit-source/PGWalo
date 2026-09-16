import { Env } from '../types';
import { addCorsHeaders } from '../utils/cors';
import { authMiddleware } from '../middleware/auth';
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
    if (!body?.name || !body.city || !body.locality) {
      return json({ error: 'Name, city and locality are required' }, 400);
    }
    if (auth.success && !['owner', 'admin'].includes(auth.user!.role)) {
      return json({ error: 'Only owners can publish listings' }, 403);
    }
    const property = {
      ...body,
      id: String(body.id || `prop-${Date.now()}`),
      ownerUserId: auth.user?.id || body.ownerUserId,
      organizationId: auth.user?.organizationId || body.organizationId || `org-${body.ownerUserId || 'public'}`,
      status: 'Active',
    };
    const row = propertyToRow(property);
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
