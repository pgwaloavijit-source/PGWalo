import { Env, User, AuthResult } from '../types';
import { verifyJWT } from '../utils/jwt';
import { isPlatformAdmin } from '../utils/platformAdmin';

/**
 * Live account state, checked on every authenticated request.
 *
 * A JWT used to be trusted until expiry, so a user the Super Admin disabled
 * kept full access for the rest of the token lifetime. Every authenticated
 * call now re-reads the account status from D1 (through a short per-isolate
 * cache so hot SSE polling does not hammer the database). Disabled or
 * suspended accounts are rejected immediately — logging out, re-signing in,
 * or crafting requests changes nothing.
 */
interface StatusRow { status: string | null; role: string }

const statusCache = new Map<string, { value: string | null; role: string; at: number }>();
const STATUS_TTL_MS = 30_000;

async function liveAccountStatus(env: Env, userId: string): Promise<{ status: string | null; role: string } | null> {
  const cached = statusCache.get(userId);
  if (cached && Date.now() - cached.at < STATUS_TTL_MS) {
    return { status: cached.value, role: cached.role };
  }
  try {
    const row = await env.DB.prepare('SELECT status, role FROM users WHERE id = ? LIMIT 1')
      .bind(userId).first<StatusRow>();
    if (!row) return null;
    statusCache.set(userId, { value: row.status || null, role: row.role, at: Date.now() });
    return { status: row.status || null, role: row.role };
  } catch {
    return cached ? { status: cached.value, role: cached.role } : null;
  }
}

const BLOCKED_STATUSES = new Set(['Disabled', 'Suspended']);

function blockedResult(status: string | null): AuthResult {
  return {
    success: false,
    error: status === 'Suspended'
      ? 'Account suspended'
      : 'Account disabled',
    user: undefined,
  };
}

async function finalizeAuth(env: Env, user: User): Promise<AuthResult> {
  // The platform Super Admin is a config-defined operator, not a users row —
  // there is nothing to disable.
  if (isPlatformAdmin(user.role)) return { success: true, user };
  const live = await liveAccountStatus(env, user.id);
  if (live && BLOCKED_STATUSES.has(live.status || 'Active')) return blockedResult(live.status);
  return { success: true, user };
}

export async function authMiddleware(request: Request, env: Env, tokenOverride?: string): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization');

  // SSE readers (EventSource) cannot set an Authorization header, so callers
  // may pass the same JWT explicitly — validated through the identical path.
  if (!authHeader && tokenOverride) {
    const secret = env.JWT_SECRET;
    if (!secret) {
      return { success: false, error: 'JWT not configured' };
    }
    const payload = await verifyJWT(tokenOverride, secret);
    if (payload) {
      return finalizeAuth(env, {
        id: payload.userId,
        role: payload.role,
        organizationId: payload.organizationId,
        name: payload.name,
        email: payload.email,
      });
    }
    return { success: false, error: 'Invalid or expired token' };
  }

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const secret = env.JWT_SECRET;
    if (!secret) {
      return { success: false, error: 'JWT not configured' };
    }
    const payload = await verifyJWT(token, secret);
    if (payload) {
      return finalizeAuth(env, {
        id: payload.userId,
        role: payload.role,
        organizationId: payload.organizationId,
        name: payload.name,
        email: payload.email,
      });
    }
    return { success: false, error: 'Invalid or expired token' };
  }

  if (env.ENVIRONMENT !== 'production') {
    const role = request.headers.get('x-user-role') || 'public';
    const organizationId = request.headers.get('x-organization-id') || env.DEFAULT_ORGANIZATION_ID;
    const userId = request.headers.get('x-user-id');
    const validRoles = ['public', 'owner', 'resident', 'staff', 'admin', 'superadmin', 'manager', 'warden', 'accountant'];
    if (!validRoles.includes(role)) {
      return { success: false, error: 'Invalid role' };
    }
    const devUser: User = { id: userId || 'user-demo', role, organizationId };
    return await finalizeAuth(env, devUser);
  }

  return { success: false, error: 'Authentication required' };
}

/**
 * Role -> read/write capability matrix.
 *
 * `staff.view` and `shared.view` are read scopes used by the collection and
 * bootstrap handlers. They previously belonged to no role at all, so every
 * table mapped to them (staff, tasks, broadcasts, meal plans, leads, settings)
 * came back empty for staff/warden/manager/accountant — and `room.view` /
 * `resident.view` were missing for residents, which emptied the whole resident
 * snapshot. The tables a role may *reach* are still gated by
 * `tablesForRole`, and resident rows are additionally requester-scoped in
 * `handlers/bootstrap.ts`, so widening the read scopes does not widen access.
 */
export function hasPermission(role: string, permission: string): boolean {
  const rolePermissions: Record<string, string[]> = {
    admin: ['*'],
    superadmin: ['*'],
    owner: ['*'],
    manager: [
      'resident.view', 'resident.create', 'resident.edit', 'resident.move', 'resident.checkout',
      'room.view', 'room.assign', 'room.transfer',
      'invoice.view', 'payment.view', 'payment.record',
      'complaint.view', 'complaint.assign', 'complaint.resolve',
      'report.view', 'staff.view', 'shared.view',
    ],
    warden: [
      'resident.view', 'room.view', 'room.assign',
      'complaint.view', 'complaint.assign', 'complaint.resolve',
      'staff.view', 'shared.view',
    ],
    accountant: [
      'resident.view', 'invoice.view', 'invoice.create', 'invoice.adjust',
      'payment.view', 'payment.record', 'payment.verify', 'payment.refund',
      'deposit.view', 'deposit.deduct', 'deposit.refund',
      'report.view', 'report.export', 'audit.view', 'staff.view', 'shared.view',
    ],
    staff: [
      'room.view', 'resident.view', 'complaint.view', 'complaint.resolve',
      'staff.view', 'shared.view',
    ],
    resident: [
      // Deliberately no 'resident.view': the resident snapshot is served by
      // `handlers/bootstrap.ts`, which requester-scopes each row. Granting the
      // permission here would also open the org-wide collection routes.
      'room.view', 'invoice.view', 'payment.view', 'payment.record',
      'deposit.view', 'complaint.view', 'shared.view',
    ],
    public: ['room.view'],
  };

  const permissions = rolePermissions[role] || [];
  return permissions.includes('*') || permissions.includes(permission);
}
