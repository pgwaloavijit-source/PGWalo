import { UserRole } from '../types';

/**
 * Where an account belongs in the shell.
 *
 * Used when a session is restored on boot and right after sign-in, so an owner
 * or tenant never lands on the public marketing page wondering whether the
 * login worked. `landing` is only for accounts with no dashboard (anonymous).
 */
export function dashboardTabForRole(role?: UserRole): string {
  switch (role) {
    case 'owner':
      return 'owner';
    case 'resident':
      return 'resident';
    case 'staff':
      return 'staff';
    case 'warden':
      return 'warden';
    case 'accountant':
      return 'accountant';
    case 'admin':
    case 'superadmin':
      return 'admin';
    default:
      return 'landing';
  }
}

/** The role stored on this device, if a session was restored from localStorage. */
export function restoredSessionRole(): UserRole | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem('pgwalo_current_user');
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { role?: UserRole };
    return parsed?.role;
  } catch {
    return undefined;
  }
}
