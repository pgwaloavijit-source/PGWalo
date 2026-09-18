import { apiUrl as sharedApiUrl } from './apiBase';
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
    isProfileCompleted?: boolean;
    staffRole?: string;
  };
  error?: string;
  message?: string;
  otpId?: string;
  verificationId?: string;
  fallbackCode?: string;
  delivered?: boolean;
  staffId?: string;
  userId?: string;
}

const apiUrl = (path: string) => sharedApiUrl(path);

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
    verificationId?: string;
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

export async function sendAuthOtp(email: string, phone: string, purpose: 'signup' | 'login' = 'signup') {
  const response = await fetch(apiUrl('/api/auth/otp/send'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, phone, purpose }),
  });
  return response.json();
}

export async function verifyAuthOtp(otpId: string, code: string) {
  const response = await fetch(apiUrl('/api/auth/otp/verify'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otpId, code }),
  });
  return response.json();
}

export async function fetchMeWithWorkers() {
  const token = getAuthToken();
  const response = await fetch(apiUrl('/api/auth/me'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function saveProfileWithWorkers(profile: Record<string, unknown>) {
  const token = getAuthToken();
  const response = await fetch(apiUrl('/api/auth/profile'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(profile),
  });
  const data = await response.json();
  if (data.token) setAuthToken(data.token);
  return data;
}

export async function notifyVisitWithWorkers(payload: {
  propertyId?: string;
  propertyName?: string;
  ownerEmail?: string;
  ownerName?: string;
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string;
  visitorProfession?: string;
  visitDate?: string;
  visitSlot?: string;
  message?: string;
  referenceId?: string;
}) {
  const token = getAuthToken();
  const response = await fetch(apiUrl('/api/notify/visit'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function createStaffWithWorkers(payload: {
  name: string;
  phone: string;
  email?: string;
  staffRole: string;
  roles?: string[];
  pin: string;
  propertyId?: string;
  shift?: string;
}) {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: 'Sign in again as the owner to create staff logins.' };
  }
  const response = await fetch(apiUrl('/api/auth/staff'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { success: false, error: data.error || 'Could not create staff login.' };
  }
  return data;
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
