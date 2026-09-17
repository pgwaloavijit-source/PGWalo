import { Env } from '../types';
import { addCorsHeaders } from '../utils/cors';
import { authMiddleware } from '../middleware/auth';
import { isPlatformAdmin } from '../utils/platformAdmin';

function json(data: unknown, status = 200) {
  return addCorsHeaders(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  }));
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

export async function inquiriesHandler(request: Request, env: Env): Promise<Response> {
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
      return json({ success: true, id }, 201);
    } catch (error) {
      console.error('inquiries save', error);
      return json({ error: 'Could not save inquiry', detail: error instanceof Error ? error.message : String(error) }, 500);
    }
  }

  if (request.method === 'PATCH') {
    const body = await request.json() as Record<string, unknown>;
    const id = String(body.id || url.searchParams.get('id') || '');
    if (!id) return json({ error: 'Inquiry id required' }, 400);
    const status = String(body.status || '');
    if (!['Pending', 'Approved', 'Rejected', 'Cancelled'].includes(status)) {
      return json({ error: 'Invalid status' }, 400);
    }
    try {
      await env.DB.prepare(
        `UPDATE booking_requests SET status = ?, allocated_room_number = ?, allocated_bed_number = ? WHERE id = ? OR reference_id = ?`
      ).bind(
        status,
        String(body.allocatedRoomNumber || ''),
        String(body.allocatedBedNumber || ''),
        id,
        id
      ).run();
      return json({ success: true });
    } catch (error) {
      console.error('inquiries patch', error);
      return json({ error: 'Could not update inquiry' }, 500);
    }
  }

  return json({ error: 'Method not allowed' }, 405);
}
