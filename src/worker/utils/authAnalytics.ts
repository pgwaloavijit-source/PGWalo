import { Env } from '../types';

export interface AuthEventPayload {
  sessionId: string;
  eventType: string;
  authPath?: string;
  intent?: string;
  sourcePage?: string;
  propertyId?: string;
  role?: string;
  userId?: string;
  organizationId?: string;
  deviceType?: string;
  metadata?: Record<string, unknown>;
}

export async function logAuthEvent(env: Env, payload: AuthEventPayload): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO auth_events (
      id, organization_id, user_id, session_id, event_type,
      auth_path, intent, source_page, property_id, role, device_type, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    `auth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    payload.organizationId || env.DEFAULT_ORGANIZATION_ID,
    payload.userId || null,
    payload.sessionId,
    payload.eventType,
    payload.authPath || null,
    payload.intent || null,
    payload.sourcePage || null,
    payload.propertyId || null,
    payload.role || null,
    payload.deviceType || null,
    payload.metadata ? JSON.stringify(payload.metadata) : null
  ).run();
}

export async function getAuthAnalytics(env: Env, organizationId: string, role: string) {
  const isAdmin = role === 'admin';
  const orgFilter = isAdmin ? '' : 'WHERE organization_id = ?';
  const bind = isAdmin ? [] : [organizationId];

  const funnel = await env.DB.prepare(`
    SELECT event_type, COUNT(*) as count
    FROM auth_events ${orgFilter}
    GROUP BY event_type ORDER BY count DESC LIMIT 20
  `).bind(...bind).all();

  const daily = await env.DB.prepare(`
    SELECT date(created_at) as day, event_type, COUNT(*) as count
    FROM auth_events ${orgFilter}
    AND created_at >= datetime('now', '-30 days')
    GROUP BY day, event_type ORDER BY day DESC LIMIT 100
  `).bind(...bind).all();

  const paths = await env.DB.prepare(`
    SELECT auth_path, intent, COUNT(*) as count
    FROM auth_events ${orgFilter}
    AND auth_path IS NOT NULL
    GROUP BY auth_path, intent ORDER BY count DESC LIMIT 20
  `).bind(...bind).all();

  const recent = await env.DB.prepare(`
    SELECT event_type, auth_path, intent, source_page, property_id, role, device_type, created_at
    FROM auth_events ${orgFilter}
    ORDER BY created_at DESC LIMIT 50
  `).bind(...bind).all();

  return { funnel: funnel.results, daily: daily.results, paths: paths.results, recent: recent.results };
}
