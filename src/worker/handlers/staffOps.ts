import { Env } from '../types';
import { addCorsHeaders } from '../utils/cors';
import { authMiddleware } from '../middleware/auth';
import { itemsForRole, titleForRole, OpsFrequency } from '../../domain/staffOps';

function json(data: unknown, status = 200) {
  return addCorsHeaders(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  }));
}

/**
 * Staff operations: role-based checklists and task execution, persisted in D1.
 * One run row per staff member per role per day; items live as JSON on the
 * run row. Staff may only ever read/write their own runs; owners/admins read
 * everything in their organisation and edit the template overrides.
 */
function ensureTable(env: Env) {
  return env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS staff_checklist_runs (
        id TEXT PRIMARY KEY,
        staff_user_id TEXT NOT NULL,
        staff_name TEXT NOT NULL,
        staff_roles TEXT NOT NULL,
        role TEXT NOT NULL,
        property_id TEXT,
        organization_id TEXT,
        run_date TEXT NOT NULL,
        template_title TEXT NOT NULL,
        frequency TEXT NOT NULL DEFAULT 'Daily',
        items TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Not Started',
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS staff_checklist_templates (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        role TEXT NOT NULL,
        title TEXT NOT NULL,
        frequency TEXT NOT NULL DEFAULT 'Daily',
        items TEXT NOT NULL,
        updated_at TEXT,
        UNIQUE(organization_id, role)
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS staff_issue_reports (
        id TEXT PRIMARY KEY,
        run_id TEXT,
        staff_user_id TEXT NOT NULL,
        staff_name TEXT NOT NULL,
        role TEXT,
        property_id TEXT,
        organization_id TEXT,
        item_label TEXT,
        note TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Open',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `),
  ]);
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Per-isolate guard: DDL runs at most once per worker instance, and never
 *  burns D1 write quota on every request (the free tier counts each one). */
let tablesReady = false;
async function ensureTablesOnce(env: Env) {
  if (tablesReady) return;
  try {
    await ensureTable(env);
    tablesReady = true;
  } catch (error) {
    console.error('staff-ops schema init failed (will retry next request):', error);
  }
}

interface RunItem {
  id: string;
  label: string;
  section: string;
  mandatory: boolean;
  state: 'Done' | 'Not Done' | 'Not Applicable' | '';
  comment?: string;
  photoUrl?: string;
  updatedAt?: string;
}

/** Organisation-specific template override, or null to use the built-in. */
async function templateForOrg(env: Env, organizationId: string, role: string): Promise<{ title: string; frequency: OpsFrequency; items: RunItem[] } | null> {
  const row = await env.DB.prepare(
    `SELECT title, frequency, items FROM staff_checklist_templates WHERE organization_id = ? AND role = ?`
  ).bind(organizationId, role).first<{ title: string; frequency: string; items: string }>();
  if (!row) return null;
  try {
    const items = JSON.parse(row.items) as RunItem[];
    return {
      title: row.title,
      frequency: (row.frequency as OpsFrequency) || 'Daily',
      items: items.map((i) => ({ ...i, state: '' })),
    };
  } catch {
    return null;
  }
}

function buildItems(role: string): RunItem[] {
  return itemsForRole(role).map((i) => ({ ...i, state: '' as const }));
}

function computeStatus(items: RunItem[]): { status: string; completed: number; mandatoryPending: number } {
  const mandatory = items.filter((i) => i.mandatory);
  const completed = items.filter((i) => i.state === 'Done' || i.state === 'Not Applicable').length;
  const mandatoryPending = mandatory.filter((i) => i.state !== 'Done' && i.state !== 'Not Applicable').length;
  let status = 'Not Started';
  if (items.length > 0 && completed === items.length) status = 'Completed';
  else if (completed > 0) status = mandatoryPending === 0 ? 'Partially Completed' : 'Requires Attention';
  if (mandatoryPending > 0 && completed > 0) status = 'Requires Attention';
  return { status, completed, mandatoryPending };
}

function parseRun(row: Record<string, unknown>) {
  let items: RunItem[] = [];
  try { items = JSON.parse(String(row.items || '[]')); } catch { items = []; }
  return {
    id: String(row.id),
    staffUserId: String(row.staff_user_id),
    staffName: String(row.staff_name),
    staffRoles: (() => { try { return JSON.parse(String(row.staff_roles || '[]')); } catch { return []; } })(),
    role: String(row.role),
    propertyId: (row.property_id as string) || undefined,
    organizationId: (row.organization_id as string) || undefined,
    runDate: String(row.run_date),
    templateTitle: String(row.template_title),
    frequency: String(row.frequency || 'Daily'),
    items,
    status: String(row.status),
    note: (row.note as string) || undefined,
    createdAt: String(row.created_at),
    updatedAt: (row.updated_at as string) || undefined,
  };
}

export async function staffOpsHandler(request: Request, env: Env): Promise<Response> {
  // Authenticate FIRST — unauthenticated calls must never touch the database.
  const auth = await authMiddleware(request, env);
  if (!auth.success) return json({ error: auth.error }, 401);
  const user = auth.user!;
  const isOwnerSide = ['owner', 'admin', 'superadmin', 'manager'].includes(user.role);
  await ensureTablesOnce(env);
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method;

  // ---------------------------------------------------------------- owner --
  // GET /api/staff-ops/overview?date=YYYY-MM-DD — org-wide monitoring.
  if (method === 'GET' && path === '/api/staff-ops/overview') {
    if (!isOwnerSide) return json({ error: 'Forbidden' }, 403);
    const date = url.searchParams.get('date') || todayIso();
    const organizationId = user.organizationId || env.DEFAULT_ORGANIZATION_ID;
    try {
      const { results } = await env.DB.prepare(
        `SELECT * FROM staff_checklist_runs WHERE organization_id = ? AND run_date = ? ORDER BY updated_at DESC LIMIT 200`
      ).bind(organizationId, date).all();
      const runs = (results || []).map((r) => parseRun(r as Record<string, unknown>));
      const { results: issues } = await env.DB.prepare(
        `SELECT * FROM staff_issue_reports WHERE organization_id = ? ORDER BY created_at DESC LIMIT 50`
      ).bind(organizationId).all();
      return json({
        date,
        runs,
        issues: (issues || []).map((r) => ({
          id: String((r as Record<string, unknown>).id),
          staffName: (r as Record<string, unknown>).staff_name,
          role: (r as Record<string, unknown>).role,
          itemLabel: (r as Record<string, unknown>).item_label,
          note: (r as Record<string, unknown>).note,
          status: (r as Record<string, unknown>).status,
          createdAt: (r as Record<string, unknown>).created_at,
        })),
      });
    } catch (error) {
      console.error('staff-ops overview', error);
      return json({ error: 'Could not load operations overview' }, 500);
    }
  }

  // GET /api/staff-ops/templates — org overrides (owner only).
  if (method === 'GET' && path === '/api/staff-ops/templates') {
    if (!isOwnerSide) return json({ error: 'Forbidden' }, 403);
    const organizationId = user.organizationId || env.DEFAULT_ORGANIZATION_ID;
    const { results } = await env.DB.prepare(
      `SELECT * FROM staff_checklist_templates WHERE organization_id = ?`
    ).bind(organizationId).all();
    return json({
      templates: (results || []).map((r) => {
        const row = r as Record<string, unknown>;
        let items: unknown = [];
        try { items = JSON.parse(String(row.items || '[]')); } catch { /* empty */ }
        return { ...row, items };
      }),
    });
  }

  // PUT /api/staff-ops/templates — save an org override (owner only).
  if (method === 'PUT' && path === '/api/staff-ops/templates') {
    if (!['owner', 'admin', 'superadmin'].includes(user.role)) return json({ error: 'Forbidden' }, 403);
    const body = await request.json().catch(() => ({})) as { role?: string; title?: string; frequency?: string; items?: { label: string; mandatory: boolean; section?: string }[] };
    if (!body.role || !Array.isArray(body.items)) return json({ error: 'role and items required' }, 400);
    const organizationId = user.organizationId || env.DEFAULT_ORGANIZATION_ID;
    const title = body.title?.trim() || titleForRole(body.role);
    const items = body.items.map((i, idx) => ({
      id: `c-${idx}-${String(i.label).slice(0, 12).replace(/\W+/g, '-')}`,
      label: String(i.label),
      section: i.section || 'Checklist',
      mandatory: Boolean(i.mandatory),
      state: '' as const,
    }));
    try {
      await env.DB.prepare(
        `INSERT INTO staff_checklist_templates (id, organization_id, role, title, frequency, items, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(organization_id, role) DO UPDATE SET title = excluded.title, frequency = excluded.frequency, items = excluded.items, updated_at = datetime('now')`
      ).bind(`tpl-${organizationId}-${body.role}`, organizationId, body.role, title, body.frequency || 'Daily', JSON.stringify(items)).run();
      return json({ success: true });
    } catch (error) {
      console.error('staff-ops template save', error);
      return json({ error: 'Could not save checklist template' }, 500);
    }
  }

  // DELETE /api/staff-ops/templates?role=... — revert to the built-in template.
  if (method === 'DELETE' && path === '/api/staff-ops/templates') {
    if (!['owner', 'admin', 'superadmin'].includes(user.role)) return json({ error: 'Forbidden' }, 403);
    const role = url.searchParams.get('role') || '';
    const organizationId = user.organizationId || env.DEFAULT_ORGANIZATION_ID;
    await env.DB.prepare(`DELETE FROM staff_checklist_templates WHERE organization_id = ? AND role = ?`)
      .bind(organizationId, role).run();
    return json({ success: true });
  }

  // ---------------------------------------------------------------- staff --
  // GET /api/staff-ops/my?date=... — the caller's runs for the day, one per
  // role; auto-seeded from the org template (or built-in template) on first
  // touch so the checklist always exists when the dashboard loads.
  if (method === 'GET' && path === '/api/staff-ops/my') {
    const date = url.searchParams.get('date') || todayIso();
    const organizationId = user.organizationId || env.DEFAULT_ORGANIZATION_ID;
    // The JWT does not carry the duty roles — resolve them from the users row
    // (staff_role + the comma-stored multi-role list in profile_extras).
    let roles: string[] = [];
    try {
      const row = await env.DB.prepare(`SELECT staff_role, profile_extras FROM users WHERE id = ?`)
        .bind(user.id).first<{ staff_role: string | null; profile_extras: string | null }>();
      if (row?.profile_extras) {
        try {
          const extras = JSON.parse(row.profile_extras) as { roles?: string[] };
          if (Array.isArray(extras.roles)) roles.push(...extras.roles);
        } catch { /* extras optional */ }
      }
      if (row?.staff_role) roles.push(row.staff_role);
    } catch (error) {
      console.error('staff-ops roles lookup', error);
    }
    roles = Array.from(new Set(roles.filter(Boolean)));
    if (roles.length === 0) return json({ runs: [], issues: [] });

    try {
      const { results } = await env.DB.prepare(
        `SELECT * FROM staff_checklist_runs WHERE staff_user_id = ? AND run_date = ?`
      ).bind(user.id, date).all();
      const existing = (results || []).map((r) => parseRun(r as Record<string, unknown>));
      const byRole = new Map<string, ReturnType<typeof parseRun>>(existing.map((r) => [r.role, r]));

      // Seed a run per role the staff member holds.
      for (const role of roles) {
        if (byRole.has(role)) continue;
        const template = (await templateForOrg(env, organizationId, role)) || { title: titleForRole(role), frequency: 'Daily' as OpsFrequency, items: buildItems(role) };
        if (template.items.length === 0) continue;
        const id = `run-${user.id}-${role.replace(/\W+/g, '')}-${date}`;
        await env.DB.prepare(
          `INSERT OR IGNORE INTO staff_checklist_runs (id, staff_user_id, staff_name, staff_roles, role, property_id, organization_id, run_date, template_title, frequency, items, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Not Started')`
        ).bind(
          id, user.id, user.name, JSON.stringify(roles), role,
          (user as unknown as { propertyId?: string }).propertyId || null,
          organizationId, date, template.title || titleForRole(role), template.frequency,
          JSON.stringify(template.items)
        ).run();
        byRole.set(role, {
          id, staffUserId: user.id, staffName: user.name || 'Staff', staffRoles: roles, role,
          propertyId: (user as unknown as { propertyId?: string }).propertyId,
          organizationId: organizationId, runDate: date, templateTitle: template.title || titleForRole(role),
          frequency: template.frequency, items: template.items, status: 'Not Started',
          note: undefined, createdAt: new Date().toISOString(), updatedAt: undefined,
        });
      }

      // Drop runs for roles the member no longer holds (same day only).
      const { results: issues } = await env.DB.prepare(
        `SELECT * FROM staff_issue_reports WHERE staff_user_id = ? ORDER BY created_at DESC LIMIT 20`
      ).bind(user.id).all<Record<string, unknown>>();

      return json({
        runs: Array.from(byRole.values()).filter((r) => roles.includes(r.role)),
        issues: (issues || []).map((r) => ({
          id: String((r as Record<string, unknown>).id),
          itemLabel: (r as Record<string, unknown>).item_label,
          note: (r as Record<string, unknown>).note,
          status: (r as Record<string, unknown>).status,
          createdAt: (r as Record<string, unknown>).created_at,
        })),
        roles,
      });
    } catch (error) {
      console.error('staff-ops my', error);
      return json({ error: 'Could not load your checklists' }, 500);
    }
  }

  // PUT /api/staff-ops/my — update one item (state/comment) or the run note.
  if (method === 'PUT' && path === '/api/staff-ops/my') {
    const body = await request.json().catch(() => ({})) as {
      runId?: string;
      itemId?: string;
      state?: 'Done' | 'Not Done' | 'Not Applicable';
      comment?: string;
      note?: string;
      status?: string;
    };
    if (!body.runId) return json({ error: 'runId required' }, 400);
    try {
      const row = await env.DB.prepare(`SELECT * FROM staff_checklist_runs WHERE id = ?`).bind(body.runId).first<Record<string, unknown>>();
      if (!row) return json({ error: 'Checklist not found' }, 404);
      // Ownership from the JWT — a staff member can only ever touch their own run.
      if (String(row.staff_user_id) !== user.id && !isOwnerSide) return json({ error: 'Forbidden' }, 403);

      const run = parseRun(row);
      if (body.itemId) {
        const item = run.items.find((i) => i.id === body.itemId);
        if (!item) return json({ error: 'Checklist item not found' }, 404);
        if (body.state !== undefined) item.state = body.state;
        if (body.comment !== undefined) item.comment = body.comment || undefined;
        item.updatedAt = new Date().toISOString();
      }

      const { status } = computeStatus(run.items);
      const finalStatus = body.status || status;
      await env.DB.prepare(
        `UPDATE staff_checklist_runs SET items = ?, status = ?, note = COALESCE(?, note), updated_at = datetime('now') WHERE id = ?`
      ).bind(JSON.stringify(run.items), finalStatus, body.note ?? null, body.runId).run();

      // An explicit "Not Done" on a mandatory item is an operational issue.
      if (body.itemId && body.state === 'Not Done') {
        const item = run.items.find((i) => i.id === body.itemId);
        if (item?.mandatory) {
          await env.DB.prepare(
            `INSERT INTO staff_issue_reports (id, run_id, staff_user_id, staff_name, role, property_id, organization_id, item_label, note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            `iss-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            body.runId, user.id, user.name || 'Staff', run.role, run.propertyId || null, run.organizationId || null,
            item.label, body.comment || 'Marked Not Done'
          ).run();
        }
      }

      return json({ success: true, status: finalStatus, items: run.items });
    } catch (error) {
      const message = String(error);
      console.error('staff-ops update', error);
      if (message.includes('write limit')) {
        return json({ error: 'Database daily write limit reached — try again after midnight UTC.' }, 503);
      }
      return json({ error: 'Could not update checklist' }, 500);
    }
  }

  // POST /api/staff-ops/my/issue — report an issue from a checklist item.
  if (method === 'POST' && path === '/api/staff-ops/my/issue') {
    const body = await request.json().catch(() => ({})) as { runId?: string; itemId?: string; note?: string };
    if (!body.note?.trim()) return json({ error: 'Describe the issue' }, 400);
    try {
      let itemLabel: string | null = null;
      let role: string | null = null;
      if (body.runId) {
        const row = await env.DB.prepare(`SELECT role, items, staff_user_id FROM staff_checklist_runs WHERE id = ?`).bind(body.runId).first<Record<string, unknown>>();
        if (row && String(row.staff_user_id) !== user.id && !isOwnerSide) return json({ error: 'Forbidden' }, 403);
        if (row) {
          role = String(row.role);
          try {
            const items = JSON.parse(String(row.items || '[]')) as RunItem[];
            itemLabel = items.find((i) => i.id === body.itemId)?.label || null;
          } catch { /* label optional */ }
        }
      }
      const id = `iss-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await env.DB.prepare(
        `INSERT INTO staff_issue_reports (id, run_id, staff_user_id, staff_name, role, property_id, organization_id, item_label, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, body.runId || null, user.id, user.name || 'Staff', role,
        (user as unknown as { propertyId?: string }).propertyId || null,
        user.organizationId || env.DEFAULT_ORGANIZATION_ID,
        itemLabel, body.note.trim()
      ).run();
      return json({ success: true, id });
    } catch (error) {
      console.error('staff-ops issue', error);
      return json({ error: 'Could not report issue' }, 500);
    }
  }

  // PATCH /api/staff-ops/issues — owner resolves an issue.
  if (method === 'PATCH' && path === '/api/staff-ops/issues') {
    if (!isOwnerSide) return json({ error: 'Forbidden' }, 403);
    const body = await request.json().catch(() => ({})) as { id?: string; status?: string };
    if (!body.id || !body.status) return json({ error: 'id and status required' }, 400);
    await env.DB.prepare(`UPDATE staff_issue_reports SET status = ? WHERE id = ?`).bind(body.status, body.id).run();
    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
