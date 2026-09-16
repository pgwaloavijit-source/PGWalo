/**
 * Authentication service for Cloudflare Workers
 * Handles JWT token generation and validation
 */

import { setAuthToken, clearAuthToken, getAuthToken } from './productionApi';
import { UserRole } from '../types';

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    role: UserRole;
    name?: string;
    organizationId?: string;
  };
  error?: string;
}

/**
 * Login with Cloudflare Workers and get JWT token
 */
export async function loginWithWorkers(
  email: string,
  password: string,
  role: UserRole = 'public'
): Promise<AuthResponse> {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  
  if (!apiBaseUrl) {
    // Fallback to local auth if no Workers URL configured
    return {
      success: false,
      error: 'Workers API not configured'
    };
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, role }),
    });

    if (response.ok) {
      const data = await response.json();
      
      if (data.token) {
        setAuthToken(data.token);
      }

      return {
        success: true,
        token: data.token,
        user: data.user,
      };
    } else {
      const error = await response.json();
      return {
        success: false,
        error: error.error || 'Login failed',
      };
    }
  } catch (error) {
    console.error('Workers login error:', error);
    return {
      success: false,
      error: 'Network error during login',
    };
  }
}

/**
 * Register with Cloudflare Workers
 */
export async function registerWithWorkers(
  userData: {
    name: string;
    email: string;
    phone: string;
    role: UserRole;
    password?: string;
  }
): Promise<AuthResponse> {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  
  if (!apiBaseUrl) {
    return {
      success: false,
      error: 'Workers API not configured'
    };
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (response.ok) {
      const data = await response.json();
      
      if (data.token) {
        setAuthToken(data.token);
      }

      return {
        success: true,
        token: data.token,
        user: data.user,
      };
    } else {
      const error = await response.json();
      return {
        success: false,
        error: error.error || 'Registration failed',
      };
    }
  } catch (error) {
    console.error('Workers registration error:', error);
    return {
      success: false,
      error: 'Network error during registration',
    };
  }
}

/**
 * Logout and clear token
 */
export function logoutWorkers(): void {
  clearAuthToken();
}

/**
 * Check if user is authenticated with valid token
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

/**
 * Get current auth token
 */
export function getCurrentToken(): string | null {
  return getAuthToken();
}