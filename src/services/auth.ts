import { setAuthToken, clearAuthToken, getAuthToken, isProductionApiEnabled } from './productionApi';
import { getAuthSessionId, AuthOpenMeta } from './authAnalytics';
import { UserRole } from '../types';

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    role: UserRole;
    name?: string;
    email?: string;
    phone?: string;
    organizationId?: string;
  };
  error?: string;
}

const apiUrl = (path: string) => {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  return `${base}${path}`;
};

const trackingPayload = (meta?: AuthOpenMeta) => ({
  sessionId: getAuthSessionId(),
  authPath: meta?.path,
  intent: meta?.intent,
  sourcePage: meta?.source,
  propertyId: meta?.propertyId,
  deviceType: window.innerWidth < 768 ? 'mobile' : 'desktop',
});

export async function loginWithWorkers(
  identifier: { email?: string; phone?: string },
  password: string,
  meta?: AuthOpenMeta
): Promise<AuthResponse> {
  if (!isProductionApiEnabled()) {
    return { success: false, error: 'API not available in demo mode' };
  }

  try {
    const response = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...identifier, password, role: meta?.role, ...trackingPayload(meta) }),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, error: data.error || 'Login failed' };
    if (data.token) setAuthToken(data.token);
    return { success: true, token: data.token, user: data.user };
  } catch {
    return { success: false, error: 'Network error during login' };
  }
}

export async function registerWithWorkers(
  userData: {
    name: string;
    email?: string;
    phone: string;
    role: UserRole;
    password?: string;
    inviteCode?: string;
  },
  meta?: AuthOpenMeta
): Promise<AuthResponse> {
  if (!isProductionApiEnabled()) {
    return { success: false, error: 'API not available in demo mode' };
  }

  try {
    const response = await fetch(apiUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...userData, ...trackingPayload(meta) }),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, error: data.error || 'Registration failed' };
    if (data.token) setAuthToken(data.token);
    return { success: true, token: data.token, user: data.user };
  } catch {
    return { success: false, error: 'Network error during registration' };
  }
}

export function logoutWorkers(): void {
  clearAuthToken();
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

export function getCurrentToken(): string | null {
  return getAuthToken();
}
