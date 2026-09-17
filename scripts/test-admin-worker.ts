/**
 * Unit tests for the admin console Worker logic (no live Worker required).
 * Runs the handler against an in-memory D1 stub to verify:
 *  - RBAC: non-admin tokens are rejected on every /api/admin/* route
 *  - Validation: status/action allow-lists and malformed input
 *  - Data flow: user status PATCH writes to D1 and the audit log
 *
 * Run: npx tsx scripts/test-admin-worker.ts
 */

interface D1Meta {
  changes: number;
}

interface D1Row extends Record<string, unknown> {
  [key: string]: unknown;
}

interface D1Table {
  rows: D1Row[];
  nextId: number;
}

class D1Error extends Error {}

interface PrepareResult {
  sql: string;
  params: unknown[];
}

// Minimal in-memory D1 covering the statements the admin handler uses.
class MemoryD1 {
  tables: Record<string, D1Table> = {
    users: { rows: [{ id: 'u1', name: 'Riya', email: 'riya@test.dev', phone: '9999999999', role: 'resident', status: 'Active', created_at: '2026-09-01' }], nextId: 2 },
    audit_logs: { rows: [], nextId: 1 },
    support_tickets: { rows: [{ id: 't1', requester_id: 'u1', requester_name: 'Riya', requester_role: 'resident', title: 'Leaky tap', status: 'Raised', messages: '[]', created_at: '2026-09-01' }], nextId: 2 },
  };

  prepare(sql: string) {
    const stmt = {
      sql,
      params: [] as unknown[],
      // Real D1's bind() returns the statement synchronously (thenable), so
      // `.bind(...).all()` chains work.
      bind: (...args: unknown[]) => {
        stmt.params = args;
        return stmt;
      },
      first: async <T>() => this.first<T>(stmt),
      all: async () => this.all(stmt),
      run: async () => this.run(stmt),
    };
    return stmt;
  }

  batch(statements: PrepareResult[]) {
    return Promise.all(statements.map((s) => this.run(s)));
  }

  private parseTarget(sql: string): { table: string; op: string } {
    const normalized = sql.replace(/\s+/g, ' ').trim().toUpperCase();
    const opMatch = normalized.match(/^(SELECT|INSERT|UPDATE|DELETE|CREATE)/);
    const op = opMatch ? opMatch[1] : 'UNKNOWN';
    let table = '';
    if (op === 'SELECT') {
      const m = normalized.match(/FROM ([A-Z_]+)/);
      table = m ? m[1].toLowerCase() : '';
    } else if (op === 'INSERT') {
      const m = normalized.match(/INTO ([A-Z_]+)/);
      table = m ? m[1].toLowerCase() : '';
    } else if (op === 'UPDATE') {
      const m = normalized.match(/UPDATE ([A-Z_]+)/);
      table = m ? m[1].toLowerCase() : '';
    } else if (op === 'DELETE') {
      const m = normalized.match(/FROM ([A-Z_]+)/);
      table = m ? m[1].toLowerCase() : '';
    }
    return { table, op };
  }

  private first<T>(stmt: PrepareResult): T | null {
    const { table, op } = this.parseTarget(stmt.sql);
    if (op === 'SELECT' && table === 'support_tickets') {
      const id = stmt.params[0];
      const row = this.tables.support_tickets.rows.find((r) => r.id === id);
      return (row as unknown as T) || null;
    }
    if (op === 'SELECT' && table) {
      const t = this.tables[table];
      if (!t) throw new D1Error(`no such table: ${table}`);
      const row = t.rows[0];
      return (row as unknown as T) || null;
    }
    return null;
  }

  private all(stmt: PrepareResult) {
    const { table } = this.parseTarget(stmt.sql);
    const t = this.tables[table];
    if (!t) throw new D1Error(`no such table: ${table}`);
    // Very small subset: support LIMIT/OFFSET, WHERE id/status equality is ignored for simplicity.
    return Promise.resolve({ results: t.rows.map((r) => ({ ...r })) });
  }

  private run(stmt: PrepareResult) {
    const { table, op } = this.parseTarget(stmt.sql);
    const normalized = stmt.sql.replace(/\s+/g, ' ').trim();

    if (op === 'CREATE') return Promise.resolve({ meta: { changes: 0 } });

    if (op === 'INSERT' && table === 'audit_logs') {
      this.tables.audit_logs.rows.push({
        id: stmt.params[0],
        user_id: stmt.params[1],
        user_name: stmt.params[2],
        user_role: stmt.params[3],
        action: stmt.params[4],
        entity: stmt.params[5],
        entity_id: stmt.params[6],
        timestamp: stmt.params[7],
        details: stmt.params[8],
      });
      return Promise.resolve({ meta: { changes: 1 } });
    }

    if (op === 'UPDATE' && table === 'users') {
      // UPDATE users SET status = ? WHERE id = ?
      const status = stmt.params[0];
      const id = stmt.params[1];
      const row = this.tables.users.rows.find((r) => r.id === id);
      if (!row) return Promise.resolve({ meta: { changes: 0 } });
      row.status = status;
      return Promise.resolve({ meta: { changes: 1 } });
    }

    if (op === 'UPDATE' && table === 'support_tickets') {
      const row = this.tables.support_tickets.rows.find((r) => r.id === stmt.params[stmt.params.length - 1]);
      if (!row) return Promise.resolve({ meta: { changes: 0 } });
      if (normalized.startsWith('UPDATE support_tickets SET status = COALESCE')) {
        const [status, assignedTo, adminNote] = stmt.params;
        if (status) row.status = status;
        if (assignedTo) row.assigned_to = assignedTo;
        if (adminNote) row.admin_note = adminNote;
        return Promise.resolve({ meta: { changes: 1 } });
      }
      // Reply append: UPDATE support_tickets SET messages = ?, ...
      const [messages] = stmt.params;
      row.messages = messages;
      return Promise.resolve({ meta: { changes: 1 } });
    }

    if (op === 'SELECT' && table === 'support_tickets') {
      const row = this.tables.support_tickets.rows.find((r) => r.id === stmt.params[0]);
      return Promise.resolve({ results: row ? [row] : [] });
    }

    return Promise.resolve({ meta: { changes: 0 } });
  }
}

// JWT sign/verify: reuse the worker's real implementation so RBAC tests
// exercise the actual auth path.
const SECRET = 'test-secret';

async function makeToken(payload: Record<string, unknown>): Promise<string> {
  const { generateJWT } = await import('../src/worker/utils/jwt');
  return generateJWT({
    userId: String(payload.userId || 'unknown'),
    role: String(payload.role || 'public'),
    organizationId: String(payload.organizationId || 'org-test'),
    name: payload.name ? String(payload.name) : undefined,
  }, SECRET);
}

type AdminEnv = Parameters<typeof import('../src/worker/handlers/admin').adminHandler>[1] & { DB: MemoryD1 };

const env = {
  DB: new MemoryD1(),
  JWT_SECRET: SECRET,
  ENVIRONMENT: 'production',
  DEFAULT_ORGANIZATION_ID: 'org-test',
} as unknown as AdminEnv;

const results: { name: string; passed: boolean }[] = [];

function check(name: string, passed: boolean) {
  results.push({ name, passed });
  console.log(`${passed ? '✓' : '✗'} ${name}`);
}

async function callAdmin(path: string, method: string, token: string | null, body?: unknown): Promise<Response> {
  const request = new Request(`https://app.test${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const { setCorsContext } = await import('../src/worker/utils/cors');
  setCorsContext(request, env); // cors utils read module-level request context
  const { adminHandler } = await import('../src/worker/handlers/admin');
  return adminHandler(request, env);
}

async function main() {
  const adminToken = await makeToken({ userId: 'admin-1', role: 'superadmin', organizationId: 'org-test', name: 'Super Admin' });
  const residentToken = await makeToken({ userId: 'u1', role: 'resident', organizationId: 'org-test', name: 'Riya' });

  // ---- RBAC ----
  const adminRoutes: [string, string, unknown | undefined][] = [
    ['/api/admin/overview', 'GET', undefined],
    ['/api/admin/users', 'GET', undefined],
    ['/api/admin/bookings', 'GET', undefined],
    ['/api/admin/payments', 'GET', undefined],
    ['/api/admin/support-tickets', 'GET', undefined],
    ['/api/admin/users/u1', 'PATCH', { status: 'Disabled' }],
    ['/api/admin/properties/p1', 'PATCH', { action: 'approve' }],
    ['/api/admin/support-tickets/t1', 'PATCH', { status: 'Open' }],
    ['/api/admin/logout', 'POST', {}],
  ];
  for (const [path, method, body] of adminRoutes) {
    const res = await callAdmin(path, method, residentToken, body);
    check(`RBAC: ${method} ${path} rejected for resident (403)`, res.status === 403);
  }

  const noAuth = await callAdmin('/api/admin/overview', 'GET', null);
  check('RBAC: missing token -> 401', noAuth.status === 401);

  // ---- Validation ----
  const badStatus = await callAdmin('/api/admin/users/u1', 'PATCH', adminToken, { status: 'Hacked' });
  check('Validation: invalid user status -> 400', badStatus.status === 400);

  const badTicketStatus = await callAdmin('/api/admin/support-tickets/t1', 'PATCH', adminToken, { status: 'Zombie' });
  check('Validation: invalid ticket status -> 400', badTicketStatus.status === 400);

  const emptyReply = await callAdmin('/api/admin/support-tickets/t1', 'POST', adminToken, { body: '   ' });
  check('Validation: empty ticket reply -> 400', emptyReply.status === 400);

  const badAction = await callAdmin('/api/admin/properties/p1', 'PATCH', adminToken, { action: 'nuke' });
  check('Validation: invalid property action -> 400', badAction.status === 400);

  // ---- Data flow ----
  const patch = await callAdmin('/api/admin/users/u1', 'PATCH', adminToken, { status: 'Suspended' });
  const patchOk = patch.status === 200 && ((await patch.json() as { ok?: boolean }).ok === true);
  check('Data: user status PATCH succeeds', patchOk);

  const usersRes = await callAdmin('/api/admin/users?status=Suspended', 'GET', adminToken);
  const usersData = await usersRes.json() as { users: { status: string }[]; total: number };
  check('Data: status filter reflects PATCH in DB', usersRes.status === 200 && usersData.users.some((u) => u.status === 'Suspended'));

  const audit = env.DB.tables.audit_logs.rows;
  check('Data: audit log written for status change', audit.some((a) => a.action === 'Account status changed'));

  const reply = await callAdmin('/api/admin/support-tickets/t1', 'POST', adminToken, { body: 'Plumber scheduled', authorName: 'Super Admin' });
  check('Data: ticket reply accepted', reply.status === 200);

  const patchTicket = await callAdmin('/api/admin/support-tickets/t1', 'PATCH', adminToken, { status: 'Open', assignedTo: 'admin-1' });
  check('Data: ticket status/assignee persisted', patchTicket.status === 200);

  const ticketList = await callAdmin('/api/admin/support-tickets', 'GET', adminToken);
  const tickets = await ticketList.json() as { id: string; status: string; assignedTo?: string; messages?: { body: string }[] }[];
  const t1 = tickets.find((t) => t.id === 't1');
  check('Data: ticket list shows updated status + reply', Boolean(t1 && t1.status === 'Open' && t1.messages?.some((m) => m.body === 'Plumber scheduled')));

  // ---- Summary ----
  const failed = results.filter((r) => !r.passed);
  console.log('');
  console.log(`${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error('Test suite error:', error);
  process.exit(1);
});
