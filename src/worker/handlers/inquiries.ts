import { Env } from '../types';
import { addCorsHeaders } from '../utils/cors';
import { authMiddleware } from '../middleware/auth';
import { isPlatformAdmin } from '../utils/platformAdmin';
import { notifyEvent, type WaitUntilContext } from '../email';

function json(data: unknown, status = 200) {
  return addCorsHeaders(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  }));
}

/**
 * Personal in-app notice to a user account. Approval/cancellation used to
 * exist only in the acting browser's local state — the applicant found out
 * by watching the status chip. recipient_id makes it theirs alone.
 */
async function notifyUser(env: Env, userId: string, title: string, message: string): Promise<void> {
  try {
    await env.DB.prepare(`
      INSERT INTO broadcast_notifications
        (id, title, message, category, target, timestamp, sender, read, created_at, recipient_id)
      VALUES (?, ?, ?, 'Event', 'All Residents', ?, 'PGWalo', 0, ?, ?)
    `).bind(
      `bc-inq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      message,
      new Date().toISOString(),
      new Date().toISOString(),
      userId
    ).run();
  } catch (error) {
    console.error('inquiry notification', error);
  }
}

/**
 * Find the applicant's account by the email/phone they submitted, so the
 * decision reaches the person who made the request (in-app + email) even
 * though they are not the one clicking the button.
 */
async function findApplicant(env: Env, email: string, phone: string) {
  try {
    if (email.includes('@')) {
      const row = await env.DB.prepare(
        'SELECT id, email, name FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1'
      ).bind(email.trim()).first<{ id: string; email: string; name: string }>();
      if (row) return row;
    }
    if (phone) {
      const row = await env.DB.prepare(
        `SELECT id, email, name FROM users WHERE substr(phone, -10) = ? LIMIT 1`
      ).bind(phone.replace(/\D/g, '').slice(-10)).first<{ id: string; email: string; name: string }>();
      if (row) return row;
    }
  } catch { /* users table quirk — fall through */ }
  return null;
}

function rowToInquiry(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id || ''),
    applicantName: String(row.applicant_name || ''),
    email: String(row.email || ''),
    phone: String(row.phone || ''),
    propertyId: String(row.property_id || ''),
    propertyName: String(row.property_name || ''),
    roomType: (row.room_type || 'Double') as string,
    preferredMoveInDate: String(row.preferred_move_in_date || ''),
    occupancyType: (row.occupancy_type || 'Working Professional') as string,
    status: (row.status || 'Pending') as string,
    requestDate: String(row.request_date || row.created_at || ''),
    message: String(row.message || ''),
    type: (row.type || 'booking') as string,
    visitDate: String(row.visit_date || ''),
    visitTimeSlot: String(row.visit_time_slot || ''),
    referenceId: String(row.reference_id || ''),
    allocatedRoomNumber: String(row.allocated_room_number || ''),
    allocatedBedNumber: String(row.allocated_bed_number || ''),
  };
}

export async function inquiriesHandler(request: Request, env: Env, ctx?: WaitUntilContext): Promise<Response> {
  const url = new URL(request.url);
  const auth = await authMiddleware(request, env);

  if (request.method === 'GET') {
    const ownerUserId = (url.searchParams.get('ownerUserId') || (auth.user?.role === 'owner' ? auth.user.id : '') || '').trim();
    const email = (url.searchParams.get('email') || '').trim().toLowerCase();
    const phone = (url.searchParams.get('phone') || '').replace(/\D/g, '').slice(-10);
    const propertyId = (url.searchParams.get('propertyId') || '').trim();
    try {
      let sql = `SELECT * FROM booking_requests WHERE 1=1`;
      const params: string[] = [];
      if (isPlatformAdmin(auth.user?.role)) {
        sql += ` ORDER BY created_at DESC LIMIT 200`;
        const { results } = await env.DB.prepare(sql).all();
        return json((results || []).map((row) => rowToInquiry(row as Record<string, unknown>)));
      }
      if (ownerUserId) {
        sql += ` AND property_id IN (SELECT id FROM properties WHERE owner_user_id = ?)`;
        params.push(ownerUserId);
      } else if (propertyId) {
        sql += ` AND property_id = ?`;
        params.push(propertyId);
      } else if (email || phone) {
        const parts: string[] = [];
        if (email) {
          parts.push('LOWER(email) = ?');
          params.push(email);
        }
        if (phone) {
          parts.push('phone LIKE ?');
          params.push(`%${phone}`);
        }
        sql += ` AND (${parts.join(' OR ')})`;
      } else if (auth.user?.organizationId) {
        sql += ` AND organization_id = ?`;
        params.push(auth.user.organizationId);
      } else {
        return json([]);
      }
      sql += ` ORDER BY created_at DESC LIMIT 200`;
      const stmt = env.DB.prepare(sql);
      const { results } = params.length ? await stmt.bind(...params).all() : await stmt.all();
      return json((results || []).map((row) => rowToInquiry(row as Record<string, unknown>)));
    } catch (error) {
      console.error('inquiries get', error);
      return json({ error: 'Could not load inquiries' }, 500);
    }
  }

  if (request.method === 'POST') {
    const auth = await authMiddleware(request, env);
    if (!auth.success || !auth.user) return json({ error: auth.error || 'Authentication required' }, 401);
    const body = await request.json() as Record<string, unknown>;
    const propertyId = String(body.propertyId || '');
    const applicantName = String(body.applicantName || '').trim();
    const email = String(body.email || '').trim();
    const phone = String(body.phone || '').trim();
    if (!propertyId || !applicantName || !email || !phone) {
      return json({ error: 'Visitor name, email, phone and property are required' }, 400);
    }
    const id = String(body.id || `req-${Date.now()}`);
    const type = body.type === 'visit' ? 'visit' : 'booking';
    try {
      const property = await env.DB.prepare(`SELECT id, name, organization_id, owner_user_id FROM properties WHERE id = ?`)
        .bind(propertyId)
        .first<{ id: string; name: string; organization_id: string; owner_user_id: string }>();
      const organizationId = property?.organization_id || String(body.organizationId || `org-${property?.owner_user_id || 'public'}`);
      if (organizationId) {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO organizations (id, name, owner_user_id, account_state, subscription_plan)
           VALUES (?, ?, ?, 'Active', 'Starter')`
        ).bind(organizationId, `${property?.name || body.propertyName || 'PG'} operator`, property?.owner_user_id || 'unknown').run();
      }
      await env.DB.prepare(
        `INSERT OR REPLACE INTO booking_requests (
          id, organization_id, applicant_name, email, phone, property_id, property_name,
          room_type, preferred_move_in_date, occupancy_type, status, request_date, message,
          type, visit_date, visit_time_slot, reference_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        organizationId,
        applicantName,
        email,
        phone,
        propertyId,
        String(body.propertyName || property?.name || 'PG'),
        String(body.roomType || 'Double'),
        String(body.preferredMoveInDate || body.visitDate || new Date().toISOString().slice(0, 10)),
        String(body.occupancyType || 'Working Professional'),
        String(body.status || 'Pending'),
        String(body.requestDate || new Date().toISOString().slice(0, 10)),
        String(body.message || ''),
        type,
        String(body.visitDate || ''),
        String(body.visitTimeSlot || ''),
        String(body.referenceId || id)
      ).run();

      // The owner used to discover a new visit/booking only by refreshing.
      // Personal notification + email land the moment the request is created.
      if (property?.owner_user_id) {
        const kindLabel = type === 'visit' ? 'Property visit request' : 'New booking request';
        await notifyUser(
          env,
          property.owner_user_id,
          kindLabel,
          `${applicantName} requested a ${type === 'visit' ? `visit on ${String(body.visitDate || body.preferredMoveInDate || 'the listed date')}` : `${String(body.roomType || 'Double')}-sharing stay`} at ${String(body.propertyName || property.name)}.`
        );
        try {
          const owner = await env.DB.prepare('SELECT email, name FROM users WHERE id = ?')
            .bind(property.owner_user_id).first<{ email: string; name: string }>();
          if (owner?.email?.includes('@')) {
            await notifyEvent(env, type === 'visit' ? 'visit.requested' : 'booking.requested', {
              to: owner.email,
              toName: owner.name || 'Owner',
              propertyId,
              data: {
                propertyName: String(body.propertyName || property.name || ''),
                applicantName,
                applicantPhone: phone,
                visitDate: String(body.visitDate || ''),
                visitTimeSlot: String(body.visitTimeSlot || ''),
                roomType: String(body.roomType || ''),
                moveInDate: String(body.preferredMoveInDate || ''),
                referenceId: String(body.referenceId || id),
              },
              dedupeKey: `inquiry-created-${id}`,
              ctx,
            });
          }
        } catch (error) {
          console.error('inquiry owner email', error);
        }
      }

      return json({ success: true, id }, 201);
    } catch (error) {
      console.error('inquiries save', error);
      return json({ error: 'Could not save inquiry', detail: error instanceof Error ? error.message : String(error) }, 500);
    }
  }

  if (request.method === 'PATCH') {
    const auth = await authMiddleware(request, env);
    if (!auth.success || !auth.user) return json({ error: auth.error || 'Authentication required' }, 401);
    const caller = auth.user;

    const body = await request.json() as Record<string, unknown>;
    const id = String(body.id || url.searchParams.get('id') || '');
    if (!id) return json({ error: 'Inquiry id required' }, 400);
    const status = String(body.status || '');
    if (!['Pending', 'Approved', 'Rejected', 'Cancelled'].includes(status)) {
      return json({ error: 'Invalid status' }, 400);
    }

    // A disabled or suspended account is read-only — its writes are rejected
    // here at the API layer, not just hidden in the UI.
    if (caller.role !== 'admin' && caller.role !== 'superadmin') {
      const live = await env.DB.prepare('SELECT status FROM users WHERE id = ? LIMIT 1')
        .bind(caller.id).first<{ status: string | null }>();
      if (live && (live.status === 'Disabled' || live.status === 'Suspended')) {
        return json({ error: `Account ${String(live.status).toLowerCase()} — request the Super Admin to reactivate it` }, 403);
      }
    }

    // Only the property's owner, a platform admin, or the inquiry's own
    // applicant (cancelling their own request) may change it. A crafted PATCH
    // used to be able to flip any property's requests.
    const existing = await env.DB.prepare(
      'SELECT * FROM booking_requests WHERE id = ? OR reference_id = ? LIMIT 1'
    ).bind(id, id).first<Record<string, unknown>>();
    if (!existing) return json({ error: 'Inquiry not found' }, 404);

    if (!isPlatformAdmin(caller.role)) {
      let allowed = false;
      if (caller.role === 'owner') {
        const own = await env.DB.prepare(
          `SELECT 1 FROM booking_requests br JOIN properties p ON p.id = br.property_id
            WHERE (br.id = ? OR br.reference_id = ?) AND p.owner_user_id = ? LIMIT 1`
        ).bind(id, id, caller.id).first();
        allowed = Boolean(own);
      }
      if (!allowed) {
        // The applicant may withdraw (cancel) their own request — nothing else.
        const email = (caller.email || '').toLowerCase();
        const isSelf = status === 'Cancelled' && Boolean(
          email && String(existing.email || '').toLowerCase() === email
        );
        if (!isSelf) return json({ error: 'You can only manage requests for your own properties' }, 403);
      }
    }

    try {
      const result = await env.DB.prepare(
        `UPDATE booking_requests SET status = ?, allocated_room_number = ?, allocated_bed_number = ? WHERE id = ? OR reference_id = ?`
      ).bind(
        status,
        String(body.allocatedRoomNumber || ''),
        String(body.allocatedBedNumber || ''),
        id,
        id
      ).run();
      if (!result.meta || result.meta.changes === 0) {
        return json({ error: 'Inquiry not found' }, 404);
      }
    } catch (error) {
      console.error('inquiries patch', error);
      return json({ error: 'Could not update inquiry' }, 500);
    }

    // The decision must reach the applicant: personal in-app notice + email.
    // The applicant's account is matched by the email/phone on the request.
    if (status === 'Approved' || status === 'Rejected' || status === 'Cancelled') {
      const applicant = await findApplicant(env, String(existing.email || ''), String(existing.phone || ''));
      const isVisit = String(existing.type || 'booking') === 'visit';
      const propertyName = String(existing.property_name || 'the property');
      const referenceId = String(existing.reference_id || existing.id || id);
      if (applicant) {
        const title = isVisit
          ? (status === 'Approved' ? 'Your property visit is confirmed' : 'Your visit request was not confirmed')
          : (status === 'Approved' ? 'Your booking is approved' : 'Your booking request was not approved');
        const roomBit = status === 'Approved' && !isVisit && (body.allocatedRoomNumber || body.allocatedBedNumber)
          ? ` Room ${String(body.allocatedRoomNumber)} (${String(body.allocatedBedNumber)}) is allocated.`
          : '';
        await notifyUser(
          env,
          applicant.id,
          title,
          `${propertyName}: ${isVisit ? 'visit' : 'booking'} ${referenceId} — ${status === 'Approved' ? `confirmed by the owner.${roomBit}` : status === 'Cancelled' ? 'you cancelled this request.' : 'the owner could not approve it.'}`
        );
        try {
          const event = isVisit
            ? (status === 'Approved' ? 'visit.scheduled' : 'visit.cancelled')
            : (status === 'Approved' ? 'booking.approved' : 'booking.rejected');
          if (applicant.email?.includes('@')) {
            await notifyEvent(env, event, {
              to: applicant.email,
              toName: applicant.name || 'there',
              propertyId: String(existing.property_id || '') || undefined,
              data: {
                propertyName,
                roomNumber: String(body.allocatedRoomNumber || ''),
                bedNumber: String(body.allocatedBedNumber || ''),
                visitDate: String(existing.visit_date || ''),
                visitTimeSlot: String(existing.visit_time_slot || ''),
                moveInDate: String(existing.preferred_move_in_date || ''),
                referenceId,
              },
              dedupeKey: `inquiry-${status.toLowerCase()}-${referenceId}`,
              ctx,
            });
          }
        } catch (error) {
          console.error('inquiry applicant email', error);
        }
      }
    }

    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
