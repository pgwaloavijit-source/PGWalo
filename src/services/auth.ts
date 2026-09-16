import { setAuthToken, clearAuthToken, getAuthToken, isProductionApiEnabled } from './productionApi';
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

export async function loginWithWorkers(
  email: string,
  password: string,
  role: UserRole = 'public'
): Promise<AuthResponse> {
  if (!isProductionApiEnabled()) {
    return { success: false, error: 'API not available in demo mode' };
  }

  try {
    const response = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || 'Login failed' };
    }

    if (data.token) setAuthToken(data.token);
    return { success: true, token: data.token, user: data.user };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Network error during login' };
  }
}

export async function registerWithWorkers(userData: {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  password?: string;
}): Promise<AuthResponse> {
  if (!isProductionApiEnabled()) {
    return { success: false, error: 'API not available in demo mode' };
  }

  try {
    const response = await fetch(apiUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || 'Registration failed' };
    }

    if (data.token) setAuthToken(data.token);
    return { success: true, token: data.token, user: data.user };
  } catch (error) {
    console.error('Registration error:', error);
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
