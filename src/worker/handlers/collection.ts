import { Env, User } from '../types';
import { addCorsHeaders } from '../utils/cors';
import { hasPermission } from '../middleware/auth';

const READ_PERMISSIONS: Record<string, string> = {
  organizations: 'staff.view',
  properties: 'room.view',
  residents: 'resident.view',
  beds: 'room.view',
  stays: 'resident.view',
  rent_plans: 'invoice.view',
  invoices: 'invoice.view',
  payments: 'payment.view',
  payment_allocations: 'payment.view',
  deposit_transactions: 'deposit.view',
  notices: 'resident.view',
  checkouts: 'resident.view',
  audit_logs: 'audit.view',
  booking_requests: 'resident.view',
  attendance_records: 'resident.view',
  staff_members: 'staff.view',
  staff_tasks: 'staff.view',
  broadcast_notifications: 'staff.view',
  meal_plans: 'staff.view',
  chat_messages: 'staff.view',
  maintenance_tickets: 'complaint.view',
  leads: 'staff.view',
  electricity_meter_readings: 'resident.view',
  security_deposit_records: 'deposit.view',
  rent_agreements: 'resident.view',
  visitor_passes: 'resident.view',
  system_settings: 'staff.view',
  role_permissions: 'staff.view'
};

const WRITE_PERMISSIONS: Record<string, string> = {
  organizations: 'staff.permission_manage',
  properties: 'room.assign',
  residents: 'resident.edit',
  beds: 'room.assign',
  stays: 'room.transfer',
  rent_plans: 'invoice.adjust',
  invoices: 'invoice.create',
  payments: 'payment.record',
  payment_allocations: 'payment.verify',
  deposit_transactions: 'deposit.deduct',
  notices: 'resident.checkout',
  checkouts: 'resident.checkout',
  audit_logs: 'audit.view',
  booking_requests: 'resident.create',
  attendance_records: 'resident.create',
  staff_members: 'staff.create',
  staff_tasks: 'staff.create',
  broadcast_notifications: 'staff.create',
  meal_plans: 'staff.create',
  chat_messages: 'staff.create',
  maintenance_tickets: 'complaint.create',
  leads: 'staff.create',
  electricity_meter_readings: 'resident.create',
  security_deposit_records: 'deposit.deduct',
  rent_agreements: 'resident.create',
  visitor_passes: 'resident.create',
  system_settings: 'staff.permission_manage',
  role_permissions: 'staff.permission_manage'
};

const VALID_TABLES = [
  'organizations', 'properties', 'residents', 'beds', 'stays', 
  'rent_plans', 'invoices', 'payments', 'payment_allocations', 
  'deposit_transactions', 'notices', 'checkouts', 'audit_logs',
  'booking_requests', 'attendance_records', 'staff_members', 
  'staff_tasks', 'broadcast_notifications', 'meal_plans', 
  'chat_messages', 'maintenance_tickets', 'leads', 
  'electricity_meter_readings', 'security_deposit_records', 
  'rent_agreements', 'visitor_passes', 'system_settings', 'role_permissions'
];

export async function collectionHandler(
  request: Request, 
  env: Env, 
  collection: string, 
  id: string | undefined, 
  user: User
): Promise<Response> {
  const organizationId = user.organizationId || env.DEFAULT_ORGANIZATION_ID;

  // Validate collection name
  if (!VALID_TABLES.includes(collection)) {
    const response = new Response(JSON.stringify({ error: 'Unknown collection' }), { 
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
    return addCorsHeaders(response);
  }

  const readPermission = READ_PERMISSIONS[collection] || 'staff.view';
  const writePermission = WRITE_PERMISSIONS[collection] || 'staff.permission_manage';

  // GET request
  if (request.method === 'GET') {
    if (!hasPermission(user.role, readPermission)) {
      const response = new Response(JSON.stringify({ error: 'Forbidden' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }

    try {
      const url = new URL(request.url);

      if (collection === 'properties' && !id && env.CACHE && url.searchParams.toString()) {
        const cacheKey = `search:${url.searchParams.toString()}`;
        const cached = await env.CACHE.get(cacheKey, 'json');
        if (cached) {
          const response = new Response(JSON.stringify(cached), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=120',
              'X-Cache': 'HIT',
            },
          });
          return addCorsHeaders(response);
        }
      }

      let query = `SELECT * FROM ${collection}`;
      const params: unknown[] = [];
      const conditions: string[] = [];

      // Filter by organization for non-admin users
      if (user.role !== 'admin' && collection !== 'system_settings' && collection !== 'role_permissions') {
        conditions.push(`organization_id = ?`);
        params.push(organizationId);
      }

      // Add ID filter if provided
      if (id) {
        conditions.push(`id = ?`);
        params.push(id);
      }

      if (collection === 'properties') {
        const location = (url.searchParams.get('location') || url.searchParams.get('q') || '').trim();
        const city = (url.searchParams.get('city') || '').trim();
        const type = (url.searchParams.get('type') || '').trim();
        const roomType = (url.searchParams.get('roomType') || '').trim();
        const moveInDate = (url.searchParams.get('moveInDate') || '').trim();
        const maxPrice = Number(url.searchParams.get('maxPrice') || '');
        const amenities = url.searchParams.getAll('amenity').filter(Boolean);

        if (city && city !== 'All') {
          conditions.push(`LOWER(city) = LOWER(?)`);
          params.push(city);
        }

        if (type && type !== 'All') {
          conditions.push(`gender = ?`);
          params.push(type);
        }

        if (Number.isFinite(maxPrice) && maxPrice > 0) {
          conditions.push(`starting_price <= ?`);
          params.push(maxPrice);
        }

        if (location) {
          const likeTerm = `%${location.toLowerCase()}%`;
          conditions.push(`(
            LOWER(name) LIKE ?
            OR LOWER(locality) LIKE ?
            OR LOWER(city) LIKE ?
            OR LOWER(address) LIKE ?
            OR LOWER(locality || ', ' || city) LIKE ?
          )`);
          params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
        }

        if (roomType && roomType !== 'All') {
          conditions.push(`(EXISTS (
            SELECT 1 FROM json_each(properties.rooms)
            WHERE json_extract(json_each.value, '$.type') = ?
          ) OR EXISTS (
            SELECT 1 FROM beds
            WHERE beds.property_id = properties.id
              AND beds.sharing_type = ?
          ))`);
          params.push(roomType, roomType);
        }

        if (moveInDate) {
          conditions.push(`(
            EXISTS (
              SELECT 1 FROM json_each(properties.rooms)
              WHERE CAST(json_extract(json_each.value, '$.availableBeds') AS INTEGER) > 0
                ${roomType && roomType !== 'All' ? `AND json_extract(json_each.value, '$.type') = ?` : ''}
            )
            OR EXISTS (
              SELECT 1 FROM beds
              WHERE beds.property_id = properties.id
                AND (
                  beds.status IN ('Vacant', 'Available', 'Ready')
                  OR (beds.next_available_date IS NOT NULL AND beds.next_available_date <= ?)
                )
                ${roomType && roomType !== 'All' ? 'AND beds.sharing_type = ?' : ''}
            )
          )`);
          if (roomType && roomType !== 'All') params.push(roomType);
          params.push(moveInDate);
          if (roomType && roomType !== 'All') params.push(roomType);
        }

        for (const amenity of amenities) {
          conditions.push(`amenities LIKE ?`);
          params.push(`%"${amenity}"%`);
        }
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      if (collection === 'properties') {
        query += ` ORDER BY featured DESC, rating DESC, starting_price ASC`;
      }

      const { results } = await env.DB.prepare(query).bind(...params).all();
      const payload = results || [];

      if (collection === 'properties' && !id && env.CACHE && url.searchParams.toString()) {
        const cacheKey = `search:${url.searchParams.toString()}`;
        await env.CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: 300 });
      }

      const response = new Response(JSON.stringify(payload), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': collection === 'properties' && !id ? 'public, max-age=120' : 'private, no-store',
          'X-Cache': 'MISS',
        },
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error(`Error loading ${collection}:`, error);
      const response = new Response(JSON.stringify({ error: 'Database error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }
  }

  // POST request (create)
  if (request.method === 'POST') {
    if (!hasPermission(user.role, writePermission)) {
      const response = new Response(JSON.stringify({ error: 'Forbidden' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }

    try {
      const body = await request.json() as Record<string, unknown>;
      
      // Add organization_id if not present
      if (user.role !== 'admin' && !body.organization_id && collection !== 'system_settings' && collection !== 'role_permissions') {
        body.organization_id = organizationId;
      }

      const columns = Object.keys(body).join(', ');
      const placeholders = Object.keys(body).map(() => '?').join(', ');
      const values = Object.values(body);

      const query = `INSERT INTO ${collection} (${columns}) VALUES (${placeholders})`;
      await env.DB.prepare(query).bind(...values).run();

      // Add audit log
      await env.DB.prepare(`
        INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, timestamp, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        user.id,
        user.name || 'System',
        user.role,
        'API Record Created',
        collection,
        body.id,
        new Date().toISOString(),
        JSON.stringify({ newValue: body, propertyId: body.property_id })
      ).run();

      const response = new Response(JSON.stringify(body), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error(`Error creating ${collection}:`, error);
      const response = new Response(JSON.stringify({ error: 'Failed to create record' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }
  }

  // PUT request (update)
  if (request.method === 'PUT') {
    if (!id) {
      const response = new Response(JSON.stringify({ error: 'ID required for update' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }

    if (!hasPermission(user.role, writePermission)) {
      const response = new Response(JSON.stringify({ error: 'Forbidden' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }

    try {
      const body = await request.json() as Record<string, unknown>;

      // Check if record exists and belongs to organization
      const existingQuery = `SELECT * FROM ${collection} WHERE id = ?`;
      const { results: existingResults } = await env.DB.prepare(existingQuery).bind(id).all();
      
      if (!existingResults || existingResults.length === 0) {
        const response = new Response(JSON.stringify({ error: 'Record not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
        return addCorsHeaders(response);
      }

      const existing = existingResults[0] as Record<string, unknown>;
      
      // Check organization access
      if (user.role !== 'admin' && 
          collection !== 'system_settings' && 
          collection !== 'role_permissions' &&
          existing.organization_id !== organizationId) {
        const response = new Response(JSON.stringify({ error: 'Forbidden: organization isolation' }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
        return addCorsHeaders(response);
      }

      // Build update query
      const setClause = Object.keys(body).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(body), id];
      const query = `UPDATE ${collection} SET ${setClause} WHERE id = ?`;
      
      await env.DB.prepare(query).bind(...values).run();

      // Add audit log
      await env.DB.prepare(`
        INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, timestamp, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        user.id,
        user.name || 'System',
        user.role,
        'API Record Updated',
        collection,
        id,
        new Date().toISOString(),
        JSON.stringify({ previousValue: existing, newValue: body, propertyId: body.property_id, reason: body.reason })
      ).run();

      const updatedRecord = { ...existing, ...body };
      const response = new Response(JSON.stringify(updatedRecord), {
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error(`Error updating ${collection}:`, error);
      const response = new Response(JSON.stringify({ error: 'Failed to update record' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }
  }

  const response = new Response(JSON.stringify({ error: 'Method not allowed' }), { 
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  });
  return addCorsHeaders(response);
}
