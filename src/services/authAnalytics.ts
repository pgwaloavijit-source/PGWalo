import { isProductionApiEnabled } from './productionApi';

export type AuthPath = 'explorer' | 'resident' | 'owner' | 'staff' | 'superadmin';
export type AuthIntent =
  | 'browse'
  | 'book_pg'
  | 'visit_pg'
  | 'save_pg'
  | 'owner_list'
  | 'staff_join'
  | 'dashboard'
  | 'alerts'
  | 'general';

export interface AuthOpenMeta {
  mode?: 'login' | 'register';
  role?: string;
  path?: AuthPath;
  intent?: AuthIntent;
  propertyId?: string;
  source?: string;
}

const SESSION_KEY = 'pgwalo_session_id';
const LAST_USER_KEY = 'pgwalo_last_auth';

export function getAuthSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function saveLastAuthUser(email: string, name: string, path: AuthPath) {
  localStorage.setItem(LAST_USER_KEY, JSON.stringify({ email, name, path, at: Date.now() }));
}

export function getLastAuthUser(): { email: string; name: string; path: AuthPath } | null {
  try {
    const raw = localStorage.getItem(LAST_USER_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.at > 30 * 24 * 60 * 60 * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

export async function trackAuthEvent(
  eventType: string,
  meta: Partial<AuthOpenMeta> & { userId?: string; organizationId?: string } = {}
) {
  const payload = {
    sessionId: getAuthSessionId(),
    eventType,
    authPath: meta.path,
    intent: meta.intent,
    sourcePage: meta.source,
    propertyId: meta.propertyId,
    role: meta.role,
    userId: meta.userId,
    organizationId: meta.organizationId,
    deviceType: window.innerWidth < 768 ? 'mobile' : 'desktop',
    metadata: { mode: meta.mode },
  };

  if (!isProductionApiEnabled()) {
    console.debug('[auth-analytics]', eventType, payload);
    return;
  }

  try {
    await fetch('/api/auth/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    /* non-blocking */
  }
}
