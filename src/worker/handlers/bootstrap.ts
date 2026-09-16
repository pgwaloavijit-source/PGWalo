import { Env, User } from '../types';
import { addCorsHeaders } from '../utils/cors';
import { hasPermission } from '../middleware/auth';

const TABLES = [
  'organizations', 'properties', 'residents', 'beds', 'stays', 
  'rent_plans', 'invoices', 'payments', 'payment_allocations', 
  'deposit_transactions', 'notices', 'checkouts', 'audit_logs',
  'booking_requests', 'attendance_records', 'staff_members', 
  'staff_tasks', 'broadcast_notifications', 'meal_plans', 
  'chat_messages', 'maintenance_tickets', 'leads', 
  'electricity_meter_readings', 'security_deposit_records', 
  'rent_agreements', 'visitor_passes', 'system_settings', 'role_permissions'
];

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

export async function bootstrapHandler(request: Request, env: Env, user: User): Promise<Response> {
  const organizationId = user.organizationId || env.DEFAULT_ORGANIZATION_ID;

  if (request.method === 'GET') {
    const result: Record<string, unknown[]> = {};

    for (const table of TABLES) {
      const permission = READ_PERMISSIONS[table] || 'staff.view';
      
      if (!hasPermission(user.role, permission)) {
        result[table] = [];
        continue;
      }

      try {
        let query = `SELECT * FROM ${table}`;
        const params: unknown[] = [];

        // Filter by organization for non-admin users
        if (user.role !== 'admin' && table !== 'system_settings' && table !== 'role_permissions') {
          query += ` WHERE organization_id = ?`;
          params.push(organizationId);
        }

        const { results } = await env.DB.prepare(query).bind(...params).all();
        result[table] = results || [];
      } catch (error) {
        console.error(`Error loading ${table}:`, error);
        result[table] = [];
      }
    }

    const response = new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
    return addCorsHeaders(response);
  }

  if (request.method === 'POST') {
    if (!hasPermission(user.role, 'staff.permission_manage')) {
      const response = new Response(JSON.stringify({ error: 'Forbidden' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }

    try {
      const body = await request.json() as Record<string, unknown[]>;
      
      // Start a transaction
      await env.DB.batch([
        env.DB.prepare('BEGIN TRANSACTION')
      ]);

      for (const [table, rows] of Object.entries(body)) {
        if (!TABLES.includes(table) || table === 'audit_logs') continue;
        
        if (!Array.isArray(rows)) continue;

        for (const row of rows) {
          const typedRow = row as Record<string, unknown>;
          const columns = Object.keys(typedRow).join(', ');
          const placeholders = Object.keys(typedRow).map(() => '?').join(', ');
          const values = Object.values(typedRow);

          // Add organization_id if not present
          if (user.role !== 'admin' && !typedRow.organization_id) {
            typedRow.organization_id = organizationId;
          }

          const query = `INSERT OR REPLACE INTO ${table} (${columns}) VALUES (${placeholders})`;
          await env.DB.prepare(query).bind(...values).run();
        }
      }

      // Add audit log
      await env.DB.prepare(`
        INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, timestamp, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        user.id,
        user.name || 'System',
        user.role,
        'Bootstrap Snapshot Saved',
        'Database',
        new Date().toISOString(),
        JSON.stringify({ collections: Object.keys(body) })
      ).run();

      await env.DB.batch([
        env.DB.prepare('COMMIT')
      ]);

      const response = new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    } catch (error) {
      await env.DB.prepare('ROLLBACK').run();
      console.error('Bootstrap save error:', error);
      const response = new Response(JSON.stringify({ error: 'Failed to save bootstrap data' }), { 
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