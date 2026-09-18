import { Env } from '../types';
import { addCorsHeaders } from '../utils/cors';
import { authMiddleware } from '../middleware/auth';
import { rowToAgreement } from '../utils/rowMap';
import { notifyEvent } from '../email';

function json(data: unknown, status = 200) {
  return addCorsHeaders(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  );
}

/**
 * Signatures must survive regardless of which dashboard's debounced
 * whole-collection sync runs next — the browser push cannot be trusted to
 * carry them. The tenant signature is therefore written here directly,
 * scoped to the caller: a resident may only ever sign (or read) the
 * agreement that belongs to their own resident row.
 */
export async function agreementsHandler(request: Request, env: Env): Promise<Response> {
  const auth = await authMiddleware(request, env);
  if (!auth.success) return json({ error: auth.error }, 401);
  const user = auth.user!;

  const selfCondition = `(resident_id = ? OR resident_id = ? OR resident_id IN (SELECT id FROM residents WHERE LOWER(email) = ?))`;
  const selfParams = [user.id, `res-${user.id}`, (user.email || '').toLowerCase()];

  // GET /api/agreements/mine — the resident's own agreements, camelCase.
  if (request.method === 'GET') {
    const url = new URL(request.url);
    if (url.pathname !== '/api/agreements/mine') return json({ error: 'Not found' }, 404);
    try {
      const { results } = await env.DB.prepare(
        `SELECT * FROM rent_agreements WHERE ${selfCondition} ORDER BY created_at DESC LIMIT 20`
      )
        .bind(...selfParams)
        .all();
      return json({ agreements: (results || []).map((row) => rowToAgreement(row as Record<string, unknown>)) });
    } catch (error) {
      console.error('agreements get', error);
      return json({ error: 'Could not load agreements' }, 500);
    }
  }

  // POST /api/agreements/mine/sign { id } — tenant signs.
  if (request.method === 'POST') {
    const url = new URL(request.url);
    if (url.pathname !== '/api/agreements/mine/sign') return json({ error: 'Not found' }, 404);
    const body = (await request.json().catch(() => ({}))) as { id?: string };
    const id = String(body.id || '');
    if (!id) return json({ error: 'Agreement id required' }, 400);

    try {
      const row = await env.DB.prepare(`SELECT * FROM rent_agreements WHERE id = ?`).bind(id).first<Record<string, unknown>>();
      if (!row) return json({ error: 'Agreement not found' }, 404);

      // Ownership check from the JWT, never the body.
      const mine = await env.DB.prepare(
        `SELECT id FROM rent_agreements WHERE id = ? AND ${selfCondition} LIMIT 1`
      )
        .bind(id, ...selfParams)
        .first();
      if (!mine) return json({ error: 'This agreement does not belong to your account' }, 403);

      if (Number(row.tenant_signed) === 1) {
        return json({ success: true, alreadySigned: true });
      }

      const signedDate = new Date().toISOString().split('T')[0];
      const ownerSigned = Number(row.owner_signed) === 1;
      await env.DB.prepare(
        `UPDATE rent_agreements SET tenant_signed = 1, status = ?, signed_date = ? WHERE id = ?`
      )
        .bind(ownerSigned ? 'Active' : 'Tenant Signed', signedDate, id)
        .run();

      // Tell the owner's desk by email: agreement.signed template, deduped.
      const agreement = rowToAgreement(row);
      try {
        const ownerEmail = (await env.DB.prepare(
          `SELECT u.email FROM users u WHERE u.organization_id = (SELECT organization_id FROM properties WHERE id = ?) AND u.role IN ('owner','manager') AND u.email IS NOT NULL LIMIT 1`
        )
          .bind(String(row.property_id || ''))
          .first<{ email: string }>())?.email;
        if (ownerEmail) {
          await notifyEvent(env, 'agreement.signed', {
            to: ownerEmail,
            toName: agreement.ownerName,
            data: {
              propertyName: agreement.propertyName,
              tenantName: agreement.residentName,
              roomNumber: agreement.roomNumber,
              startDate: agreement.startDate,
            },
            dedupeKey: `agreement-signed-${id}`,
          });
        }
      } catch {
        /* notification is best-effort; the signature is already durable */
      }

      return json({ success: true, status: ownerSigned ? 'Active' : 'Tenant Signed', signedDate });
    } catch (error) {
      console.error('agreements sign', error);
      return json({ error: 'Could not sign agreement' }, 500);
    }
  }

  return json({ error: 'Method not allowed' }, 405);
}
