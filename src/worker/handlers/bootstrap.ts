import { Env, User } from '../types';
import { addCorsHeaders } from '../utils/cors';
import { hasPermission } from '../middleware/auth';
import { limitForTable, tablesForRole } from '../utils/bootstrapScope';
import { isPlatformAdmin } from '../utils/platformAdmin';
import {
  rowToResident,
  rowToBed,
  rowToStay,
  rowToRentPlan,
  rowToInvoice,
  rowToPayment,
  rowToAllocation,
  rowToDepositTxn,
  rowToNotice,
  rowToCheckout,
  rowToAuditLog,
  rowToAgreement,
  rowToBookingRequest,
  rowToSupportTicket,
  rowToMaintenanceTicket,
  rowToStaffMember,
  rowToAttendanceRecord,
  rowToUserAccount,
  sanitizeRow,
} from '../utils/rowMap';

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
  broadcast_notifications: 'shared.view',
  meal_plans: 'shared.view',
  chat_messages: 'staff.view',
  maintenance_tickets: 'complaint.view',
  leads: 'staff.view',
  electricity_meter_readings: 'resident.view',
  security_deposit_records: 'deposit.view',
  rent_agreements: 'resident.view',
  visitor_passes: 'resident.view',
  system_settings: 'staff.view',
  role_permissions: 'staff.view',
};

// Map raw D1 rows to the camelCase shapes the client store expects.
const ROW_MAPPERS: Record<string, (row: Record<string, unknown>) => unknown> = {
  residents: rowToResident,
  booking_requests: rowToBookingRequest,
  beds: rowToBed,
  stays: rowToStay,
  rent_plans: rowToRentPlan,
  invoices: rowToInvoice,
  payments: rowToPayment,
  payment_allocations: rowToAllocation,
  deposit_transactions: rowToDepositTxn,
  notices: rowToNotice,
  checkouts: rowToCheckout,
  audit_logs: rowToAuditLog,
  rent_agreements: rowToAgreement,
  support_tickets: rowToSupportTicket,
  maintenance_tickets: rowToMaintenanceTicket,
  staff_members: rowToStaffMember,
  attendance_records: rowToAttendanceRecord,
  users: rowToUserAccount,
};

const ALL_TABLES = tablesForRole('admin');

/** Parents before children, so foreign keys resolve inside one batch. */
const WRITE_ORDER = [
  'organizations', 'properties', 'residents', 'staff_members', 'beds', 'stays',
  'rent_plans', 'invoices', 'payments', 'payment_allocations', 'deposit_transactions',
  'notices', 'checkouts', 'security_deposit_records', 'rent_agreements', 'visitor_passes',
  'maintenance_tickets', 'leads', 'attendance_records', 'staff_tasks',
  'broadcast_notifications', 'meal_plans', 'chat_messages', 'electricity_meter_readings',
  'system_settings', 'role_permissions', 'users',
];

const writeRank = (table: string) => {
  const index = WRITE_ORDER.indexOf(table);
  return index === -1 ? WRITE_ORDER.length : index;
};

/** `bedNumber` -> `bed_number`, `tenantDOB` -> `tenant_dob`. */
function toSnakeCase(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/** D1 can only bind primitives — arrays/objects are stored as JSON text. */
function coerceValue(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string') return value;
  try {
    const json = JSON.stringify(value);
    return json === undefined ? null : json;
  } catch {
    return null;
  }
}

// A signed-in resident must only ever receive their own ledger. These tables
// are keyed by `resident_id`; `residents` itself is matched on id/email.
// Without this every resident in the shared default organisation saw every
// other resident's rent, invoices and notices.
const RESIDENT_KEYED_TABLES = new Set([
  'stays', 'rent_plans', 'invoices', 'payments', 'payment_allocations',
  'deposit_transactions', 'notices', 'checkouts', 'rent_agreements', 'visitor_passes',
]);

// Resident-visible rows that are not keyed by `resident_id`: complaints are
// keyed by `resident_id`, personal notifications by `recipient_id`.
const RESIDENT_RELATED_TABLES = new Set([...RESIDENT_KEYED_TABLES, 'maintenance_tickets', 'broadcast_notifications', 'support_tickets', 'residents']);

export async function bootstrapHandler(request: Request, env: Env, user: User): Promise<Response> {
  const organizationId = user.organizationId || env.DEFAULT_ORGANIZATION_ID;
  const scopedTables = tablesForRole(user.role);

  if (request.method === 'GET') {
    const result: Record<string, unknown[]> = {};

    // Discover each table's real columns up front. The generic filters below
    // used to be applied blindly, and a WHERE on a column that does not exist
    // threw — swallowed into an empty array. That is why broadcasts, agreements,
    // meal plans and maintenance tickets never reached any dashboard: none of
    // those tables has an `organization_id` column.
    let scopedColumns = new Map<string, Set<string>>();
    try {
      const schemaRows = await env.DB.batch(
        scopedTables.map((table) => env.DB.prepare(`SELECT name FROM pragma_table_info('${table}')`))
      );
      scopedColumns = new Map(scopedTables.map((table, index) => {
        const results = (schemaRows[index]?.results || []) as { name: string }[];
        return [table, new Set(results.map((row) => row.name))] as const;
      }));
    } catch (error) {
      console.error('bootstrap schema probe failed:', error);
    }
    const columnsOf = (table: string) => scopedColumns.get(table) || new Set<string>();

    for (const table of scopedTables) {
      const permission = READ_PERMISSIONS[table] || 'staff.view';

      // A resident's own ledger is served here (requester-scoped below) rather
      // than through the org-wide collection routes, so the permission matrix
      // deliberately withholds 'resident.view' from the resident role.
      const residentLedger =
        user.role === 'resident' &&
        (table === 'residents' ||
          table === 'support_tickets' ||
          table === 'broadcast_notifications' ||
          RESIDENT_KEYED_TABLES.has(table));

      if (!residentLedger && !hasPermission(user.role, permission)) {
        result[table] = [];
        continue;
      }

      try {
        const conditions: string[] = [];
        const params: unknown[] = [];
        const columns = columnsOf(table);

        // A resident's own rows live in their *owner's* organisation, not the
        // default one they signed up under, so organisation scoping hid the very
        // records they need. For those tables the requester scope below is
        // strictly tighter than the org filter, so it replaces it.
        const residentOwnRows =
          user.role === 'resident' &&
          RESIDENT_RELATED_TABLES.has(table);

        if (!isPlatformAdmin(user.role) && !residentOwnRows && columns.has('organization_id')) {
          conditions.push('organization_id = ?');
          params.push(organizationId);
        }

        if (user.role === 'resident') {
          const email = (user.email || '').toLowerCase();
          if (table === 'residents') {
            conditions.push('(id = ? OR id = ? OR LOWER(email) = ?)');
            params.push(user.id, `res-${user.id}`, email);
          } else if (table === 'maintenance_tickets' && columns.has('resident_id')) {
            // Complaints are matched by the linked resident record or, failing
            // that, the account that raised them.
            conditions.push('(resident_id = ? OR requester_id = ? OR resident_id = ?)');
            params.push(user.id, user.id, `res-${user.id}`);
          } else if (RESIDENT_KEYED_TABLES.has(table) && columns.has('resident_id')) {
            conditions.push(
              'resident_id IN (SELECT id FROM residents WHERE id = ? OR id = ? OR LOWER(email) = ?)'
            );
            params.push(user.id, `res-${user.id}`, email);
          } else if (table === 'support_tickets' && columns.has('requester_id')) {
            conditions.push('requester_id = ?');
            params.push(user.id);
          } else if (table === 'broadcast_notifications' && columns.has('recipient_id')) {
            // Announcements plus anything addressed to this account personally.
            conditions.push('(recipient_id IS NULL OR recipient_id = ?)');
            params.push(user.id);
          }
        }

        let query = `SELECT * FROM ${table}`;
        if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;

        const limit = limitForTable(table);
        if (limit) {
          query += ` ORDER BY rowid DESC LIMIT ${limit}`;
        }

        const { results } = await env.DB.prepare(query).bind(...params).all();
        // Never ship credential hashes, then map D1 snake_case -> client camelCase.
        const rows = (results || []).map((row) => sanitizeRow(row as Record<string, unknown>));
        const mapper = ROW_MAPPERS[table];
        result[table] = mapper ? rows.map((row) => mapper(row)) : rows;
      } catch (error) {
        console.error(`Error loading ${table}:`, error);
        result[table] = [];
      }
    }

    const response = new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-store',
      },
    });
    return addCorsHeaders(response);
  }

  if (request.method === 'POST') {
    if (!hasPermission(user.role, 'staff.permission_manage')) {
      const response = new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(response);
    }

    try {
      const body = await request.json() as Record<string, unknown>;
      const platformAdmin = isPlatformAdmin(user.role);

      const payload = (Object.entries(body) as [string, unknown][]).filter(
        ([table, rows]) =>
          ALL_TABLES.includes(table) &&
          table !== 'audit_logs' &&
          Array.isArray(rows) &&
          rows.length > 0
      ) as [string, Record<string, unknown>[]][];

      if (!payload.length) {
        return addCorsHeaders(new Response(JSON.stringify({ ok: true, written: {} }), {
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      payload.sort((a, b) => writeRank(a[0]) - writeRank(b[0]));

      // Resolve each table's real columns first. The client sends camelCase
      // objects that carry fields with no column at all (`listingStatus`,
      // `floors`, …); without this filter a single stray key aborted the whole
      // sync with "no column named …", which is why nothing ever persisted.
      const columnRows = await env.DB.batch(
        payload.map(([table]) => env.DB.prepare(
          `SELECT name, type, "notnull" AS required, dflt_value AS dflt FROM pragma_table_info('${table}')`
        ))
      );
      const columnsByTable = new Map<string, Set<string>>();
      // Columns declared NOT NULL without a default must always be bound, even
      // when the client object omits them (an older cached row, an optional
      // field). Otherwise inserting one row throws and the whole collection —
      // bed, agreement, notice — is silently dropped.
      const requiredByTable = new Map<string, Map<string, string | number>>();
      payload.forEach(([table], index) => {
        const results = (columnRows[index]?.results || []) as {
          name: string;
          type: string;
          required: number;
          dflt: string | null;
        }[];
        columnsByTable.set(table, new Set(results.map((row) => row.name)));
        const required = new Map<string, string | number>();
        for (const column of results) {
          if (column.required && column.dflt === null && column.name !== 'id') {
            required.set(column.name, /INT|REAL|NUM|DEC|FLOA|DOUB/i.test(column.type || '') ? 0 : '');
          }
        }
        requiredByTable.set(table, required);
      });

      // Some tables carry a UNIQUE constraint on a natural key (`meal_plans.day`,
      // `users.email`) rather than relying on the id. `ON CONFLICT(id)` cannot
      // express that, so a row carrying a different id for the same natural key
      // failed the whole collection. Those tables fall back to REPLACE.
      let naturalKeyTables = new Set<string>();
      try {
        const ddlRows = await env.DB.batch(
          payload.map(([table]) => env.DB.prepare(
            `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = '${table}'`
          ))
        );
        payload.forEach(([table], index) => {
          const ddl = (ddlRows[index]?.results || []) as { sql: string | null }[];
          if (ddl[0]?.sql && /\bUNIQUE\b/i.test(ddl[0].sql)) naturalKeyTables.add(table);
        });
      } catch (error) {
        console.error('bootstrap ddl probe failed:', error);
        naturalKeyTables = new Set<string>();
      }

      const written: Record<string, number> = {};
      const failed: Record<string, string> = {};

      // One atomic batch per table (parents first). A malformed row in one
      // collection must not roll back the user's bed allotment, agreement or
      // notice — which is exactly what a single all-or-nothing batch did.
      for (const [table, rows] of payload) {
        const available = columnsByTable.get(table);
        if (!available || !available.has('id')) continue;
        const required = requiredByTable.get(table) || new Map<string, string | number>();

        const statements: ReturnType<Env['DB']['prepare']>[] = [env.DB.prepare('PRAGMA defer_foreign_keys = ON')];
        let queued = 0;

        for (const row of rows) {
          const mapped: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            const column = toSnakeCase(key);
            if (!available.has(column) || value === undefined) continue;
            mapped[column] = coerceValue(value);
          }
          if (!mapped.id) continue;
          // Owners may only ever write inside their own organisation.
          if (!platformAdmin && available.has('organization_id')) {
            mapped.organization_id = organizationId;
          }
          for (const [column, placeholder] of required) {
            if (mapped[column] === undefined) mapped[column] = placeholder;
          }

          const keys = Object.keys(mapped);
          const placeholders = keys.map(() => '?').join(', ');
          const updates = keys.filter((key) => key !== 'id').map((key) => `${key} = excluded.${key}`);
          // Upsert, not INSERT OR REPLACE: REPLACE deletes and re-inserts the
          // row, which would reset created_at and any column the snapshot omits.
          // Tables with a natural UNIQUE key have no choice but to REPLACE.
          const sql = naturalKeyTables.has(table)
            ? `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`
            : updates.length
              ? `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates.join(', ')}`
              : `INSERT OR IGNORE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
          statements.push(env.DB.prepare(sql).bind(...keys.map((key) => mapped[key])));
          queued += 1;
        }

        if (!queued) continue;
        try {
          await env.DB.batch(statements);
          written[table] = (written[table] || 0) + queued;
        } catch (tableError) {
          failed[table] = tableError instanceof Error ? tableError.message : String(tableError);
          console.error(`Bootstrap save failed for ${table}:`, tableError);
        }
      }

      if (Object.keys(failed).length) {
        console.warn('Bootstrap snapshot partially applied:', JSON.stringify(failed));
      }

      const auditStatement = env.DB.prepare(`
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
        JSON.stringify({ collections: Object.keys(written) })
      );

      // D1 batches are atomic; explicit BEGIN/COMMIT are rejected by the D1 API.
      // The audit write must never fail the user's actual save.
      await env.DB.batch([auditStatement]).catch((error) => {
        console.error('Bootstrap audit write failed:', error);
      });

      return addCorsHeaders(new Response(JSON.stringify({
        ok: Object.keys(written).length > 0,
        written,
        ...(Object.keys(failed).length ? { failed } : {}),
      }), {
        headers: { 'Content-Type': 'application/json' },
      }));
    } catch (error) {
      console.error('Bootstrap save error:', error);
      return addCorsHeaders(new Response(JSON.stringify({
        error: 'Failed to save bootstrap data',
        detail: error instanceof Error ? error.message : String(error),
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }));
    }
  }

  const response = new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
  return addCorsHeaders(response);
}
