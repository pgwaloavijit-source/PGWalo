import { Env } from './types';
import { handleCors, addCorsHeaders, setCorsContext } from './utils/cors';
import { authMiddleware } from './middleware/auth';
import { bootstrapHandler } from './handlers/bootstrap';
import { collectionHandler } from './handlers/collection';
import { healthHandler } from './handlers/health';
import { mediaHandler } from './handlers/media';
import { authHandler } from './handlers/auth';
import { notifyHandler } from './handlers/notify';
import { geoHandler } from './handlers/geo';
import { listingsHandler } from './handlers/listings';
import { inquiriesHandler } from './handlers/inquiries';
import { adminHandler } from './handlers/admin';
import { supportTicketsHandler } from './handlers/supportTickets';
import { maintenanceTicketsHandler } from './handlers/maintenanceTickets';
import { eventsHandler } from './handlers/events';
import { notificationsHandler } from './handlers/notifications';
import { runEscalationSweep } from './handlers/maintenanceTickets';

export default {
  // Escalation sweep: breach detection + owner notifications every 15 minutes.
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    await runEscalationSweep(env);
  },
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    setCorsContext(request, env);
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return handleCors();
    }

    try {
      // Health check
      if (path === '/api/health') {
        return healthHandler(env);
      }

      // Authentication endpoints (no auth middleware required)
      if (path.startsWith('/api/auth')) {
        return authHandler(request, env);
      }

      if (path.startsWith('/api/geo')) {
        return geoHandler(request, env);
      }

      if (path.startsWith('/api/media')) {
        return mediaHandler(request, env);
      }

      if (path.startsWith('/api/listings')) {
        return listingsHandler(request, env);
      }

      if (path.startsWith('/api/inquiries')) {
        return inquiriesHandler(request, env);
      }

      if (path.startsWith('/api/notify')) {
        return notifyHandler(request, env);
      }

      if (path === '/api/support-tickets') {
        return supportTicketsHandler(request, env);
      }

      if (path === '/api/maintenance-tickets') {
        return maintenanceTicketsHandler(request, env);
      }

      // Server-Sent Events push channel (JWT via ?token= — EventSource cannot
      // set headers). Kept above the generic /api/<collection> matcher.
      if (path === '/api/events') {
        return eventsHandler(request, env);
      }

      if (path === '/api/notifications') {
        return notificationsHandler(request, env);
      }

      if (path.startsWith('/api/admin')) {
        return adminHandler(request, env);
      }

      // Bootstrap endpoints (auth middleware applied)
      if (path === '/api/bootstrap') {
        const authResult = await authMiddleware(request, env);
        if (!authResult.success) {
          return addCorsHeaders(new Response(JSON.stringify({ error: authResult.error }), { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }));
        }

        if (request.method === 'GET') {
          return bootstrapHandler(request, env, authResult.user!);
        } else if (request.method === 'POST') {
          return bootstrapHandler(request, env, authResult.user!);
        }
      }

      // Collection endpoints (auth middleware applied)
      const collectionMatch = path.match(/^\/api\/([^/]+)(?:\/([^/]+))?$/);
      if (collectionMatch) {
        const authResult = await authMiddleware(request, env);
        if (!authResult.success) {
          return addCorsHeaders(new Response(JSON.stringify({ error: authResult.error }), { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }));
        }

        const [, collection, id] = collectionMatch;
        return collectionHandler(request, env, collection, id, authResult.user!);
      }

      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return addCorsHeaders(new Response(JSON.stringify({ error: 'Not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      }));
    } catch (error) {
      console.error('Worker error:', error);
      return addCorsHeaders(new Response(JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }));
    }
  }
};