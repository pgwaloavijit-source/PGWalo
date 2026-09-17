import { Env, User } from '../types';
import { authMiddleware } from '../middleware/auth';
import { rowToBroadcastNotification } from '../utils/rowMap';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/**
 * The signed-in user's notification inbox: announcements addressed to everyone
 * in scope plus personal notices (complaint status changes) addressed to their
 * account. Cheap and small — the SSE change event just tells the client to
 * refetch this.
 */
export async function notificationsHandler(request: Request, env: Env): Promise<Response> {
  const auth = await authMiddleware(request, env);
  if (!auth.success || !auth.user) return json({ error: auth.error || 'Authentication required' }, 401);
  const user = auth.user;

  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM broadcast_notifications
        WHERE recipient_id IS NULL OR recipient_id = ?
        ORDER BY timestamp DESC
        LIMIT 50`
    ).bind(user.id).all();

    return json((results || []).map((row) => rowToBroadcastNotification(row as Record<string, unknown>)));
  } catch (error) {
    console.error('notifications get', error);
    return json([]);
  }
}
