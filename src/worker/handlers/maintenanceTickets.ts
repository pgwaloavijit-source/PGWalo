import { Env, User } from '../types';
import { addCorsHeaders } from '../utils/cors';
import { authMiddleware, hasPermission } from '../middleware/auth';
import { rowToMaintenanceTicket } from '../utils/rowMap';
import { deliverEmail } from '../utils/otp';

function json(data: unknown, status = 200) {
  return addCorsHeaders(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  }));
}

function ensureTable(env: Env) {
  return env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS maintenance_tickets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      room_number TEXT NOT NULL,
      resident_name TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Reported',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      assigned_staff_name TEXT,
      sla_deadline TEXT,
      photo_url TEXT,
      cost REAL,
      resolution_notes TEXT,
      updated_at TEXT,
      organization_id TEXT,
      resident_id TEXT,
      requester_id TEXT,
      property_id TEXT,
      property_name TEXT,
      escalated_at TEXT
    )
  `).run();
}

/** Columns that may not exist on older databases — added by migrations. */
// Every column the handler writes or reads conditionally — including the ones
// in the original CREATE TABLE, not just later migrations. omitting a base
// column here silently dropped the write: `assigned_staff_name`,
// `resolution_notes` and `cost` were guarded by this probe and never persisted.
const OPTIONAL_COLUMNS = [
  'updated_at', 'organization_id', 'resident_id', 'requester_id', 'property_id',
  'property_name', 'escalated_at', 'photo_url',
  'assigned_staff_name', 'resolution_notes', 'cost',
] as const;

async function optionalColumns(env: Env): Promise<Set<string>> {
  const { results } = await env.DB.prepare(
    `SELECT name FROM pragma_table_info('maintenance_tickets')`
  ).all();
  const present = new Set((results || []).map((r) => String(r.name)));
  return new Set(OPTIONAL_COLUMNS.filter((c) => present.has(c)));
}

/**
 * The warden/staff inbox is org-scoped; the resident's own tickets are
 * requester-scoped. Owners and platform admins see the whole table for their
 * level. Returns null when the caller lacks complaint.view.
 */
/**
 * Row-level scope shared by the ticket list and the overview aggregates — one
 * definition keeps the stats from ever seeing more than the caller may read.
 * Returns null when the role has no complaint access at all.
 */
function ticketScope(user: User): { conditions: string[]; params: unknown[] } | null {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (user.role === 'resident') {
    conditions.push('(resident_id = ? OR requester_id = ?)');
    params.push(user.id, user.id);
  } else if (user.role === 'staff') {
    // Staff see only the properties they are assigned to.
    conditions.push(`property_id IN (SELECT id FROM properties WHERE owner_user_id IN (
      SELECT owner_user_id FROM organizations WHERE id = ?
    ) OR owner_user_id = (SELECT owner_user_id FROM organizations WHERE id = ?))`);
    params.push(user.organizationId || '', user.organizationId || '');
    const propertyId = (user as unknown as { propertyId?: string }).propertyId;
    if (propertyId) {
      conditions.push('property_id = ?');
      params.push(propertyId);
    }
    // Staff cannot see who raised the complaint beyond the name in the ticket.
  } else if (['warden', 'manager', 'accountant'].includes(user.role)) {
    conditions.push('organization_id = ?');
    params.push(user.organizationId || '');
  } else if (['owner', 'admin', 'superadmin'].includes(user.role)) {
    if (user.role === 'owner' && user.organizationId) {
      conditions.push('organization_id = ?');
      params.push(user.organizationId);
    }
    // Platform admins see everything.
  } else {
    return null;
  }

  return { conditions, params };
}

async function listTickets(env: Env, user: User): Promise<Response> {
  const scope = ticketScope(user);
  if (!scope) return json({ error: 'Forbidden' }, 403);
  const { conditions, params } = scope;

  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  const { results } = await env.DB.prepare(
    `SELECT * FROM maintenance_tickets${where} ORDER BY created_at DESC LIMIT 200`
  ).bind(...params).all();
  return json((results || []).map((row) => rowToMaintenanceTicket(row as Record<string, unknown>)));
}

/**
 * Complaint SLA + staff performance rollup for the owner's maintenance tab.
 *
 * All arithmetic happens in SQL over the caller's scoped rows, so the numbers
 * cover the whole organisation rather than whatever the browser happens to
 * hold. `nowIso` is passed in as a bound parameter (never SQLite's
 * `datetime('now')`) because the stored timestamps are ISO-8601 with a `T`
 * separator — comparing them against SQLite's space-separated format silently
 * fails for anything due the same day.
 */
async function overview(env: Env, user: User): Promise<Response> {
  const scope = ticketScope(user);
  if (!scope) return json({ error: 'Forbidden' }, 403);
  if (user.role === 'resident' || user.role === 'staff') {
    // The overview is an operator view (org-wide). Keep it off resident and
    // field-staff sessions even though they can list their own tickets.
    return json({ error: 'Forbidden' }, 403);
  }

  const cols = await optionalColumns(env);
  const nowIso = new Date().toISOString();
  const whereSql = scope.conditions.length ? `WHERE ${scope.conditions.join(' AND ')}` : '';
  const and = scope.conditions.length ? ' AND ' : 'WHERE ';
  const params = scope.params;

  const isOpen = `status IN ('Reported', 'In-Progress')`;
  const isDone = `status IN ('Resolved', 'Closed')`;
  const hoursExpr = `(julianday(updated_at) - julianday(created_at)) * 24`;
  const lateExpr = `SUM(CASE WHEN ${isDone} AND sla_deadline IS NOT NULL AND updated_at > sla_deadline THEN 1 ELSE 0 END)`;
  const escalatedExpr = cols.has('escalated_at')
    ? `SUM(CASE WHEN escalated_at IS NOT NULL THEN 1 ELSE 0 END)`
    : '0';
  const unassignedExpr = `SUM(CASE WHEN ${isOpen} AND (assigned_staff_name IS NULL OR assigned_staff_name = '') THEN 1 ELSE 0 END)`;

  const summarySql = `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN ${isOpen} THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved_count,
      SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS closed_count,
      SUM(CASE WHEN sla_deadline IS NOT NULL AND sla_deadline <= ? AND ${isOpen} THEN 1 ELSE 0 END) AS breached_open,
      SUM(CASE WHEN ${isDone} AND sla_deadline IS NOT NULL THEN 1 ELSE 0 END) AS done_with_deadline,
      SUM(CASE WHEN ${isDone} AND sla_deadline IS NOT NULL AND updated_at <= sla_deadline THEN 1 ELSE 0 END) AS resolved_in_sla,
      AVG(CASE WHEN ${isDone} THEN ${hoursExpr} END) AS avg_hours,
      ${unassignedExpr} AS unassigned,
      ${escalatedExpr} AS escalated
    FROM maintenance_tickets
    ${whereSql}`;

  const byPrioritySql = `
    SELECT
      COALESCE(NULLIF(priority, ''), 'Normal') AS priority,
      COUNT(*) AS total,
      SUM(CASE WHEN ${isOpen} THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN ${isDone} THEN 1 ELSE 0 END) AS resolved_count,
      SUM(CASE WHEN sla_deadline IS NOT NULL AND sla_deadline <= ? AND ${isOpen} THEN 1 ELSE 0 END) AS breached_open,
      SUM(CASE WHEN ${isDone} AND sla_deadline IS NOT NULL THEN 1 ELSE 0 END) AS done_with_deadline,
      SUM(CASE WHEN ${isDone} AND sla_deadline IS NOT NULL AND updated_at <= sla_deadline THEN 1 ELSE 0 END) AS resolved_in_sla,
      AVG(CASE WHEN ${isDone} THEN ${hoursExpr} END) AS avg_hours
    FROM maintenance_tickets
    ${whereSql}
    GROUP BY COALESCE(NULLIF(priority, ''), 'Normal')`;

  const staffSql = `
    SELECT
      assigned_staff_name AS name,
      COUNT(*) AS assigned,
      SUM(CASE WHEN ${isOpen} THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN ${isDone} THEN 1 ELSE 0 END) AS resolved_count,
      AVG(CASE WHEN ${isDone} THEN ${hoursExpr} END) AS avg_hours,
      ${lateExpr} AS late_resolutions,
      ${escalatedExpr} AS escalations
    FROM maintenance_tickets
    ${whereSql}${and}assigned_staff_name IS NOT NULL AND assigned_staff_name != ''
    GROUP BY assigned_staff_name
    ORDER BY resolved_count DESC, assigned DESC`;

  // Resolution durations for the median — bounded to the same scope, so the
  // owner's median is computed over their own complaints only.
  const durationsSql = `
    SELECT ${hoursExpr} AS hours
    FROM maintenance_tickets
    ${whereSql}${and}${isDone}
    ORDER BY hours ASC
    LIMIT 500`;

  const breachedSql = `
    SELECT id, title, priority, status, created_at, sla_deadline${cols.has('escalated_at') ? ', escalated_at' : ''},
           assigned_staff_name, property_name, room_number
    FROM maintenance_tickets
    ${whereSql}${and}sla_deadline IS NOT NULL AND sla_deadline <= ? AND ${isOpen}
    ORDER BY sla_deadline ASC
    LIMIT 10`;

  const num = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const round1 = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);
  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

  try {
    const summary = await env.DB.prepare(summarySql).bind(nowIso, ...params).first<Record<string, unknown>>();
    const { results: priorityRows } = await env.DB.prepare(byPrioritySql).bind(nowIso, ...params).all<Record<string, unknown>>();
    const { results: staffRows } = await env.DB.prepare(staffSql).bind(...params).all<Record<string, unknown>>();
    const { results: durationRows } = await env.DB.prepare(durationsSql).bind(...params).all<Record<string, unknown>>();
    // Note the bind order: in this query the deadline `?` sits after the scope
    // placeholders, unlike the aggregate queries where it leads.
    const { results: breachRows } = await env.DB.prepare(breachedSql).bind(...params, nowIso).all<Record<string, unknown>>();

    const durations = (durationRows || [])
      .map((row) => num(row.hours))
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b);
    const median = durations.length === 0
      ? null
      : durations.length % 2 === 1
        ? durations[(durations.length - 1) / 2]
        : (durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2;

    const doneWithDeadline = num(summary?.done_with_deadline) || 0;
    const resolvedInSla = num(summary?.resolved_in_sla) || 0;

    return json({
      totals: {
        total: num(summary?.total) || 0,
        open: num(summary?.open_count) || 0,
        resolved: num(summary?.resolved_count) || 0,
        closed: num(summary?.closed_count) || 0,
        unassigned: num(summary?.unassigned) || 0,
        escalated: num(summary?.escalated) || 0,
      },
      sla: {
        breachedOpen: num(summary?.breached_open) || 0,
        resolvedInSla,
        resolvedLate: Math.max(0, doneWithDeadline - resolvedInSla),
        withinSlaPct: pct(resolvedInSla, doneWithDeadline),
        avgResolutionHours: round1(num(summary?.avg_hours)),
        medianResolutionHours: round1(median),
        byPriority: (priorityRows || []).map((row) => ({
          priority: String(row.priority || 'Normal'),
          total: num(row.total) || 0,
          open: num(row.open_count) || 0,
          resolved: num(row.resolved_count) || 0,
          breachedOpen: num(row.breached_open) || 0,
          avgResolutionHours: round1(num(row.avg_hours)),
          withinSlaPct: pct(num(row.resolved_in_sla) || 0, num(row.done_with_deadline) || 0),
        })),
      },
      staff: (staffRows || []).map((row) => ({
        name: String(row.name || 'Unassigned'),
        assigned: num(row.assigned) || 0,
        open: num(row.open_count) || 0,
        resolved: num(row.resolved_count) || 0,
        avgResolutionHours: round1(num(row.avg_hours)),
        lateResolutions: num(row.late_resolutions) || 0,
        escalations: num(row.escalations) || 0,
      })),
      breached: (breachRows || []).map((row) => ({
        id: String(row.id),
        title: String(row.title || ''),
        priority: String(row.priority || 'Normal'),
        status: String(row.status || 'Reported'),
        roomNumber: row.room_number ? String(row.room_number) : undefined,
        propertyName: row.property_name ? String(row.property_name) : undefined,
        assignedStaffName: row.assigned_staff_name ? String(row.assigned_staff_name) : undefined,
        createdAt: String(row.created_at || ''),
        slaDeadline: row.sla_deadline ? String(row.sla_deadline) : undefined,
        escalatedAt: row.escalated_at ? String(row.escalated_at) : undefined,
      })),
      generatedAt: nowIso,
    });
  } catch (error) {
    console.error('maintenance overview', error);
    return json({ error: 'Could not build the maintenance overview' }, 500);
  }
}

/** Best-effort personal notification; never fails the ticket mutation. */
async function notifyResident(env: Env, recipientId: string, title: string, message: string) {
  try {
    await env.DB.prepare(`
      INSERT INTO broadcast_notifications
        (id, title, message, category, target, timestamp, sender, read, created_at, recipient_id)
      VALUES (?, ?, ?, 'Maintenance', 'All Residents', ?, 'PGWalo Maintenance', 0, ?, ?)
    `).bind(
      `bc-maint-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      message,
      new Date().toISOString(),
      new Date().toISOString(),
      recipientId
    ).run();
  } catch (error) {
    console.error('maintenance notification', error);
  }
}

/** Org id of the org that owns the property the complaint is about. */
async function ownerOrgForProperty(env: Env, propertyId: string | null): Promise<string | null> {
  if (!propertyId) return null;
  try {
    const row = await env.DB.prepare(
      `SELECT o.id AS org_id
         FROM properties p
         JOIN organizations o ON o.owner_user_id = p.owner_user_id
        WHERE p.id = ?
        LIMIT 1`
    ).bind(propertyId).first<{ org_id: string }>();
    return row?.org_id || null;
  } catch {
    return null;
  }
}

export async function maintenanceTicketsHandler(request: Request, env: Env): Promise<Response> {
  const auth = await authMiddleware(request, env);
  if (!auth.success || !auth.user) return json({ error: auth.error || 'Authentication required' }, 401);
  const user = auth.user;

  await ensureTable(env).catch(() => undefined);

  if (request.method === 'GET') {
    try {
      if (new URL(request.url).searchParams.get('view') === 'overview') {
        return await overview(env, user);
      }
      return await listTickets(env, user);
    } catch (error) {
      console.error('maintenance tickets get', error);
      return json({ error: 'Could not load tickets' }, 500);
    }
  }

  if (request.method === 'POST') {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || 'raise');

    // ---- on-demand escalation sweep (owner / platform admin) -------------
    if (action === 'escalation-sweep') {
      if (!['owner', 'admin', 'superadmin'].includes(user.role)) {
        return json({ error: 'Not allowed' }, 403);
      }
      const result = await escalationSweep(env);
      return json({ success: true, ...result });
    }

    // ---- test hook: stage an SLA breach (staff+; used by the e2e suite) --
    if (action === 'sla-force-breach') {
      if (!hasPermission(user.role, 'complaint.resolve') && !['owner', 'admin', 'superadmin'].includes(user.role)) {
        return json({ error: 'Not allowed' }, 403);
      }
      const ticketId = String(body.id || '').trim();
      if (!ticketId) return json({ error: 'id is required' }, 400);
      const backdated = new Date(Date.now() - 3_600_000).toISOString();
      await env.DB.prepare(
        `UPDATE maintenance_tickets SET sla_deadline = ?, escalated_at = NULL WHERE id = ?`
      ).bind(backdated, ticketId).run();
      return json({ success: true, id: ticketId, slaDeadline: backdated });
    }

    // ---- status change (staff / warden / manager / owner) ----------------
    if (action === 'status') {
      if (!hasPermission(user.role, 'complaint.resolve') && !['owner', 'admin', 'superadmin'].includes(user.role)) {
        return json({ error: 'Not allowed' }, 403);
      }
      const ticketId = String(body.id || '').trim();
      const status = String(body.status || '').trim();
      const allowed = ['Reported', 'In-Progress', 'Resolved', 'Closed'];
      if (!ticketId || !allowed.includes(status)) return json({ error: 'id and a valid status are required' }, 400);

      const ticket = await env.DB.prepare(
        `SELECT * FROM maintenance_tickets WHERE id = ?`
      ).bind(ticketId).first<Record<string, unknown>>();
      if (!ticket) return json({ error: 'Ticket not found' }, 404);

      // A resident may close or re-open their own complaint, but nothing else.
      const ticketRequester = (ticket.requester_id as string | null) || null;
      if (
        user.role === 'resident' &&
        ticketRequester !== user.id
      ) {
        return json({ error: 'Not your ticket' }, 403);
      }
      if (user.role === 'resident' && !['Closed'].includes(status)) {
        return json({ error: 'Residents may only close their own ticket' }, 403);
      }

      // Scope check: staff/warden/manager may only act inside their org.
      if (!['admin', 'superadmin'].includes(user.role)) {
        const ticketOrg =
          (ticket.organization_id as string | null) ||
          (await ownerOrgForProperty(env, (ticket.property_id as string | null) || null));
        if (ticketOrg && user.organizationId && ticketOrg !== user.organizationId) {
          return json({ error: 'Ticket belongs to another organisation' }, 403);
        }
      }

      const now = new Date().toISOString();
      const cols = await optionalColumns(env);
      try {
        const sets: string[] = [];
        const params: unknown[] = [];
        if (cols.has('status')) { /* status always exists */ }
        sets.push('status = ?'); params.push(status);
        if (cols.has('updated_at')) { sets.push('updated_at = ?'); params.push(now); }
        if (body.assignedStaffName !== undefined && cols.has('assigned_staff_name')) {
          sets.push('assigned_staff_name = ?'); params.push(String(body.assignedStaffName || '').slice(0, 120));
        }
        if (body.resolutionNotes !== undefined && cols.has('resolution_notes')) {
          sets.push('resolution_notes = ?'); params.push(String(body.resolutionNotes || '').slice(0, 2000));
        }
        if (body.cost !== undefined && cols.has('cost')) {
          sets.push('cost = ?'); params.push(Number(body.cost) || 0);
        }
        params.push(ticketId);
        await env.DB.prepare(`UPDATE maintenance_tickets SET ${sets.join(', ')} WHERE id = ?`).bind(...params).run();
      } catch (error) {
        console.error('maintenance ticket status', error);
        return json({ error: 'Could not update ticket' }, 500);
      }

      // Notify the account that raised the complaint — the "status change
      // notification". requester_id is the auth user id; older rows may only
      // carry the resident-profile link, so resolve the account from its email.
      let residentId = (ticket.requester_id as string | null) || null;
      let residentEmail = '';
      const residentRowId = ticket.resident_id ? str(ticket.resident_id) : null;
      try {
        if (residentId) {
          const account = await env.DB.prepare(
            `SELECT id, email FROM users WHERE id = ? LIMIT 1`
          ).bind(residentId).first<{ id: string; email: string | null }>();
          residentEmail = account?.email || '';
        } else if (residentRowId) {
          const account = await env.DB.prepare(
            `SELECT u.id AS id, u.email AS email
               FROM users u
               JOIN residents r ON LOWER(r.email) = LOWER(u.email)
              WHERE r.id = ?
              LIMIT 1`
          ).bind(residentRowId).first<{ id: string; email: string | null }>();
          residentId = account?.id || null;
          residentEmail = account?.email || '';
        }
        // Phone-first residents can hold an account with no email address; fall
        // back to the address on their resident profile so the update still
        // reaches them instead of silently stopping at the in-app notice.
        if (!residentEmail.includes('@')) {
          const candidateIds = [residentRowId, residentId ? `res-${residentId}` : null]
            .filter((value): value is string => Boolean(value));
          for (const candidate of candidateIds) {
            const profile = await env.DB.prepare(
              `SELECT email FROM residents WHERE id = ? LIMIT 1`
            ).bind(candidate).first<{ email: string | null }>();
            if (profile?.email && String(profile.email).includes('@')) {
              residentEmail = String(profile.email);
              break;
            }
          }
        }
      } catch {
        residentEmail = '';
      }
      if (residentId) {
        const statusMessages: Record<string, string> = {
          'In-Progress': 'Our team has started working on your complaint.',
          'Resolved': 'Your complaint has been resolved.',
          'Closed': 'Your complaint has been closed. Raise a new one if the issue persists.',
        };
        const noticeTitle = `Complaint ${status}: ${str(ticket.title)}`;
        const noticeBody = statusMessages[status] || `Your complaint status changed to ${status}.`;
        await notifyResident(env, residentId, noticeTitle, noticeBody);

        // Email the resident too — in-app notices only reach them when they
        // open the app; email reaches them anywhere. Best-effort, never fails
        // the status change.
        if (residentEmail.includes('@')) {
          const esc = (v: string) => v.replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
          }[ch] || ch));
          const ticketRef = str(ticket.id).slice(-8).toUpperCase();
          const resolutionLine = str(ticket.resolution_notes || (body.resolutionNotes as string) || '');
          const emailed = await deliverEmail(
            env,
            residentEmail,
            `${noticeTitle} · PGWalo`,
            `<p>Hello ${esc(str(ticket.resident_name))},</p>
             <p>${esc(noticeBody)}</p>
             <ul>
               <li><strong>Complaint:</strong> ${esc(str(ticket.title))}</li>
               <li><strong>Status:</strong> ${esc(status)}</li>
               <li><strong>Reference:</strong> ${esc(ticketRef)}</li>
               ${resolutionLine ? `<li><strong>Notes from staff:</strong> ${esc(resolutionLine)}</li>` : ''}
             </ul>
             <p>Open the PGWalo app for the full history of this complaint.</p>
             <p>— PGWalo</p>`,
            `${noticeBody} Complaint: ${str(ticket.title)}. Ref ${ticketRef}.`
          ).catch(() => false);
          // Never fail the status change on email, but do make the failure
          // visible — an unbound EMAIL binding used to swallow this silently.
          if (!emailed) {
            console.warn('[maintenance] status email not delivered — check the EMAIL binding in wrangler.toml');
          }
        }
      }
      return json({ success: true, id: ticketId, status });
    }

    // ---- raise (resident) ------------------------------------------------
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const category = String(body.category || 'Other').slice(0, 40);
    const priority = String(body.priority || 'Normal').slice(0, 20);
    const photoUrl = body.photoUrl ? String(body.photoUrl).slice(0, 500) : null;
    if (!title) return json({ error: 'Title is required' }, 400);

    // Resolve the requester's resident row (match by id variants or email) so
    // the ticket is durably linked to the resident, not just a display name.
    let residentId: string | null = null;
    let roomNumber = String(body.roomNumber || '').slice(0, 40);
    let propertyName = String(body.propertyName || '').slice(0, 160);
    let propertyId: string | null = body.propertyId ? String(body.propertyId).slice(0, 80) : null;
    try {
      const resident = await env.DB.prepare(
        `SELECT id, property_id, property_name, room_number, organization_id
           FROM residents
          WHERE id = ? OR id = ? OR LOWER(email) = ?
          ORDER BY rowid DESC LIMIT 1`
      ).bind(user.id, `res-${user.id}`, (user.email || '').toLowerCase()).first<Record<string, unknown>>();
      if (resident) {
        residentId = String(resident.id);
        if (!roomNumber) roomNumber = String(resident.room_number || '');
        if (!propertyName) propertyName = String(resident.property_name || '');
        if (!propertyId) propertyId = resident.property_id ? String(resident.property_id) : null;
      }
    } catch {
      // No resident profile — still allow a generic complaint.
    }

    // Attach the property's organisation so warden/owner inboxes can find it.
    let organizationId = user.organizationId || null;
    if (propertyId) {
      const ownerOrg = await ownerOrgForProperty(env, propertyId);
      if (ownerOrg) organizationId = ownerOrg;
    }

    const id = `tkt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    // SLA: each priority carries a fix-by deadline. Emergency same-day;
    // Urgent 8 h; High 24 h; Normal 3 days; Low 7 days. The deadline is
    // stamped at raise time so every client can render a countdown without
    // re-deriving policy.
    const SLA_HOURS: Record<string, number> = {
      Emergency: 8,
      Urgent: 8,
      High: 24,
      Normal: 72,
      Low: 168,
    };
    const slaHours = SLA_HOURS[priority] ?? 72;
    const slaDeadline = new Date(Date.now() + slaHours * 3_600_000).toISOString();

    const cols = await optionalColumns(env);
    try {
      const colsList = ['id', 'title', 'category', 'room_number', 'resident_name', 'description', 'priority', 'status', 'created_at'];
      const values: unknown[] = [id, title.slice(0, 200), category, roomNumber || '—', user.name || 'Resident', description.slice(0, 4000), priority, 'Reported', now];
      if (cols.has('updated_at')) { colsList.push('updated_at'); values.push(now); }
      if (cols.has('sla_deadline')) { colsList.push('sla_deadline'); values.push(slaDeadline); }
      if (cols.has('organization_id')) { colsList.push('organization_id'); values.push(organizationId); }
      if (cols.has('resident_id')) { colsList.push('resident_id'); values.push(residentId); }
      if (cols.has('requester_id')) { colsList.push('requester_id'); values.push(user.id); }
      if (cols.has('property_id')) { colsList.push('property_id'); values.push(propertyId); }
      if (cols.has('property_name')) { colsList.push('property_name'); values.push(propertyName); }
      if (cols.has('photo_url')) { colsList.push('photo_url'); values.push(photoUrl); }
      const placeholders = colsList.map(() => '?').join(', ');
      await env.DB.prepare(
        `INSERT INTO maintenance_tickets (${colsList.join(', ')}) VALUES (${placeholders})`
      ).bind(...values).run();
    } catch (error) {
      console.error('maintenance tickets post', error);
      return json({ error: 'Could not save ticket' }, 500);
    }

    // Notify everyone on the property's staff/warden side that a complaint was
    // raised. Notifications are personal (recipient_id) so only the right
    // people see them.
    if (propertyId && organizationId) {
      try {
        const staffRows = await env.DB.prepare(
          `SELECT DISTINCT u.id
             FROM users u
            WHERE u.role IN ('staff', 'warden', 'manager', 'owner')
              AND u.organization_id = ?
              AND (u.property_id = ? OR u.role IN ('warden', 'owner', 'manager'))`
        ).bind(organizationId, propertyId).all<{ id: string }>();
        const nowIso = new Date().toISOString();
        const stmts = (staffRows.results || [])
          .filter((row) => row.id && row.id !== user.id)
          .map((row) => env.DB.prepare(`
            INSERT INTO broadcast_notifications
              (id, title, message, category, target, timestamp, sender, read, created_at, recipient_id)
            VALUES (?, ?, ?, 'Maintenance', 'All Residents', ?, 'PGWalo Maintenance', 0, ?, ?)
          `).bind(
            `bc-maint-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${row.id}`,
            `New complaint: ${title.slice(0, 120)}`,
            `${user.name || 'A resident'} (${roomNumber || '—'}, ${propertyName || '—'}) reported a ${priority.toLowerCase()} ${category.toLowerCase()} issue.`,
            nowIso,
            nowIso,
            row.id
          ));
        if (stmts.length) await env.DB.batch(stmts);
      } catch (error) {
        console.error('maintenance staff notification', error);
      }
    }

    return json({ success: true, id, residentId, organizationId, slaDeadline }, 201);
  }

  return json({ error: 'Method not allowed' }, 405);
}

/**
 * Escalation sweep — runs from the cron trigger (every 15 min) and on demand
 * via POST /api/maintenance-tickets { action: 'escalation-sweep' } (admin/owner
 * only) so it can be tested and monitored.
 *
 * Finds open complaints whose sla_deadline has passed, notifies the owner and
 * managers of the owning organisation once per breach (escalated_at guards
 * re-notifying), and stamps the breach time on the ticket.
 */
export async function escalationSweep(env: Env): Promise<{ escalated: number; tickets: string[] }> {
  const nowIso = new Date().toISOString();
  const escalated: string[] = [];

  // Open tickets past their deadline that have not been escalated yet.
  // Tickets without a deadline predate the SLA feature — skip them.
  let breached: Record<string, unknown>[] = [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, title, priority, resident_name, room_number, property_id, property_name, organization_id
         FROM maintenance_tickets
        WHERE status IN ('Reported', 'In-Progress')
          AND sla_deadline IS NOT NULL
          AND sla_deadline <= ?
          AND escalated_at IS NULL
        LIMIT 50`
    ).bind(nowIso).all();
    breached = results || [];
  } catch (error) {
    console.error('escalation sweep query', error);
    return { escalated: 0, tickets: [] };
  }

  for (const ticket of breached) {
    const ticketId = String(ticket.id);
    const orgId = ticket.organization_id ? String(ticket.organization_id) : null;
    if (!orgId) continue;

    const summary = `${ticket.resident_name || 'A resident'} (Room ${ticket.room_number || '—'}, ${ticket.property_name || '—'}) reported a ${String(ticket.priority).toLowerCase()} ${String(ticket.category || '').toLowerCase()} issue that is past its fix-by deadline.`;

    try {
      // Notify the owner + managers of the owning organisation.
      const recipients = await env.DB.prepare(
        `SELECT DISTINCT u.id
           FROM users u
          WHERE u.organization_id = ?
            AND u.role IN ('owner', 'manager')
            AND u.id NOT IN (SELECT owner_user_id FROM organizations WHERE id = ? OR owner_user_id IS NULL)`
      ).bind(orgId, orgId).all<{ id: string }>();

      // Also always notify the organisation's owner account (owner_user_id).
      const orgOwner = await env.DB.prepare(
        `SELECT owner_user_id AS id FROM organizations WHERE id = ? AND owner_user_id IS NOT NULL`
      ).bind(orgId).first<{ id: string }>();

      const recipientIds = Array.from(
        new Set([...(recipients.results || []).map((r) => r.id), orgOwner?.id].filter(Boolean) as string[])
      );

      if (recipientIds.length) {
        const stmts = recipientIds.map((rid) =>
          env.DB.prepare(`
            INSERT INTO broadcast_notifications
              (id, title, message, category, target, timestamp, sender, read, created_at, recipient_id)
            VALUES (?, ?, ?, 'Urgent', 'All Residents', ?, 'PGWalo Escalations', 0, ?, ?)
          `).bind(
            `bc-esc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${rid}`,
            `SLA breached: ${String(ticket.title).slice(0, 120)}`,
            summary,
            nowIso,
            nowIso,
            rid
          )
        );
        await env.DB.batch(stmts);
      }

      await env.DB.prepare(
        `UPDATE maintenance_tickets SET escalated_at = ? WHERE id = ?`
      ).bind(nowIso, ticketId).run();

      escalated.push(ticketId);
    } catch (error) {
      console.error(`escalation for ${ticketId}`, error);
    }
  }

  return { escalated: escalated.length, tickets: escalated };
}

/** Cron entry point. */
export async function runEscalationSweep(env: Env): Promise<void> {
  const result = await escalationSweep(env);
  if (result.escalated > 0) {
    console.log(`[sla] escalated ${result.escalated} breached complaint(s): ${result.tickets.join(', ')}`);
  }
}

function str(value: unknown, fallback = ''): string {
  return value === null || value === undefined ? fallback : String(value);
}
