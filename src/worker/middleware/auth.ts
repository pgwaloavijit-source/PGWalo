import { Env, User, AuthResult } from '../types';
import { verifyJWT } from '../utils/jwt';
import { isPlatformAdmin } from '../utils/platformAdmin';

export async function authMiddleware(request: Request, env: Env): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const secret = env.JWT_SECRET;
    if (!secret) {
      return { success: false, error: 'JWT not configured' };
    }
    const payload = await verifyJWT(token, secret);
    if (payload) {
      return {
        success: true,
        user: {
          id: payload.userId,
          role: payload.role,
          organizationId: payload.organizationId,
          name: payload.name,
        },
      };
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
    return {
      success: true,
      user: { id: userId || 'user-demo', role, organizationId },
    };
  }

  return { success: false, error: 'Authentication required' };
}

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
      'report.view',
    ],
    warden: ['resident.view', 'room.view', 'room.assign', 'complaint.view', 'complaint.assign', 'complaint.resolve'],
    accountant: [
      'resident.view', 'invoice.view', 'invoice.create', 'invoice.adjust',
      'payment.view', 'payment.record', 'payment.verify', 'payment.refund',
      'deposit.view', 'deposit.deduct', 'deposit.refund',
      'report.view', 'report.export', 'audit.view',
    ],
    staff: ['room.view', 'complaint.view', 'complaint.resolve'],
    resident: ['invoice.view', 'payment.view', 'payment.record', 'deposit.view', 'complaint.view'],
    public: ['room.view'],
  };

  const permissions = rolePermissions[role] || [];
  return permissions.includes('*') || permissions.includes(permission);
}
